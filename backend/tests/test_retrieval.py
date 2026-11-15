import asyncio
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.models.retrieval import RetrievalRequest
from app.retrieval.provider import ProviderSettings
from app.retrieval.provider import rerank
import httpx
from test_graph_construction import ingest, build


def seeded(database):
    app = create_app(database_path=str(database))
    with TestClient(app) as client:
        first = ingest(client, "PSO source", "PSO improves Hybrid Retrieval. Hybrid Retrieval uses Knowledge Graph.")
        second = ingest(client, "ACO source", "ACO explores Graph Paths.")
        build(client, first, second)
    return app, first, second


def retrieve(client, query="How is PSO related to Knowledge Graph?", **options):
    response = client.post("/api/retrieve", json={"query": query, **options})
    assert response.status_code == 200, response.text
    return response.json()


def test_queries_change_evidence_and_all_citations_exist(tmp_path):
    app, first, second = seeded(tmp_path / "sources.sqlite3")
    with TestClient(app) as client:
        pso = retrieve(client)
        aco = retrieve(client, "What does ACO explore?")
        assert pso["answer_status"] == aco["answer_status"] == "evidence"
        assert pso["answer"] != aco["answer"]
        assert pso["evidence"][0]["document_id"] == first
        assert aco["evidence"][0]["document_id"] == second
        assert pso["paths"][0]["labels"] == ["Particle Swarm Optimization", "Hybrid Retrieval", "Knowledge Graph"]
        assert pso["paths"][0]["citation_ids"] == [1]
        for result in (pso, aco):
            chunks = {chunk["chunk_id"]: chunk for doc in (first, second) for chunk in client.get(f"/api/ingestion/documents/{doc}").json()["chunks"]}
            for item in result["evidence"]:
                assert item["text"] == chunks[item["chunk_id"]]["text"]
                assert item["excerpt"] in item["text"]
                assert f'[{item["citation"]}]' in result["answer"]
            assert sum(item["contribution"] for item in result["score_breakdown"]) == pytest.approx(result["confidence"])
            trace = result["fuzzy_explanation"]
            assert trace["rule_set_version"] == "fuzzy-rules-1"


@pytest.mark.parametrize("query", ["What year was PSO invented?", "PSO tuition price?", "Quantum bananas?", "How is ACO related to Knowledge Graph?", "What is the capital of France?"])
def test_unsupported_or_disconnected_queries_abstain(tmp_path, query):
    app, _, _ = seeded(tmp_path / "sources.sqlite3")
    with TestClient(app) as client:
        result = retrieve(client, query, use_provider=True)
        assert result["answer_status"] == "insufficient_evidence"
        assert result["answer"].startswith("Insufficient evidence")
        assert result["provider_status"] == "skipped_insufficient_evidence"


def test_snapshot_feedback_versions_and_restart(tmp_path):
    database = tmp_path / "sources.sqlite3"
    app, first, _ = seeded(database)
    with TestClient(app) as client:
        original = retrieve(client)
        explanation = client.post("/api/explanations", json={"result_id": original["result_id"]}).json()
        feedback = client.post("/api/hybrid/feedback", json={"result_id": original["result_id"], "feedback": "partial"})
        assert feedback.status_code == 200 and feedback.json()["accepted"]
        client.delete(f"/api/graph/documents/{first}")
        changed_graph = retrieve(client)
        assert changed_graph["graph_version"] != original["graph_version"]
        assert changed_graph["answer_status"] == "insufficient_evidence"
        assert changed_graph["index_version"] == original["index_version"]
        ingest(client, "new source", "Fuzzy Logic supports Hybrid Retrieval.")
        changed_index = retrieve(client, "Fuzzy Logic")
        assert changed_index["index_version"] != original["index_version"]
    with TestClient(create_app(database_path=str(database))) as client:
        assert client.get(f'/api/retrieval/results/{original["result_id"]}').json() == original
        assert client.post("/api/explanations", json={"result_id": original["result_id"]}).json() == explanation
        with client.app.state.ingestion_repository.connect() as db:
            assert db.execute("SELECT rating FROM retrieval_feedback WHERE result_id=?", (original["result_id"],)).fetchone()[0] == "partial"
        assert client.post("/api/hybrid/feedback", json={"result_id": "missing", "feedback": "relevant"}).status_code == 404


