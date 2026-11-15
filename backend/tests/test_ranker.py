import json
from random import Random

import pytest
from fastapi.testclient import TestClient

from app.evaluation.metrics import summarize, quality_summary
from app.evaluation.promote import decision, manifest_errors
from app.evaluation.dataset import load_dataset, query_clusters
from pathlib import Path
import copy
from app.core.errors import IngestionError
from app.evaluation.train_ranker import train
from app.factory import create_app
from app.fuzzy.engine import FuzzyEngine
from app.models.fuzzy import FuzzyEvaluationRequest
from app.retrieval.ranker import load_ranker, seal, FEATURE_VERSION
from app.retrieval.service import excerpt, sentence_index, terms
from test_graph_construction import ingest, build


def artifact():
    return seal({"domain": "soft-computing-course", "weights": [0.5, 0.2, 0.1, 0.2],
                 "dataset_sha256": "a" * 64, "training_code_sha256": "b" * 64, "seed": 1729,
                 "training": {"method": "test fixture"}})


def report(model, split, candidate):
    rows = [{"query_id": f"{split}-q-{index}", "family": f"{split}-family-{index % 6}", "mode": "hybrid",
             "answerable": True, "failed": False, "metrics": {"ndcg_at_k": 0.8 if candidate else 0.6}}
            for index in range(36)]
    rows += [{"query_id": f"{split}-negative-{index}", "family": f"{split}-family-{index % 6}", "mode": "hybrid", "answerable": False, "failed": False} for index in range(24)]
    for row in rows:
        row.update(abstained=not row["answerable"], relevant_evidence_returned=row["answerable"],
                   citation_integrity=True if row["answerable"] else None, latency_samples_ms=[40, 40, 40])
    return {"report_schema": "2", "split": split, "test_unlocked": split == "test", "dataset_sha256": model.dataset_sha256,
            "code_sha256": model.training_code_sha256, "top_k": 3, "seed": 1729,
            "latency_protocol": {"warm_repeats_per_query": 3, "mode_order": "seeded shuffled", "reported_percentiles": "warm API calls"},
            "ranker_sha256": model.checksum if candidate else None, "review_status": "human_reviewed",
            "adaptation_reviewed": True, "domain": "soft-computing-course", "reviewers": ["test reviewer"],
            "leakage_audit": {"near_duplicate_sources": [], "shared_cross_split_facts": []}, "records": rows,
            "summary": {"hybrid": quality_summary(rows)}}


def promoted(model):
    evidence = decision(model, report(model, "validation", False), report(model, "validation", True),
                        report(model, "test", False), report(model, "test", True))
    assert evidence["accepted"]
    return seal({**model.model_dump(), "status": "promoted", "promotion": evidence})


def test_candidate_tamper_and_invalid_weights_cannot_be_loaded(tmp_path):
    model = artifact()
    path = tmp_path / "ranker.json"
    path.write_text(model.model_dump_json(), encoding="utf-8")
    with pytest.raises(ValueError, match="Candidate"):
        load_ranker(path)
    assert load_ranker(path, allow_candidate=True).checksum == model.checksum
    altered = model.model_dump()
    altered["weights"] = [.1, .1, .1, .7]
    path.write_text(json.dumps(altered), encoding="utf-8")
    with pytest.raises(ValueError, match="checksum"):
        load_ranker(path, allow_candidate=True)
    with pytest.raises(ValueError, match="simplex"):
        seal({**model.model_dump(), "weights": [1, 1, 0, 0]})
    with pytest.raises(ValueError):
        seal({**model.model_dump(), "weights": [float("nan"), 0, 0, 0]})


