import json
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.operations.auth import AuthSettings
from app.platform import create_platform_app
from test_docx_ingestion import package
from test_durable_ingestion import pdf_bytes

PREFIX = "/workspaces/healthcare/api"
DOMAIN = "care-evidence-operations"
DEMO = Path(__file__).resolve().parents[2] / "public" / "demo" / "ward-handoff-procedure.txt"
DIRECT = "How does Care Handoff use Discharge Checklist?"
PATH = "How is Referral Queue related to Procedure Library?"
UNKNOWN = "What is the lunch menu on Mars?"


def open_app(path):
    return TestClient(create_platform_app(str(path), AuthSettings({}), enable_optimizers=False))


def response_json(response, status=200):
    assert response.status_code == status, response.text
    return response.json()


def upload(client, name, payload, status="completed"):
    uploaded = response_json(client.post(
        PREFIX + "/ingestion/upload/file",
        data={"source_type": name.rsplit(".", 1)[-1], "name": name, "domain": DOMAIN},
        files={"file": (name, payload)},
    ), 202)
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        job = response_json(client.get(PREFIX + "/ingestion/jobs/" + uploaded["job_id"]))
        if job["status"] in {"completed", "failed"}:
            assert job["status"] == status, job
            return uploaded["document_id"], job
        time.sleep(.02)
    pytest.fail("Source ingestion did not complete in time")


def build(client, document):
    return response_json(client.post(PREFIX + "/graph/build", json={
        "document_ids": [document],
        "extraction_configuration_version": "healthcare-extractor-2",
        "entity_threshold": .8,
        "relation_threshold": .75,
    }))


def ask(client, document, query, mode="hybrid"):
    return response_json(client.post(PREFIX + "/retrieve", json={
        "document_id": document,
        "query": query,
        "mode": mode,
        "top_k": 4,
        "max_hops": 3,
        "ranking_profile": "domain",
    }))


def test_demo_upload_build_cite_review_repeat_and_restart(tmp_path):
    database = tmp_path / "course.sqlite3"
    with open_app(database) as client:
        document, _ = upload(client, DEMO.name, DEMO.read_bytes())
        built = build(client, document)
        assert (built["added_nodes"], built["added_relations"], built["review_count"]) == (8, 9, 2)
        review = response_json(client.get(PREFIX + "/graph/documents/" + document))["relation_candidates"]
        assert {item["reason"] for item in review if not item["accepted"]} == {
            "negated or uncertain sentence", "co-occurrence only; no supported predicate",
        }
        chunks = response_json(client.get(PREFIX + "/ingestion/documents/" + document))["chunks"]
        for item in review:
            assert any(c["chunk_id"] == item["source_chunk"] and item["evidence"] in c["text"] for c in chunks)
        duplicate, _ = upload(client, DEMO.name, DEMO.read_bytes())
        assert duplicate == document
        rebuilt = build(client, duplicate)
        assert not rebuilt["changed"] and rebuilt["graph_version"] == built["graph_version"]
        result = ask(client, document, DIRECT)
        assert result["answer_status"] == "evidence"
        assert "Care Handoff uses Discharge Checklist." in result["evidence"][0]["excerpt"]
        assert [item["weight"] for item in result["score_breakdown"]] == [.65, .20, .15]
        assert result["provider_status"] == "disabled"
        assert result["fuzzy_explanation"]["inference_method"] == "mamdani"
        assert result["fuzzy_explanation"]["defuzzification_method"] == "centroid"
        path_result = ask(client, document, PATH)
        assert path_result["answer_status"] == "evidence"
        assert path_result["paths"][0]["labels"] == ["Referral Queue", "Follow Up Plan", "Procedure Library"]
        assert path_result["paths"][0]["citation_ids"] == [1]
        unknown = ask(client, document, UNKNOWN)
        assert unknown["answer_status"] == "insufficient_evidence" and not unknown["evidence"]
    with open_app(database) as restarted:
        assert response_json(restarted.get(PREFIX + "/retrieval/results/" + result["result_id"])) == result
        assert response_json(restarted.get(PREFIX + "/graph/documents/" + document))["graph_version"] == built["graph_version"]


@pytest.mark.parametrize("name,payload,location", [
    ("handoff.csv", b"procedure\nCare Handoff uses Discharge Checklist.\n", {"row": 2}),
    ("handoff.json", json.dumps([{"procedure": "Care Handoff uses Discharge Checklist."}]).encode(), {"json_path": "$[0]"}),
    ("handoff.docx", package("<w:p><w:r><w:t>Care Handoff uses Discharge Checklist.</w:t></w:r></w:p>"), {"paragraph": 1}),
    ("handoff.pdf", pdf_bytes("Care Handoff uses Discharge Checklist."), {"page": 1}),
], ids=["csv", "json", "docx", "pdf"])
def test_supported_procedures_keep_their_citation_location(tmp_path, name, payload, location):
    with open_app(tmp_path / "course.sqlite3") as client:
        document, _ = upload(client, name, payload)
        assert build(client, document)["added_relations"] == 1
        result = ask(client, document, DIRECT)
        assert result["answer_status"] == "evidence"
        assert result["evidence"][0]["source_location"] == location


