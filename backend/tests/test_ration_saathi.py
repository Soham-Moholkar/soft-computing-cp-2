import time
from pathlib import Path

from fastapi.testclient import TestClient

from app.operations.auth import AuthSettings
from app.platform import create_platform_app


PREFIX = "/workspaces/ration/api"
FILES = Path(__file__).resolve().parents[2] / "public" / "demo"


def save(client, name, content, kind="csv"):
    upload = client.post(PREFIX + "/ingestion/upload/file", data={
        "source_type": kind, "domain": "ration-saathi-library", "name": name,
    }, files={"file": (name, content)})
    assert upload.status_code == 202, upload.text
    queued = upload.json()
    until = time.monotonic() + 8
    while time.monotonic() < until:
        job = client.get(PREFIX + "/ingestion/jobs/" + queued["job_id"]).json()
        if job["status"] == "completed":
            break
        assert job["status"] != "failed", job
        time.sleep(.025)
    else:
        raise AssertionError("Upload did not finish in time")
    response = client.post(PREFIX + "/graph/build", json={
        "document_ids": [queued["document_id"]],
        "extraction_configuration_version": "ration-extractor-1",
    })
    assert response.status_code == 200, response.text
    return queued["document_id"], response.json()


def ask(client, document, query, top_k=5):
    response = client.post(PREFIX + "/retrieve", json={
        "document_id": document, "query": query, "ranking_profile": "domain",
        "max_hops": 4, "top_k": top_k,
    })
    assert response.status_code == 200, response.text
    return response.json()


def assert_trace(result, path):
    assert result["answer_status"] == "evidence", result["warnings"]
    trace = next(item for item in result["paths"] if item["labels"] == path)
    citations = {item["chunk_id"]: item for item in result["evidence"]}
    assert trace["citation_ids"]
    for edge in result["relations"]:
        assert edge["evidence"] in citations[edge["source_chunk"]]["text"]


def test_large_ration_upload_produces_review_and_query_graph(tmp_path):
    app = create_platform_app(str(tmp_path / "course.sqlite3"), AuthSettings({}), enable_optimizers=False)
    with TestClient(app) as client:
        filename = "fictional-district-desk.csv"
        document, graph = save(client, filename, (FILES / filename).read_bytes())
        assert (graph["added_nodes"], graph["added_relations"], graph["review_count"]) == (128, 112, 16)
        question = "How is Acacia Help Desk related to Acacia Visit Plan?"
        result = ask(client, document, question, top_k=3)
        assert_trace(result, ["Acacia Help Desk", "Acacia Intake Sheet", "Acacia Callback Queue", "Acacia Visit Plan"])
        assert {item["document_id"] for item in result["evidence"]} == {document}
        assert len({item["source_location"]["row"] for item in result["evidence"]}) == 3
        unrelated = ask(client, document, "How is Acacia Help Desk related to Pine Visit Plan?")
        assert unrelated["answer_status"] == "insufficient_evidence"
        assert not unrelated["paths"]


def test_new_upload_ranks_middle_hop_with_no_query_words(tmp_path):
    app = create_platform_app(str(tmp_path / "course.sqlite3"), AuthSettings({}), enable_optimizers=False)
    payload = b"Row text\nBeacon Desk uses Cedar Sheet.\nCedar Sheet feeds Ivory Queue.\nIvory Queue supports Violet Register.\n"
    with TestClient(app) as client:
        document, _ = save(client, "new-desk.csv", payload)
        result = ask(client, document, "How is Beacon Desk related to Violet Register?", top_k=3)
        assert_trace(result, ["Beacon Desk", "Cedar Sheet", "Ivory Queue", "Violet Register"])
        assert any("Cedar Sheet feeds Ivory Queue" in item["text"] for item in result["evidence"])
        second, _ = save(client, "elsewhere.txt", b"Beacon Desk supports Violet Register.", "txt")
        assert_trace(ask(client, second, "How is Beacon Desk related to Violet Register?"), ["Beacon Desk", "Violet Register"])
        assert_trace(ask(client, document, "How is Beacon Desk related to Violet Register?", top_k=3), ["Beacon Desk", "Cedar Sheet", "Ivory Queue", "Violet Register"])


def test_guide_csv_has_a_cited_portability_path(tmp_path):
    app = create_platform_app(str(tmp_path / "course.sqlite3"), AuthSettings({}), enable_optimizers=False)
    with TestClient(app) as client:
        document, graph = save(client, "ration-guide.csv", (FILES / "ration-guide.csv").read_bytes())
        assert graph["added_relations"] >= 26
        result = ask(client, document, "How is One Nation One Ration Card related to Monthly Entitlement?")
        assert_trace(result, ["One Nation One Ration Card", "Existing NFSA Card", "Portability Claim", "Monthly Entitlement"])