def test_promotion_rejects_missing_evidence_unreviewed_data_and_no_gain():
    model = artifact()
    base, candidate = report(model, "validation", False), report(model, "validation", True)
    result = decision(model, base, candidate)
    assert not result["accepted"] and any("Missing frozen test" in reason for reason in result["reasons"])
    candidate["review_status"] = "upstream_human_annotated"
    candidate["adaptation_reviewed"] = False
    for row in candidate["records"]:
        if row["answerable"]:
            row["metrics"]["ndcg_at_k"] = .6
    result = decision(model, base, candidate, report(model, "test", False), report(model, "test", True))
    assert any("reviewed" in reason for reason in result["reasons"])
    assert any("gain" in reason for reason in result["reasons"])
    candidate = report(model, "validation", True)
    candidate["dataset_sha256"] = "c" * 64
    assert not decision(model, base, candidate, report(model, "test", False), report(model, "test", True))["accepted"]


def test_promoted_model_scores_are_traced_and_rollback_restores_default(tmp_path):
    model = promoted(artifact())
    path, database = tmp_path / "ranker.json", tmp_path / "sources.sqlite3"
    path.write_text(model.model_dump_json(), encoding="utf-8")
    assert load_ranker(path).checksum == model.checksum
    with TestClient(create_app(database_path=str(database), ranker_path=str(path))) as client:
        doc = ingest(client, "course", "PSO improves Hybrid Retrieval. Hybrid Retrieval uses Knowledge Graph.")
        build(client, doc)
        result = client.post("/api/retrieve", json={"query": "PSO", "mode": "hybrid"}).json()
        assert result["configuration_version"] == "ranker-" + model.checksum[:24]
        assert len(result["score_breakdown"]) == 4
        assert sum(item["contribution"] for item in result["score_breakdown"]) == pytest.approx(result["confidence"])
        saved_id = result["result_id"]
    with TestClient(create_app(database_path=str(database))) as client:
        result = client.post("/api/retrieve", json={"query": "PSO"}).json()
        assert result["configuration_version"] == "retrieval-bm25-1"
        assert client.get(f"/api/retrieval/results/{saved_id}").json()["configuration_version"].startswith("ranker-")


def test_unpromoted_artifact_falls_back_without_changing_answer_gates(tmp_path):
    path = tmp_path / "candidate.json"
    path.write_text(artifact().model_dump_json(), encoding="utf-8")
    with TestClient(create_app(database_path=str(tmp_path / "sources.sqlite3"), ranker_path=str(path))) as client:
        result = client.post("/api/retrieve", json={"query": "What year was PSO invented?"}).json()
        assert result["answer_status"] == "insufficient_evidence"
        assert result["configuration_version"] == "retrieval-bm25-1"
        assert any("artifact was rejected" in message for message in result["warnings"])
        health = client.get("/health").json()
        assert health["services"]["ranking_artifact"] == "baseline_artifact_rejected"
        assert health["configuration_version"] == result["configuration_version"]


def test_shortlist_uses_learned_coverage_weight_and_health_tracks_live_versions(tmp_path):
    with TestClient(create_app(database_path=str(tmp_path / "sources.sqlite3"))) as client:
        before = client.get("/health").json()
        assert client.app.state.retrieval_service._corpus is None
        partial = ingest(client, "partial", "alpha " * 30)
        complete = ingest(client, "complete", "alpha beta " + "padding " * 100)
        service = client.app.state.retrieval_service
        service.MAX_CANDIDATES = 1
        service.ranker = seal({**artifact().model_dump(), "weights": [0, 0, 0, 1]})
        result = client.post("/api/retrieve", json={"query": "alpha beta", "mode": "hybrid"}).json()
        assert result["evidence"][0]["document_id"] == complete
        assert result["evidence"][0]["document_id"] != partial
        health = client.get("/health").json()
        assert health["index_version"] != before["index_version"]
        for key in ("index_version", "configuration_version", "graph_version"):
            assert health[key] == result[key]


def test_promotion_rejects_invented_summaries_duplicates_and_missing_samples():
    model = artifact()
    base = report(model, "validation", False)
    for edit in ("outcomes", "duplicates", "samples"):
        candidate = report(model, "validation", True)
        if edit == "outcomes":
            candidate["records"][0]["abstained"] = True
        elif edit == "duplicates":
            candidate["records"][1]["query_id"] = candidate["records"][0]["query_id"]
        else:
            candidate["records"][0]["latency_samples_ms"] = []
        result = decision(model, base, candidate, report(model, "test", False), report(model, "test", True))
        assert not result["accepted"] and any("Invalid validation candidate report" in reason for reason in result["reasons"])


