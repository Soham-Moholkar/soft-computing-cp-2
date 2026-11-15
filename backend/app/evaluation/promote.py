"""Evidence-gated artifact promotion. A missing gate is rejection, never success."""
import argparse
import json
import math
import re
from pathlib import Path

from app.evaluation.metrics import summarize, quality_summary
from app.evaluation.dataset import load_dataset, query_clusters
from app.retrieval.ranker import load_ranker, seal, digest, PROMOTION_POLICY_VERSION

POLICY = {"version": PROMOTION_POLICY_VERSION, "domain": "soft-computing-course", "min_families": 5,
          "min_answerable": 30, "min_no_answer": 20, "min_ndcg_gain": 0.01,
          "min_answerability": 0.9, "max_false_evidence_rate": 0.05, "max_p95_ms": 150}


def report_errors(report):
    errors = []
    if report.get("report_schema") != "2":
        errors.append("unsupported or missing report schema")
    for key in ("dataset_sha256", "code_sha256"):
        if not re.fullmatch(r"[a-f0-9]{64}", str(report.get(key, ""))):
            errors.append(f"missing or invalid {key}")
    protocol = report.get("latency_protocol", {})
    repeats = protocol.get("warm_repeats_per_query")
    if type(repeats) is not int or not 1 <= repeats <= 20 or not protocol.get("mode_order") or not protocol.get("reported_percentiles"):
        errors.append("missing latency measurement protocol")
    rows = [row for row in report.get("records", []) if row.get("mode") == "hybrid"]
    identifiers = [row.get("query_id") for row in rows]
    if not rows or any(not isinstance(value, str) or not value.strip() for value in identifiers) or len(set(identifiers)) != len(rows):
        errors.append("missing or duplicate hybrid query records")
    try:
        for row in rows:
            if type(row["answerable"]) is not bool or type(row["failed"]) is not bool or not row.get("family"):
                raise ValueError("invalid annotation fields")
            if not row["failed"] and (type(row["abstained"]) is not bool or type(row["relevant_evidence_returned"]) is not bool):
                raise ValueError("missing response outcomes")
            if row.get("citation_integrity") is not None and type(row["citation_integrity"]) is not bool:
                raise ValueError("invalid citation integrity")
            if len(row["latency_samples_ms"]) != repeats or any(not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 for value in row["latency_samples_ms"]):
                raise ValueError("missing or invalid latency samples")
            if row["answerable"] and (not math.isfinite(row["metrics"]["ndcg_at_k"]) or not 0 <= row["metrics"]["ndcg_at_k"] <= 1):
                raise ValueError("invalid NDCG")
        computed = quality_summary(rows)
        summary = report["summary"]["hybrid"]
        for key, value in computed.items():
            reported = summary.get(key)
            if (value is None and reported is not None) or (value is not None and (not isinstance(reported, (int, float)) or not math.isfinite(reported) or not math.isclose(value, reported, abs_tol=1e-9))):
                errors.append(f"aggregate {key} does not match per-query records")
    except (KeyError, TypeError, ValueError):
        errors.append("per-query quality/latency evidence is incomplete or invalid")
    return errors


def manifest_errors(dataset, fingerprint, report):
    queries = [query for query in dataset.queries if query.split == report["split"]]
    sources = [source for source in dataset.sources if source.split == report["split"]]
    clusters = query_clusters(sources, queries)
    expected = {query.id: query for query in queries}
    rows = [row for row in report["records"] if row["mode"] == "hybrid"]
    if report.get("dataset_sha256") != fingerprint or len(rows) != len(expected) or {row["query_id"] for row in rows} != set(expected):
        return ["Report does not cover the exact dataset partition and fingerprint"]
    if any(row["answerable"] != expected[row["query_id"]].answerable or row["family"] != clusters[row["query_id"]] for row in rows):
        return ["Report annotations or independent clusters disagree with the dataset manifest"]
    return []


