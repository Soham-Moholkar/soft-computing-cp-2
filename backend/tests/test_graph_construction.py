import json
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.graph.extraction import extract
from app.ingestion.parser import chunk_segments, parse_content
from app.main import create_app
from app.models.graph import GraphBuildRequest


def ingest(client, name, text, chunk_size=400, chunk_overlap=0):
    response = client.post("/api/ingestion/upload", json={"source_type": "paste", "name": name, "domain": "course", "text": text, "chunk_size": chunk_size, "chunk_overlap": chunk_overlap})
    assert response.status_code == 202, response.text
    accepted = response.json()
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        job = client.get(f"/api/ingestion/jobs/{accepted['job_id']}").json()
        if job["status"] == "completed":
            return accepted["document_id"]
        assert job["status"] != "failed", job
        time.sleep(0.01)
    pytest.fail("Ingestion timed out")


def build(client, *documents, **options):
    response = client.post("/api/graph/build", json={"document_ids": list(documents), **options})
    assert response.status_code == 200, response.text
    return response.json()


def test_two_sources_alias_resolution_evidence_idempotency_and_restart(tmp_path):
    database = str(tmp_path / "graph.sqlite3")
    with TestClient(create_app(database_path=database)) as client:
        assert client.get("/api/graph").json()["entities"] == []
        first = ingest(client, "source-one", "PSO improves Hybrid Retrieval. Fuzzy Logic supports Hybrid Retrieval.")
        second = ingest(client, "source-two", "Particle Swarm Optimization improves Hybrid Retrieval. ACO explores Graph Paths.")
        preview = build(client, first, dry_run=True)
        assert preview["added_nodes"] == 3 and preview["added_relations"] == 2
        assert client.get("/api/graph").json()["graph_version"] == "graph-sqlite-0"
        assert client.get(f"/api/graph/documents/{first}").json()["configuration"] is None
        saved = build(client, first)
        assert saved["graph_version"] == "graph-sqlite-1"
        assert not build(client, first)["changed"]
        assert build(client, second)["graph_version"] == "graph-sqlite-2"
        graph = client.get("/api/graph").json()
        assert len(graph["entities"]) == 5 and len(graph["relations"]) == 3
        pso = next(item for item in graph["entities"] if item["canonical_name"] == "Particle Swarm Optimization")
        assert "PSO" in pso["aliases"] and len(pso["source_chunks"]) == 2
        shared = next(item for item in graph["relations"] if item["source_entity"] == pso["entity_id"])
        assert len(shared["source_chunks"]) == 2
        detail = client.get(f"/api/graph/entity/{pso['entity_id']}").json()
        assert {item["document_id"] for item in detail["evidence"]} == {first, second}
        chunks_by_id = {chunk["chunk_id"]: chunk for document in (first, second) for chunk in client.get(f"/api/ingestion/documents/{document}").json()["chunks"]}
        for relation in graph["relations"]:
            assert all(chunk_id in chunks_by_id for chunk_id in relation["source_chunks"])
            assert relation["evidence"] in chunks_by_id[relation["source_chunk"]]["text"]
        extraction = client.get(f"/api/graph/documents/{first}").json()
        source = client.get(f"/api/ingestion/documents/{first}").json()["chunks"][0]
        for mention in extraction["mentions"]:
            assert source["text"][mention["start_offset"]:mention["end_offset"]] == mention["surface_form"]
        assert client.get("/health").json()["graph_version"] == graph["graph_version"]
    with TestClient(create_app(database_path=database)) as restarted:
        assert restarted.get("/api/graph").json() == graph
        assert restarted.get(f"/api/graph/entity/{pso['entity_id']}").json() == detail
        assert not build(restarted, first, second)["changed"]


def test_rebuild_thresholds_and_removal_preserve_other_source_facts(tmp_path):
    with TestClient(create_app(database_path=str(tmp_path / "graph.sqlite3"))) as client:
        first = ingest(client, "first", "PSO improves Hybrid Retrieval.")
        second = ingest(client, "second", "Particle Swarm Optimization improves Hybrid Retrieval.")
        build(client, first, second)
        before = client.get("/api/graph").json()
        updated = build(client, first, entity_threshold=0.9)
        assert updated["changed"] and updated["review_count"] > 0
        assert len(client.get("/api/graph").json()["relations"]) == 1
        removed = client.delete(f"/api/graph/documents/{second}")
        assert removed.status_code == 200
        assert client.get("/api/graph").json()["relations"] == []
        assert len(client.get("/api/graph").json()["entities"]) == 1
        assert client.get(f"/api/ingestion/documents/{second}").status_code == 200
        assert client.delete(f"/api/graph/documents/{second}").json() == removed.json()
        build(client, first, second)
        rebuilt = client.get("/api/graph").json()
        assert rebuilt["entities"] == before["entities"] and rebuilt["relations"] == before["relations"]