def test_empty_corpus_and_request_bounds(tmp_path):
    with TestClient(create_app(database_path=str(tmp_path / "empty.sqlite3"))) as client:
        result = retrieve(client)
        assert result["answer_status"] == "insufficient_evidence" and result["evidence"] == []
        assert result["paths"] == [] and result["confidence"] == 0
        for options in ({"query": " "}, {"query": "q", "top_k": 11}, {"query": "q", "max_hops": 6}, {"query": "q", "mode": "invalid"}, {"query": "x" * 2001}):
            assert client.post("/api/retrieve", json=options).status_code == 422
        unavailable = client.post("/api/retrieve", json={"query": "PSO", "mode": "aco"})
        assert unavailable.status_code == 422 and unavailable.json()["code"] == "algorithm_unavailable"


def test_provider_reorders_known_ids_cache_survives_restart_and_budget_is_atomic(tmp_path):
    database = tmp_path / "sources.sqlite3"
    app, _, _ = seeded(database)
    service = app.state.retrieval_service
    service.provider_settings = ProviderSettings(api_key="test-key", daily_budget=1)
    calls = []
    def provider(query, candidates, settings):
        calls.append(query)
        return [item["chunk_id"] for item in reversed(candidates)]
    service.provider_call = provider
    request = RetrievalRequest(query="Optimization", use_provider=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: service.retrieve(request), range(4)))
    assert len(calls) == 1
    assert "reranked" in {result.provider_status for result in results}
    assert {result.provider_status for result in results} <= {"reranked", "cached", "busy"}
    restarted = create_app(database_path=str(database)).state.retrieval_service
    restarted.provider_settings = service.provider_settings
    restarted.provider_call = lambda *args: pytest.fail("cached result should not call provider")
    assert restarted.retrieve(request).provider_status == "cached"
    assert restarted.retrieve(RetrievalRequest(query="PSO", use_provider=True)).provider_status == "budget_exhausted"
    reranked = next(result for result in results if result.provider_status == "reranked")
    assert reranked.provider_model_requested == "openrouter/free"
    assert reranked.provider_parameters == {"temperature": 0, "max_tokens": 2000, "timeout_seconds": 8.0}
    restarted.provider_settings = ProviderSettings(api_key="test-key", model="different:free")
    explanation = restarted.explain(reranked.result_id)
    assert any("Requested provider model: openrouter/free" in line for line in explanation["decision_trace"])
    assert reranked.evidence[0].chunk_id == service.retrieve(RetrievalRequest(query="Optimization")).evidence[-1].chunk_id


@pytest.mark.parametrize("provider", [lambda *args: ["invented-chunk"], lambda *args: [], lambda *args: (_ for _ in ()).throw(TimeoutError()), lambda query, candidates, settings: [candidates[0]["chunk_id"]] * len(candidates)])
def test_provider_invalid_response_or_timeout_falls_back(tmp_path, provider):
    app, _, _ = seeded(tmp_path / "sources.sqlite3")
    service = app.state.retrieval_service
    service.provider_settings = ProviderSettings(api_key="test-key", daily_budget=1)
    service.provider_call = provider
    plain = service.retrieve(RetrievalRequest(query="Optimization"))
    result = service.retrieve(RetrievalRequest(query="Optimization", use_provider=True))
    assert result.provider_status == "fallback"
    assert result.answer == plain.answer
    assert any("Local ranking" in warning for warning in result.warnings)
    with service.ingestion.connect() as db:
        assert db.execute("SELECT attempts FROM provider_usage").fetchone()[0] == 1


def test_unconfigured_or_paid_provider_never_calls_out(tmp_path):
    app, _, _ = seeded(tmp_path / "sources.sqlite3")
    service = app.state.retrieval_service
    service.provider_call = lambda *args: pytest.fail("provider should be disabled")
    for config in (ProviderSettings(), ProviderSettings(api_key="test-key", model="paid-model")):
        service.provider_settings = config
        result = service.retrieve(RetrievalRequest(query="PSO", use_provider=True))
        assert result.provider_status == "unconfigured" and result.answer_status == "evidence"


