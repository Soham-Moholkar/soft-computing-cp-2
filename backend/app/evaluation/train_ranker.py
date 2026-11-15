"""Deterministic pairwise fitting on train-only retrieved candidate features."""
import argparse
import json
from math import exp, log1p
from pathlib import Path
from random import Random

from app.retrieval.ranker import FEATURE_VERSION, seal


def train(report, steps=300):
    if report["split"] != "train" or report["test_unlocked"] or report.get("ranker_sha256"):
        raise ValueError("Training requires an unmodified train-only baseline report")
    if report.get("feature_version") != FEATURE_VERSION:
        raise ValueError("Missing or incompatible captured features")
    if any(row["failed"] for row in report["records"]):
        raise ValueError("Training report has failed requests")
    pairs, used, skipped = [], 0, 0
    random = Random(report["seed"])
    for row in report["records"]:
        if row["mode"] != "hybrid" or not row["answerable"]:
            continue
        candidates = row.get("candidates", [])
        positive = [item for item in candidates if item["grade"] > 0]
        negative = sorted([item for item in candidates if item["grade"] == 0], key=lambda item: (-item["features"][0], item["chunk_id"]))[:5]
        if not positive or not negative:
            skipped += 1
            continue
        used += 1
        for good in positive:
            for bad in negative:
                pairs.append(tuple(a - b for a, b in zip(good["features"], bad["features"], strict=True)))
    if len(pairs) < 20:
        raise ValueError("At least 20 train-only positive/negative pairs are required")
    random.shuffle(pairs)
    baseline = (0.6, 0.25, 0.15, 0)
    weights = list(baseline)
    learning_rate, regularization = 0.2, 0.01
    def loss(w):
        return sum(log1p(exp(-sum(a * b for a, b in zip(w, difference)))) for difference in pairs) / len(pairs) + regularization * sum((a - b) ** 2 for a, b in zip(w, baseline)) / 2
    history = [loss(weights)]
    for step in range(steps):
        gradient = [regularization * (weight - original) for weight, original in zip(weights, baseline)]
        for difference in pairs:
            factor = 1 / (1 + exp(sum(a * b for a, b in zip(weights, difference))))
            for index, value in enumerate(difference):
                gradient[index] -= value * factor / len(pairs)
        # Euclidean projection onto a simplex, not normalize-after-clipping.
        proposed = [weight - learning_rate * derivative for weight, derivative in zip(weights, gradient)]
        ordered = sorted(proposed, reverse=True)
        rho = max(index for index in range(4) if ordered[index] - (sum(ordered[:index + 1]) - 1) / (index + 1) > 0)
        theta = (sum(ordered[:rho + 1]) - 1) / (rho + 1)
        weights = [max(value - theta, 0) for value in proposed]
        if (step + 1) % 25 == 0:
            history.append(loss(weights))
    return seal({"schema_version": "1", "feature_version": FEATURE_VERSION, "status": "candidate",
                 "domain": report["domain"], "weights": weights, "dataset_sha256": report["dataset_sha256"],
                 "training_code_sha256": report["code_sha256"], "seed": report["seed"],
                 "training": {"method": "projected full-batch pairwise logistic loss with L2-to-baseline", "steps": steps,
                              "learning_rate": learning_rate, "regularization": regularization, "pairs": len(pairs),
                              "queries_used": used, "queries_skipped_missing_pair": skipped,
                              "train_review_status": report["review_status"], "train_family_count": report["leakage_audit"]["family_counts"]["train"],
                              "loss_every_25_steps": history, "baseline_weights": baseline,
                              "limitations": "Non-judged candidates are treated as negatives; independent corpus-wide judgment pooling is required before promotion."}, "promotion": None})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Artifact already exists; preserve model versions")
    artifact = train(json.loads(args.report.read_text(encoding="utf-8")))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(artifact.model_dump_json(indent=2) + "\n", encoding="utf-8")
    print(f"Candidate {artifact.checksum}; weights={artifact.weights}; pairs={artifact.training['pairs']}")