def decision(artifact, validation_baseline, validation_candidate, test_baseline=None, test_candidate=None):
    reasons, comparisons = [], {}
    if artifact.domain != POLICY["domain"]:
        reasons.append("Candidate training domain does not match the production course domain")
    reports = [("validation", validation_baseline, validation_candidate), ("test", test_baseline, test_candidate)]
    for split, baseline, candidate in reports:
        if baseline is None or candidate is None:
            reasons.append(f"Missing frozen {split} baseline/candidate comparison")
            continue
        invalid = [(label, error) for label, report in (("baseline", baseline), ("candidate", candidate)) for error in report_errors(report)]
        if invalid:
            reasons.extend(f"Invalid {split} {label} report: {error}" for label, error in invalid)
            continue
        if baseline["split"] != split or candidate["split"] != split:
            reasons.append(f"Invalid {split} report partition")
        if split == "test" and not (baseline.get("test_unlocked") and candidate.get("test_unlocked")):
            reasons.append("Final test comparison was not explicitly unlocked")
        for key in ("dataset_sha256", "code_sha256", "top_k", "seed", "latency_protocol", "environment"):
            # Cold build time is observational and will differ between runs.
            left, right = baseline.get(key), candidate.get(key)
            if key == "latency_protocol":
                left = {name: value for name, value in (left or {}).items() if name != "cold_index_build_ms"}
                right = {name: value for name, value in (right or {}).items() if name != "cold_index_build_ms"}
            if left != right:
                reasons.append(f"Unmatched {split} comparison metadata: {key}")
        if baseline.get("ranker_sha256") is not None or candidate.get("ranker_sha256") != artifact.checksum:
            reasons.append(f"{split} comparison does not identify this candidate and the default baseline")
        if candidate["dataset_sha256"] != artifact.dataset_sha256:
            reasons.append(f"{split} report uses a different dataset from training")
        if candidate["code_sha256"] != artifact.training_code_sha256:
            reasons.append(f"{split} inference code differs from the recorded training code")
        if candidate.get("seed") != artifact.seed:
            reasons.append(f"{split} seed differs from the recorded training seed")
        old_rows = {row["query_id"]: row for row in baseline["records"] if row["mode"] == "hybrid"}
        new_rows = {row["query_id"]: row for row in candidate["records"] if row["mode"] == "hybrid"}
        if old_rows.keys() != new_rows.keys() or any((old_rows[key]["answerable"], old_rows[key]["family"]) != (new_rows[key]["answerable"], new_rows[key]["family"]) for key in old_rows.keys() & new_rows.keys()):
            reasons.append(f"Unmatched {split} query set or answerability/family annotations")
        for report in (baseline, candidate):
            if report.get("review_status") != "human_reviewed" or not report.get("adaptation_reviewed") or not report.get("reviewers"):
                reasons.append(f"{split} annotations/adaptation have not been independently reviewed")
            if report.get("domain") != POLICY["domain"]:
                reasons.append(f"{split} evaluation domain is not the production course domain")
            if report.get("leakage_audit", {}).get("near_duplicate_sources") or report.get("leakage_audit", {}).get("shared_cross_split_facts"):
                reasons.append(f"{split} leakage audit has unresolved source overlap")
        summary = candidate["summary"]["hybrid"]
        if baseline["summary"]["hybrid"].get("failure_rate") != 0:
            reasons.append(f"{split} baseline request failures invalidate the paired comparison")
        hybrid_rows = [row for row in candidate["records"] if row["mode"] == "hybrid"]
        if (sum(row["answerable"] for row in hybrid_rows) != summary.get("answerable_queries")
                or sum(not row["answerable"] for row in hybrid_rows) != summary.get("no_answer_queries")
                or any(row["failed"] for row in hybrid_rows)):
            reasons.append(f"{split} record counts/failures do not support the reported quality gates")
        for key, threshold, direction in (("answerable_queries", POLICY["min_answerable"], "min"), ("no_answer_queries", POLICY["min_no_answer"], "min"),
                                           ("answerability_accuracy", POLICY["min_answerability"], "min"), ("false_evidence_rate_on_no_answer", POLICY["max_false_evidence_rate"], "max"),
                                           ("latency_p95_ms", POLICY["max_p95_ms"], "max")):
            value = summary.get(key)
            if value is None or (value < threshold if direction == "min" else value > threshold):
                reasons.append(f"{split} gate failed: {key}={value}, {direction}={threshold}")
        if summary.get("failure_rate") != 0 or summary.get("citation_integrity") != 1:
            reasons.append(f"{split} requests must have zero failures and complete citation integrity")
        if summary.get("answerable_response_with_relevant_evidence_rate", 0) < POLICY["min_answerability"]:
            reasons.append(f"{split} relevant non-abstaining response coverage is below target")
        old = {row["query_id"]: row for row in baseline["records"] if row["mode"] == "hybrid" and row["answerable"]}
        new = {row["query_id"]: row for row in candidate["records"] if row["mode"] == "hybrid" and row["answerable"]}
        if old.keys() != new.keys() or not old or any(old[key]["family"] != new[key]["family"] for key in old):
            reasons.append(f"Unmatched {split} per-query comparison")
            continue
        keys = sorted(old)
        differences = [new[key]["metrics"]["ndcg_at_k"] - old[key]["metrics"]["ndcg_at_k"] for key in keys]
        estimate = summarize(differences, candidate["seed"], families=[new[key]["family"] for key in keys])
        comparisons[split] = estimate
        if estimate["families"] < POLICY["min_families"] or estimate["mean"] < POLICY["min_ndcg_gain"] or not estimate["bootstrap_95_ci"] or estimate["bootstrap_95_ci"][0] <= 0:
            reasons.append(f"{split} paired family-cluster NDCG gain is not established")
    return {"accepted": not reasons, "candidate_checksum": artifact.checksum, "policy": POLICY,
            "reasons": sorted(set(reasons)), "paired_ndcg_comparisons": comparisons,
            "report_digests": {split: {"baseline": digest(baseline), "candidate": digest(candidate)} for split, baseline, candidate in reports if baseline is not None and candidate is not None},
            "reports": {split: {"baseline": baseline.get("code_sha256") if baseline else None, "candidate": candidate.get("code_sha256") if candidate else None} for split, baseline, candidate in reports}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", type=Path, required=True)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--validation-baseline", type=Path, required=True)
    parser.add_argument("--validation-candidate", type=Path, required=True)
    parser.add_argument("--test-baseline", type=Path)
    parser.add_argument("--test-candidate", type=Path)
    parser.add_argument("--decision", type=Path, required=True)
    parser.add_argument("--promoted-output", type=Path)
    args = parser.parse_args()
    if args.decision.exists() or args.promoted_output and args.promoted_output.exists():
        parser.error("Preserve existing decisions and artifacts; choose new output paths")
    def read(path):
        return json.loads(path.read_text(encoding="utf-8")) if path else None
    artifact = load_ranker(args.artifact, allow_candidate=True)
    reports = [read(path) for path in (args.validation_baseline, args.validation_candidate, args.test_baseline, args.test_candidate)]
    result = decision(artifact, *reports)
    dataset, fingerprint = load_dataset(args.dataset)
    if fingerprint != artifact.dataset_sha256 or dataset.review_status != "human_reviewed" or not dataset.adaptation_reviewed or dataset.domain != POLICY["domain"]:
        result["accepted"] = False
        result["reasons"].append("Dataset manifest does not provide matching, independently reviewed course-domain evidence")
    for report in reports:
        if report:
            errors = manifest_errors(dataset, fingerprint, report)
            if errors:
                result["accepted"] = False
                result["reasons"].extend(errors)
    args.decision.parent.mkdir(parents=True, exist_ok=True)
    args.decision.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    if result["accepted"] and args.promoted_output:
        promoted = seal({**artifact.model_dump(), "status": "promoted", "promotion": result})
        args.promoted_output.parent.mkdir(parents=True, exist_ok=True)
        args.promoted_output.write_text(promoted.model_dump_json(indent=2) + "\n", encoding="utf-8")
    print("Promoted" if result["accepted"] and args.promoted_output else "Eligible for promotion" if result["accepted"] else "Rejected: " + "; ".join(result["reasons"]))
