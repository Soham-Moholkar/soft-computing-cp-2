import copy
import math
import os
import subprocess
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.evaluation.dataset import Dataset, load_dataset
from app.evaluation.metrics import retrieval_metrics, set_metrics, summarize
from app.evaluation.run import evaluate

DATASET = Path(__file__).resolve().parents[1] / "evaluation" / "synthetic-course-v1.json"


def test_ranking_metrics_use_k_denominator_and_graded_discount():
    metrics = retrieval_metrics(["noise", "second", "first"], {"first": 2, "second": 1}, 3)
    assert metrics["precision_at_k"] == pytest.approx(2 / 3)
    assert metrics["recall_at_k"] == 1
    assert metrics["mrr_at_k"] == 0.5
    assert metrics["ndcg_at_k"] == pytest.approx((1 / math.log2(3) + 3 / math.log2(4)) / (3 + 1 / math.log2(3)))
    assert retrieval_metrics(["first"], {"first": 2}, 3)["precision_at_k"] == pytest.approx(1 / 3)
    assert retrieval_metrics([], {"first": 2}, 3)["recall_at_k"] == 0
    with pytest.raises(ValueError, match="Duplicate"):
        retrieval_metrics(["first", "first"], {"first": 2}, 3)


def test_empty_denominators_are_unavailable_and_bootstrap_is_seeded():
    assert set_metrics(set(), set())["f1"] is None
    assert set_metrics({"incorrect"}, {"correct"})["f1"] == 0
    assert summarize([], 1729)["mean"] is None
    assert summarize([0, 0.5, 1], 1729) == summarize([0, 0.5, 1], 1729)


def test_dataset_rejects_family_text_and_query_leakage():
    dataset, fingerprint = load_dataset(DATASET)
    assert len(fingerprint) == 64
    raw = dataset.model_dump()
    val_index = next(index for index, source in enumerate(raw["sources"]) if source["split"] == "validation")
    leaked = copy.deepcopy(raw)
    leaked["sources"][val_index]["family"] = raw["sources"][0]["family"]
    with pytest.raises(ValidationError, match="leaks"):
        Dataset.model_validate(leaked)
    leaked = copy.deepcopy(raw)
    leaked["sources"][val_index].update({key: raw["sources"][0][key] for key in ("text", "mentions", "relations")})
    with pytest.raises(ValidationError, match="leaks"):
        Dataset.model_validate(leaked)
    leaked = copy.deepcopy(raw)
    val_query = next(query for query in leaked["queries"] if query["split"] == "validation")
    val_query["text"] = leaked["queries"][0]["text"]
    with pytest.raises(ValidationError, match="query text leaks"):
        Dataset.model_validate(leaked)


def test_dataset_rejects_cross_split_evidence_and_uncredited_review():
    dataset, _ = load_dataset(DATASET)
    raw = dataset.model_dump()
    raw["queries"][0]["judgments"][0]["source_id"] = "val-genetic"
    with pytest.raises(ValidationError, match="cross-split"):
        Dataset.model_validate(raw)
    raw = dataset.model_dump()
    raw["review_status"] = "human_reviewed"
    with pytest.raises(ValidationError, match="reviewers"):
        Dataset.model_validate(raw)


def test_near_duplicate_sources_cannot_evade_family_ids():
    dataset, _ = load_dataset(DATASET)
    raw = dataset.model_dump()
    train_source = raw["sources"][0]
    validation_source = next(source for source in raw["sources"] if source["split"] == "validation")
    validation_source["text"] = train_source["text"] + " A small superficial revision is appended."
    validation_source["mentions"] = train_source["mentions"]
    validation_source["relations"] = train_source["relations"]
    with pytest.raises(ValidationError, match="Near-duplicate"):
        Dataset.model_validate(raw)


def test_query_family_leakage_is_rejected_even_with_different_wording():
    dataset, _ = load_dataset(DATASET)
    raw = dataset.model_dump()
    validation_query = next(query for query in raw["queries"] if query["split"] == "validation")
    validation_query["family"] = raw["sources"][0]["family"]
    with pytest.raises(ValidationError, match="Query family leaks"):
        Dataset.model_validate(raw)


def test_locked_test_requires_explicit_final_comparison():
    with pytest.raises(ValueError, match="Locked test"):
        evaluate(DATASET, split="test")


def test_evaluator_import_does_not_open_live_database(tmp_path):
    forbidden = tmp_path / "must-not-exist" / "live.sqlite3"
    environment = {**os.environ, "SOFTGRAPH_INGESTION_DB": str(forbidden)}
    result = subprocess.run([sys.executable, "-c", "import app.evaluation.run"],
                            cwd=DATASET.parents[1], env=environment, capture_output=True, text=True, timeout=20)
    assert result.returncode == 0, result.stderr
    assert not forbidden.parent.exists()


def test_baseline_runs_are_isolated_and_reproduce_rankings_and_metrics():
    first, second = evaluate(DATASET), evaluate(DATASET)
    assert first["dataset_sha256"] == second["dataset_sha256"]
    assert first["code_sha256"] == second["code_sha256"]
    assert first["extraction"] == second["extraction"]
    assert len(first["records"]) == 40
    for left, right in zip(first["records"], second["records"], strict=True):
        assert not left["failed"]
        assert left["ranked_chunks"] == right["ranked_chunks"]
        assert left["metrics"] == right["metrics"]
        assert left["versions"] == right["versions"]
        assert left["answerability_correct"] == right["answerability_correct"]
    # Negated source evidence can be returned with abstention in graph mode.
    negative = next(row for row in first["records"] if row["query_id"] == "val-q4" and row["mode"] == "graph")
    assert negative["abstained"] and negative["citation_integrity"]
    # Open-domain concept labels expose a real fixed-ontology recall gap.
    assert first["extraction"]["mentions"]["fn"] > 0
    assert first["extraction"]["relations"]["fn"] > 0