def test_semantic_alias_is_honest_and_graph_hop_limit_is_used(tmp_path):
    app, _, _ = seeded(tmp_path / "sources.sqlite3")
    with TestClient(app) as client:
        lexical = retrieve(client, "PSO", mode="semantic")
        assert lexical["mode"] == "lexical" and any("embedding" in warning for warning in lexical["warnings"])
        bounded = retrieve(client, max_hops=1, mode="graph")
        assert bounded["paths"] == [] and bounded["answer_status"] == "insufficient_evidence"


def test_negation_in_source_is_preserved_and_has_no_accepted_graph_path(tmp_path):
    with TestClient(create_app(database_path=str(tmp_path / "negative.sqlite3"))) as client:
        doc = ingest(client, "negative source", "PSO does not improve Hybrid Retrieval.")
        build(client, doc)
        result = retrieve(client, "Does PSO improve Hybrid Retrieval?", mode="lexical")
        assert "not improve" in result["answer"]
        assert result["relations"] == [] and result["paths"] == []


def test_relation_quote_belongs_to_selected_alias_source(tmp_path):
    with TestClient(create_app(database_path=str(tmp_path / "alias.sqlite3"))) as client:
        first = ingest(client, "acronym", "PSO improves Hybrid Retrieval.")
        second = ingest(client, "canonical", "Particle Swarm Optimization improves Hybrid Retrieval.")
        build(client, first, second)
        result = retrieve(client, "PSO", top_k=1)
        chunks = {item["chunk_id"]: item["text"] for item in result["evidence"]}
        assert result["relations"]
        for relation in result["relations"]:
            assert relation["evidence"] in chunks[relation["source_chunk"]]
            assert set(relation["source_chunks"]) <= chunks.keys()


@pytest.mark.parametrize("content", ['{"chunk_ids":["c2","c1"]}', '{"chunk_ids":["unknown","c1"]}', 'not-json'])
def test_provider_http_contract_and_id_validation(monkeypatch, content):
    original = httpx.AsyncClient
    seen = []
    def handler(request):
        seen.append(request)
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})
    monkeypatch.setattr("app.retrieval.provider.httpx.AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    arguments = ("question", [{"chunk_id": "c1", "text": "source one"}, {"chunk_id": "c2", "text": "source two"}], ProviderSettings(api_key="test-key"))
    if content.startswith('{"chunk_ids":["c2"'):
        assert rerank(*arguments) == ["c2", "c1"]
    else:
        with pytest.raises(ValueError):
            rerank(*arguments)
    assert len(seen) == 1
    assert str(seen[0].url) == "https://openrouter.ai/api/v1/chat/completions"


def test_provider_total_deadline(monkeypatch):
    original = httpx.AsyncClient
    async def handler(request):
        await asyncio.sleep(0.1)
        return httpx.Response(200, json={"choices": []})
    monkeypatch.setattr("app.retrieval.provider.httpx.AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    with pytest.raises(TimeoutError):
        rerank("question", [{"chunk_id": "c1", "text": "source"}], ProviderSettings(api_key="test-key", timeout=0.01))


def test_corpus_limits_fail_explicitly(tmp_path):
    app, _, _ = seeded(tmp_path / "bounds.sqlite3")
    service = app.state.retrieval_service
    service.MAX_CHUNKS = 1
    with TestClient(app) as client:
        response = client.post("/api/retrieve", json={"query": "PSO"})
        assert response.status_code == 413 and response.json()["code"] == "retrieval_limit"


def test_large_candidate_set_limits_fuzzy_work_and_discloses_shortlisting(tmp_path, monkeypatch):
    app = create_app(database_path=str(tmp_path / "shortlist.sqlite3"))
    with TestClient(app) as client:
        ingest(client, "many tiny chunks", " ".join(f"PSO fact{index}" for index in range(250)), chunk_size=1)
        service = app.state.retrieval_service
        calls = []
        evaluate = service.fuzzy.evaluate
        def counted(request):
            calls.append(request)
            return evaluate(request)
        monkeypatch.setattr(service.fuzzy, "evaluate", counted)
        result = retrieve(client, "PSO")
        assert result["answer_status"] == "evidence"
        assert len(calls) <= 201  # Candidate cap plus the empty-result trace.
        assert any("200 lexical/graph candidates" in warning for warning in result["warnings"])
