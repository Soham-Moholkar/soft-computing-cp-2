import copy
import json
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.factory import create_app
from app.optimization import service
from app.optimization.engine import ALGORITHMS, FeatureObjective, optimize, train_neuro_fuzzy
from test_graph_construction import ingest, build


def bank(split="validation"):
    rows = [{"mode": "hybrid", "query_id": f"q-{i}", "family": f"f-{i}", "answerable": True, "failed": False,
             "gold_grades": {f"good-{i}": 2},
             "candidates": [{"chunk_id": f"good-{i}", "grade": 2, "features": [.2, 1., .8, .7]},
                            {"chunk_id": f"bad-{i}", "grade": 0, "features": [.95, 0., .2, .5]}]} for i in range(25)]
    return {"split": split, "test_unlocked": False, "ranker_sha256": None, "feature_version": "ranking-features-1",
            "records": rows, "top_k": 1, "dataset_sha256": "a" * 64, "code_sha256": "b" * 64,
            "domain": "soft-computing-course", "dataset_version": "test-fixture", "review_status": "unreviewed_synthetic",
            "summary": {"hybrid": {"latency_p95_ms": 20}}, "extraction": None}


@pytest.mark.parametrize("algorithm", ALGORITHMS)
def test_real_search_is_seeded_budgeted_and_monotone(algorithm):
    objective = FeatureObjective(bank())
    first, second = optimize(objective, algorithm, budget=32), optimize(objective, algorithm, budget=32)
    assert first["trace"] == second["trace"]
    assert first["evaluations"] == 32 == len(first["trace"])
    assert first["best_metrics"]["fitness"] >= first["baseline_metrics"]["fitness"]
    best = [row["best_fitness"] for row in first["trace"]]
    assert best == sorted(best)
    assert all(row["constraint_violations"] == 0 and sum(row["vector"]) == pytest.approx(1) for row in first["trace"])
    if algorithm == "GA_PSO": assert {row["phase"] for row in first["trace"]} == {"GA", "PSO"}
    if algorithm == "FUZZY_GA": assert any("low_diversity_membership" in row for row in first["trace"])


def test_bank_keeps_missing_gold_and_refuses_test_or_invalid_features():
    report = bank()
    report["records"][0]["gold_grades"]["missed-by-candidates"] = 2
    objective = FeatureObjective(report)
    assert objective.score([0, 1, 0, 0])["recall_at_k"] < 1
    report["split"] = "test"
    with pytest.raises(ValueError, match="test features"): FeatureObjective(report)
    report = bank(); report["records"][0]["candidates"][0]["features"][0] = float("nan")
    with pytest.raises(ValueError, match="finite"): FeatureObjective(report)


def test_neuro_fuzzy_learns_only_training_preferences():
    first = train_neuro_fuzzy(bank("train"), bank(), seed=19, steps=40)
    second = train_neuro_fuzzy(bank("train"), bank(), seed=19, steps=40)
    assert first == second and first["status"] == "candidate"
    assert first["trace"][-1]["train_pairwise_loss"] < first["trace"][0]["train_pairwise_loss"]
    assert len(first["best_vector"]) == 9 and all(0 <= value <= 1 for value in first["best_vector"])
    with pytest.raises(ValueError, match="train-only"): train_neuro_fuzzy(bank(), bank())


def test_job_persistence_and_real_aco_evidence(tmp_path, monkeypatch):
    banks = {}
    for split in ("train", "validation"):
        path = tmp_path / f"{split}.json"; path.write_text(json.dumps(bank(split)))
        banks[split] = path
    monkeypatch.setitem(service.BANK_PATHS, "synthetic", banks)
    database = str(tmp_path / "sources.sqlite3")
    with TestClient(create_app(database_path=database)) as client:
        response = client.post("/api/optimization/jobs", json={"algorithm": "PSO", "evaluation_budget": 16})
        assert response.status_code == 202
        identifier = response.json()["job_id"]
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            job = client.get(f"/api/optimization/jobs/{identifier}").json()
            if job["status"] in {"completed", "failed"}: break
            time.sleep(.01)
        assert job["status"] == "completed" and job["result"]["evaluations"] == 16
        assert job["artifact"]["status"] == "candidate"
        doc = ingest(client, "path", "PSO improves Hybrid Retrieval. Hybrid Retrieval uses Knowledge Graph.")
        build(client, doc)
        nodes = client.get("/api/graph").json()["entities"]
        ids = {node["canonical_name"]: node["entity_id"] for node in nodes}
        data = {"source_entity": ids["Particle Swarm Optimization"], "target_entity": ids["Knowledge Graph"]}
        result = client.post("/api/aco/search", json=data).json()
        assert result["paths"][0]["labels"] == ["Particle Swarm Optimization", "Hybrid Retrieval", "Knowledge Graph"]
        assert result["paths"][0]["source_chunks"] and result["evaluations"] == 144
        assert client.post("/api/aco/search", json={**data, "source_entity": "missing"}).status_code == 422
    with TestClient(create_app(database_path=database)) as client:
        assert client.get(f"/api/optimization/jobs/{identifier}").json() == job