def test_search_never_uses_another_sources_passages_or_paths(tmp_path):
    with open_app(tmp_path / "course.sqlite3") as client:
        first, _ = upload(client, "first.txt", b"Referral Queue supports Follow Up Plan.")
        second, _ = upload(client, "second.txt", b"Follow Up Plan uses Procedure Library. Unrelated reference: amber.")
        build(client, first)
        build(client, second)
        whole = response_json(client.post(PREFIX + "/retrieve", json={"query": PATH}))
        assert whole["answer_status"] == "evidence" and len(whole["paths"][0]["citation_ids"]) == 2
        for document in (first, second):
            scoped = ask(client, document, PATH)
            assert scoped["answer_status"] == "insufficient_evidence" and not scoped["paths"]
            assert {item["document_id"] for item in scoped["evidence"]} == {document}
        assert ask(client, first, "amber")["evidence"] == []
        assert client.post(PREFIX + "/retrieve", json={"document_id": "document-missing", "query": "amber"}).status_code == 404


def test_graph_can_be_empty_and_bad_csv_does_not_change_it(tmp_path):
    with open_app(tmp_path / "course.sqlite3") as client:
        document, _ = upload(client, "inventory.txt", b"The linen delivery arrives at sunrise.")
        built = build(client, document)
        assert built["added_nodes"] == built["added_relations"] == 0
        result = ask(client, document, "linen delivery", mode="lexical")
        assert result["answer_status"] == "evidence" and not result["nodes"]
        bad, failure = upload(client, "bad.csv", b"name,procedure\nmissing-column\n", status="failed")
        assert "header columns" in failure["error"]
        assert client.post(PREFIX + "/graph/build", json={
            "document_ids": [bad], "extraction_configuration_version": "healthcare-extractor-2",
        }).status_code == 409
        assert response_json(client.get(PREFIX + "/graph?limit=10"))["graph_version"] == built["graph_version"]


@pytest.mark.parametrize("extension", ["txt", "csv", "json", "docx"])
def test_unseen_procedure_concepts_are_extracted_and_cited(tmp_path, extension):
    statements = ["The Equipment Register supports the Asset Audit.", "The Asset Audit triggers the Service Review."]
    joined = "\n".join(statements)
    payloads = {
        "txt": joined.encode(),
        "csv": ("area,step\n" + "\n".join("Ops," + text for text in statements)).encode(),
        "json": json.dumps([{"step": text} for text in statements]).encode(),
        "docx": package("".join(f"<w:p><w:r><w:t>{text}</w:t></w:r></w:p>" for text in statements)),
    }
    with open_app(tmp_path / "course.sqlite3") as client:
        document, _ = upload(client, "new." + extension, payloads[extension])
        built = build(client, document)
        assert (built["added_nodes"], built["added_relations"], built["review_count"]) == (3, 2, 0)
        result = ask(client, document, "How is Equipment Register related to Service Review?")
        assert result["answer_status"] == "evidence", result["warnings"]
        assert result["paths"][0]["labels"] == ["Equipment Register", "Asset Audit", "Service Review"]
        cited = {item["chunk_id"]: item["text"] for item in result["evidence"]}
        assert {edge["relation_type"] for edge in result["relations"]} == {"supports", "triggers"}
        assert all(edge["evidence"] in cited[edge["source_chunk"]] for edge in result["relations"])
        assert ask(client, document, "How does Asset Audit trigger Service Review?")["answer_status"] == "evidence"


def test_new_fixture_builds_larger_graph_and_retains_uncertainty(tmp_path):
    fixture = DEMO.with_name("equipment-readiness-procedure.txt")
    with open_app(tmp_path / "course.sqlite3") as client:
        document, _ = upload(client, fixture.name, fixture.read_bytes())
        built = build(client, document)
        assert (built["added_nodes"], built["added_relations"], built["review_count"]) == (12, 11, 2)
        candidates = response_json(client.get(PREFIX + "/graph/documents/" + document))["relation_candidates"]
        assert all(not row["accepted"] for row in candidates if "might" in row["evidence"] or "does not" in row["evidence"])
        assert ask(client, document, "How is Equipment Register related to Weekend Desk?")["answer_status"] == "insufficient_evidence"