def test_cross_page_edges_and_bounded_filtered_paths(tmp_path):
    with TestClient(create_app(database_path=str(tmp_path / "graph.sqlite3"))) as client:
        document = ingest(client, "paths", "PSO improves Hybrid Retrieval. Hybrid Retrieval uses Knowledge Graph. Fuzzy Logic supports Knowledge Graph.")
        build(client, document)
        entities = client.get("/api/graph").json()["entities"]
        ids = {item["canonical_name"]: item["entity_id"] for item in entities}
        first_page = client.get("/api/graph?limit=1").json()
        assert first_page["relations"] == [] and first_page["next_cursor"]
        relations, cursor = [], None
        while True:
            page = client.get("/api/graph/relations", params={"limit": 1, **({"cursor": cursor} if cursor else {})}).json()
            relations.extend(page["relations"])
            cursor = page["next_cursor"]
            if not cursor:
                break
        assert len(relations) == 3
        request = {"source_entity": ids["Particle Swarm Optimization"], "target_entity": ids["Knowledge Graph"], "max_hops": 2, "directed": True}
        path = client.post("/api/graph/path", json=request).json()
        assert len(path["nodes"]) == 3 and len(path["relations"]) == 2
        assert path["fuzzy_composed_strength"] == min(item["fuzzy_strength"] for item in path["relations"])
        assert client.post("/api/graph/path", json={**request, "max_hops": 1}).json()["nodes"] == []
        assert client.post("/api/graph/path", json={**request, "minimum_confidence": 0.99}).json()["nodes"] == []
        assert client.post("/api/graph/path", json={**request, "relation_types": ["supports"]}).json()["nodes"] == []
        assert client.post("/api/graph/path", json={**request, "source_entity": request["target_entity"], "target_entity": request["source_entity"]}).json()["nodes"] == []
        assert client.post("/api/graph/path", json={**request, "source_entity": "missing"}).status_code == 404
        assert client.post("/api/graph/path", json={**request, "max_hops": 11}).status_code == 422
        source_chunk = relations[0]["source_chunk"]
        assert client.get("/api/graph", params={"source": source_chunk}).json()["relations"]


def test_build_failure_is_atomic_and_inputs_are_strict(tmp_path):
    with TestClient(create_app(database_path=str(tmp_path / "graph.sqlite3"))) as client:
        document = ingest(client, "valid", "Fuzzy Logic supports Knowledge Graph.")
        assert client.post("/api/graph/build", json={"document_ids": [document, "missing"]}).status_code == 404
        assert client.get("/api/graph").json()["entities"] == []
        for payload in ({"document_ids": []}, {"document_ids": [document], "entity_threshold": 2}, {"document_ids": [document], "unknown": True}, {"document_ids": [document], "extraction_configuration_version": "missing"}):
            assert client.post("/api/graph/build", json=payload).status_code == 422
        assert client.get("/api/graph/entity/missing").status_code == 404
        assert client.delete("/api/graph/documents/missing").status_code == 404
        unsupported = ingest(client, "unknown", "Something unfamiliar happens here.")
        result = build(client, unsupported)
        assert result["added_nodes"] == 0 and any("no known" in warning for warning in result["warnings"])


def test_gold_extraction_examples_and_negation_across_chunk_overlap():
    examples = json.loads((Path(__file__).resolve().parents[2] / "sample-data/graph-extraction-gold.json").read_text())
    config = GraphBuildRequest(document_ids=["document-gold"])
    for example in examples:
        segments, _ = parse_content(example["text"].encode(), "txt")
        mentions, candidates = extract("document-gold", chunk_segments("document-gold", segments, 400, 0), config)
        assert {item.canonical_name for item in mentions if item.accepted} == set(example["entities"]), example
        assert sorted(item.relation_type for item in candidates if item.accepted) == sorted(example["relations"]), example
    segments, _ = parse_content(b"It is not true that Fuzzy Logic supports Hybrid Retrieval.", "txt")
    mentions, candidates = extract("document-gold", chunk_segments("document-gold", segments, 8, 4), config)
    assert candidates and all(not item.accepted for item in candidates)
    assert all(item.reason == "negated or uncertain sentence" for item in candidates)
    assert len(mentions) == len({item.mention_id for item in mentions})
    for surface in ("PSO", "pso"):
        segments, _ = parse_content(f"{surface} improves Hybrid Retrieval.".encode(), "txt")
        mentions, candidates = extract("document-gold", chunk_segments("document-gold", segments, 400, 0), GraphBuildRequest(document_ids=["document-gold"], entity_threshold=0.9))
        acronym = next(item for item in mentions if item.canonical_name == "Particle Swarm Optimization")
        assert acronym.extraction_confidence == 0.85 and not acronym.accepted
        assert not any(item.accepted for item in candidates)