def test_manifest_rejects_omitted_queries_and_invented_independent_clusters():
    dataset, fingerprint = load_dataset(Path(__file__).resolve().parents[1] / "evaluation" / "synthetic-course-v1.json")
    queries = [query for query in dataset.queries if query.split == "validation"]
    clusters = query_clusters([source for source in dataset.sources if source.split == "validation"], queries)
    valid = {"split": "validation", "dataset_sha256": fingerprint,
             "records": [{"query_id": query.id, "mode": "hybrid", "answerable": query.answerable, "family": clusters[query.id]} for query in queries]}
    assert manifest_errors(dataset, fingerprint, valid) == []
    altered = copy.deepcopy(valid)
    altered["records"].pop()
    assert manifest_errors(dataset, fingerprint, altered)
    altered = copy.deepcopy(valid)
    altered["records"][0]["family"] = "fabricated-independent-family"
    assert manifest_errors(dataset, fingerprint, altered)


def test_fast_centroid_is_exact_at_boundaries_and_random_inputs():
    engine, random = FuzzyEngine(), Random(1729)
    inputs = [(semantic, relation, distance) for semantic in (0, .25, .5, .75, 1) for relation in (0, .25, .5, .75, 1) for distance in (1, 1.5, 3, 4.5, 5)]
    inputs += [(random.random(), random.random(), random.uniform(1, 5)) for _ in range(100)]
    for values in inputs:
        data = dict(zip(("semantic_similarity", "relation_strength", "graph_distance"), values))
        assert engine.centroid_score(data) == engine.evaluate(FuzzyEvaluationRequest(inputs=data)).score


def test_cached_excerpt_preserves_text_and_rejects_pathological_chunks():
    text = "Fuzzy Logic does not improve Hybrid Retrieval. PSO improves Hybrid Retrieval."
    query = set(terms("PSO Hybrid Retrieval"))
    assert excerpt(text, query) == excerpt(text, query, sentence_index(text))
    assert excerpt(text, query) in text
    with pytest.raises(IngestionError, match="100,000"):
        sentence_index("x" * 100001)
    with pytest.raises(IngestionError, match="2,000 sentences"):
        sentence_index("a." * 2001)


def test_bootstrap_resamples_families_and_suppresses_tiny_cluster_counts():
    small = summarize([0, 1, 1, 1, 1, 1], 1729, families=["one"] * 6)
    assert small["bootstrap_95_ci"] is None and small["families"] == 1
    families = [f"family-{index}" for index in range(6)]
    first = summarize([0, .2, .4, .6, .8, 1], 1729, families=families)
    duplicated = summarize([value for value in [0, .2, .4, .6, .8, 1] for _ in range(4)], 1729,
                           families=[family for family in families for _ in range(4)])
    assert duplicated["bootstrap_95_ci"] == pytest.approx(first["bootstrap_95_ci"])


def test_training_is_seeded_and_cannot_use_validation():
    training = {"split": "train", "test_unlocked": False, "ranker_sha256": None, "feature_version": FEATURE_VERSION,
                "seed": 1729, "domain": "general-wikipedia-english", "dataset_sha256": "a" * 64, "code_sha256": "b" * 64,
                "review_status": "upstream_human_annotated", "leakage_audit": {"family_counts": {"train": 6}},
                "records": [{"mode": "hybrid", "answerable": True, "failed": False,
                             "candidates": [{"chunk_id": "positive", "grade": 2, "features": [.8, 0, .2, .9]},
                                            {"chunk_id": "negative", "grade": 0, "features": [.2, 0, .2, .4]}]} for _ in range(25)]}
    model = train(training)
    assert model.checksum == train(training).checksum
    assert model.training["loss_every_25_steps"][-1] < model.training["loss_every_25_steps"][0]
    training["split"] = "validation"
    with pytest.raises(ValueError, match="train-only"):
        train(training)
