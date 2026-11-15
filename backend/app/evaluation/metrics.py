"""Metrics use explicit denominators and keep no-answer cases separate."""
from math import log2
from random import Random
from statistics import mean


def quality_summary(rows):
    """Derive response/latency gates from request records, never cached aggregates."""
    positive = [row for row in rows if row["answerable"]]
    negative = [row for row in rows if not row["answerable"]]
    cited = [row for row in rows if row.get("citation_integrity") is not None]
    successful = lambda row: not row["failed"]
    latencies = [value for row in rows for value in row["latency_samples_ms"]]
    return {"queries": len(rows), "answerable_queries": len(positive), "no_answer_queries": len(negative),
            "answerability_accuracy": sum(successful(row) and row.get("abstained") != row["answerable"] for row in rows) / len(rows) if rows else None,
            "no_answer_abstention_rate": sum(successful(row) and row.get("abstained", False) for row in negative) / len(negative) if negative else None,
            "false_evidence_rate_on_no_answer": sum(successful(row) and not row.get("abstained", True) for row in negative) / len(negative) if negative else None,
            "answerable_evidence_coverage": sum(successful(row) and row.get("relevant_evidence_returned", False) for row in positive) / len(positive) if positive else None,
            "answerable_response_with_relevant_evidence_rate": sum(successful(row) and not row.get("abstained", True) and row.get("relevant_evidence_returned", False) for row in positive) / len(positive) if positive else None,
            "citation_integrity": sum(row["citation_integrity"] for row in cited) / len(cited) if cited else None,
            "cited_queries": len(cited), "failure_rate": sum(row["failed"] for row in rows) / len(rows) if rows else None,
            "latency_p50_ms": percentile(latencies, .5), "latency_p95_ms": percentile(latencies, .95)}


def retrieval_metrics(ranked: list[str], grades: dict[str, int], k: int) -> dict[str, float]:
    if k < 1 or not grades:
        raise ValueError("Positive K and at least one relevant item are required")
    if len(set(ranked)) != len(ranked):
        raise ValueError("Duplicate retrieved IDs")
    selected = ranked[:k]
    hits = sum(item in grades for item in selected)
    precision, recall = hits / k, hits / len(grades)
    dcg = sum((2 ** grades.get(item, 0) - 1) / log2(rank + 2) for rank, item in enumerate(selected))
    ideal = sum((2 ** grade - 1) / log2(rank + 2) for rank, grade in enumerate(sorted(grades.values(), reverse=True)[:k]))
    return {"precision_at_k": precision, "recall_at_k": recall,
            "f1_at_k": 2 * precision * recall / (precision + recall) if precision + recall else 0,
            "mrr_at_k": next((1 / (rank + 1) for rank, item in enumerate(selected) if item in grades), 0),
            "ndcg_at_k": dcg / ideal if ideal else 0}


def set_metrics(predicted: set, gold: set) -> dict:
    tp, fp, fn = len(predicted & gold), len(predicted - gold), len(gold - predicted)
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    return {"tp": tp, "fp": fp, "fn": fn, "precision": precision, "recall": recall,
            "f1": 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else None}


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    low = int(position)
    return ordered[low] + (ordered[min(low + 1, len(ordered) - 1)] - ordered[low]) * (position - low)


def summarize(values: list[float], seed: int, samples: int = 2000, families: list[str] | None = None) -> dict:
    if not values:
        return {"n": 0, "families": 0, "mean": None, "bootstrap_95_ci": None, "ci_status": "no_observations"}
    if families is not None and len(families) != len(values):
        raise ValueError("One family is required for each observation")
    clusters = {}
    for index, value in enumerate(values):
        clusters.setdefault(families[index] if families is not None else str(index), []).append(value)
    if len(clusters) < 5:
        return {"n": len(values), "families": len(clusters), "mean": mean(values),
                "bootstrap_95_ci": None, "ci_status": "insufficient_independent_families_minimum_5",
                "method": "source-family cluster bootstrap; query-weighted mean", "samples": samples}
    random = Random(seed)
    keys = sorted(clusters)
    means = [mean([value for key in random.choices(keys, k=len(keys)) for value in clusters[key]]) for _ in range(samples)]
    return {"n": len(values), "families": len(clusters), "mean": mean(values),
            "bootstrap_95_ci": [percentile(means, 0.025), percentile(means, 0.975)],
            "method": "source-family cluster bootstrap; query-weighted mean", "samples": samples, "ci_status": "estimated"}
