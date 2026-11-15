"""Run with python -m app.evaluation.run from backend/."""
import argparse
import json
import platform
import tempfile
import time
from random import Random
from statistics import median
from hashlib import sha256
from importlib.metadata import distributions, version
from pathlib import Path

from fastapi.testclient import TestClient

from app.evaluation.dataset import load_dataset, query_clusters
from app.evaluation.metrics import retrieval_metrics, set_metrics, summarize, quality_summary
from app.factory import create_app
from app.evaluation.leakage import audit
from app.retrieval.ranker import load_ranker, FEATURE_VERSION
from app.retrieval.service import terms

MODES = ("lexical", "graph", "fuzzy", "hybrid")


def checked(response):
    response.raise_for_status()
    return response.json()


def ingest(client, source):
    accepted = checked(client.post("/api/ingestion/upload", json={
        "source_type": "paste", "name": source.id, "domain": "evaluation", "text": source.text,
        "chunk_size": 400, "chunk_overlap": 0,
    }))
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        job = checked(client.get(f"/api/ingestion/jobs/{accepted['job_id']}"))
        if job["status"] == "completed":
            return accepted["document_id"]
        if job["status"] == "failed":
            raise RuntimeError(f"Evaluation ingestion failed: {job['error']}")
        time.sleep(0.01)
    raise TimeoutError("Evaluation ingestion exceeded 30 seconds")


def evaluate(dataset_path: Path, split="validation", k=3, unlock_test=False, ranker_path=None, capture_features=False, latency_repeats=3) -> dict:
    if split not in {"train", "validation", "test"} or not 1 <= k <= 10:
        raise ValueError("Invalid split or K")
    if split == "test" and not unlock_test:
        raise ValueError("Locked test evaluation requires --unlock-test for final comparison")
    if not 1 <= latency_repeats <= 20:
        raise ValueError("Latency repeats must be 1-20")
    dataset, fingerprint = load_dataset(dataset_path)
    sources = [source for source in dataset.sources if source.split == split]
    queries = [query for query in dataset.queries if query.split == split]
    if not queries:
        raise ValueError(f"No queries in {split}")
    predicted_mentions, gold_mentions, predicted_relations, gold_relations = set(), set(), set(), set()
    resolved, resolution_total = 0, 0
    records, chunks, logical = [], {}, {}
    leakage = audit(dataset.sources, dataset.queries)
    # Unite overlapping evidence families rather than treating mixed-source queries
    # as an independent third cluster. No-answer queries use their annotated family.
    clusters = query_clusters(sources, queries)
    feature_rows = {}
    # A private temporary DB ensures source-separated corpora and protects live data.
    with tempfile.TemporaryDirectory(prefix="softgraph-eval-") as directory:
        with TestClient(create_app(database_path=str(Path(directory) / "evaluation.sqlite3"), enable_optimizers=False)) as client:
            if ranker_path:
                client.app.state.retrieval_service.ranker = load_ranker(Path(ranker_path), allow_candidate=True)
            if capture_features:
                def observe(request, candidates):
                    if request.mode == "hybrid":
                        qterms = set(terms(request.query))
                        feature_rows[request.query] = [{"chunk_id": item.chunk_id, "source_id": logical[item.document_id],
                                                       "features": [item.lexical_score, item.graph_score, item.fuzzy_score, len(qterms & terms(item.text).keys()) / max(1, len(qterms))]} for item in candidates]
                client.app.state.retrieval_service.candidate_observer = observe
            for source in sources:
                document_id = ingest(client, source)
                logical[document_id] = source.id
                checked(client.post("/api/graph/build", json={"document_ids": [document_id]}))
                offset = 0
                while True:
                    page = checked(client.get(f"/api/ingestion/documents/{document_id}", params={"offset": offset, "limit": 100}))
                    chunks.update({chunk["chunk_id"]: chunk for chunk in page["chunks"]})
                    if page["next_offset"] is None:
                        break
                    offset = page["next_offset"]
                extraction = checked(client.get(f"/api/graph/documents/{document_id}"))
                mention_names = {mention["entity_id"]: mention["canonical_name"] for mention in extraction["mentions"]}
                accepted = [mention for mention in extraction["mentions"] if mention["accepted"]]
                predicted_mentions.update((source.id, item["start_offset"], item["end_offset"], item["canonical_name"]) for item in accepted)
                gold_mentions.update((source.id, item.start, item.end, item.canonical_name) for item in source.mentions)
                by_span = {(item["start_offset"], item["end_offset"]): item["canonical_name"] for item in accepted}
                resolved += sum(by_span.get((item.start, item.end)) == item.canonical_name for item in source.mentions)
                resolution_total += len(source.mentions)
                predicted_relations.update((source.id, mention_names[item["source_entity"]], item["relation_type"], mention_names[item["target_entity"]])
                                           for item in extraction["relation_candidates"] if item["accepted"])
                gold_relations.update((source.id, item.source, item.predicate, item.target) for item in source.relations)
            health = checked(client.get("/health"))
            cold_start = time.perf_counter()
            client.app.state.retrieval_service.corpus()
            cold_index_build_ms = (time.perf_counter() - cold_start) * 1000
            schedule = [(mode, query) for mode in MODES for query in queries]
            Random(dataset.seed).shuffle(schedule)
            for mode, query in schedule:
                    # Gold excerpts identify stable relevant chunks; grade overlaps use max.
                    grades = {}
                    for judgment in query.judgments:
                        matches = [identifier for identifier, chunk in chunks.items()
                                   if logical[chunk["document_id"]] == judgment.source_id and judgment.excerpt in chunk["text"]]
                        if not matches:
                            raise ValueError(f"Gold excerpt crosses chunk boundaries: {query.id}")
                        for identifier in matches:
                            grades[identifier] = max(grades.get(identifier, 0), judgment.grade)
                    start = time.perf_counter()
                    record = {"query_id": query.id, "family": clusters[query.id], "category": query.category, "mode": mode, "answerable": query.answerable}
                    measurements = []
                    try:
                        result = checked(client.post("/api/retrieve", json={"query": query.text, "mode": mode, "top_k": k, "max_hops": 4, "use_provider": False}))
                        initial_ms = (time.perf_counter() - start) * 1000
                        for _ in range(latency_repeats):
                            repeat_start = time.perf_counter()
                            checked(client.post("/api/retrieve", json={"query": query.text, "mode": mode, "top_k": k, "max_hops": 4, "use_provider": False}))
                            measurements.append((time.perf_counter() - repeat_start) * 1000)
                        evidence = result["evidence"]
                        ranked = [item["chunk_id"] for item in evidence]
                        abstained = result["answer_status"] == "insufficient_evidence"
                        valid = len(set(ranked)) == len(ranked) and all(item["chunk_id"] in chunks and item["text"] == chunks[item["chunk_id"]]["text"]
                                    and item["document_id"] == chunks[item["chunk_id"]]["document_id"]
                                    and item["source_location"] == chunks[item["chunk_id"]]["source_location"]
                                    and item["excerpt"] in item["text"] and item["citation"] == index
                                    and (abstained or f"[{item['citation']}]" in result["answer"])
                                    for index, item in enumerate(evidence, 1))
                        record.update({"failed": False, "abstained": abstained,
                                       "answerability_correct": abstained != query.answerable,
                                       "citation_integrity": valid if evidence else None,
                                       "relevant_evidence_returned": any(identifier in grades for identifier in ranked),
                                       "ranked_chunks": ranked,
                                       "ranked_sources": [logical[item["document_id"]] for item in evidence],
                                       "versions": {key: result[key] for key in ("graph_version", "index_version", "configuration_version")},
                                       "metrics": retrieval_metrics(ranked, grades, k) if query.answerable else None})
                        if capture_features and mode == "hybrid":
                            record["candidates"] = [{**row, "grade": grades.get(row["chunk_id"], 0)} for row in feature_rows.get(query.text, [])]
                            record["gold_grades"] = grades
                        if not valid:
                            raise RuntimeError("Citation integrity failed")
                    except Exception as error:
                        record.update({"failed": True, "error": str(error), "answerability_correct": False,
                                       "metrics": retrieval_metrics([], grades, k) if query.answerable else None})
                    record["latency_ms"] = median(measurements) if measurements else (time.perf_counter() - start) * 1000
                    record["latency_samples_ms"] = measurements
                    record["initial_request_ms"] = initial_ms if measurements else None
                    records.append(record)
    records.sort(key=lambda row: (row["mode"], row["query_id"]))
    summaries = {}
    for mode in MODES:
        rows = [row for row in records if row["mode"] == mode]
        positive = [row for row in rows if row["answerable"]]
        summaries[mode] = {
            **quality_summary(rows),
            "retrieval": {key: summarize([row["metrics"][key] for row in positive], dataset.seed, families=[row["family"] for row in positive])
                          for key in ("precision_at_k", "recall_at_k", "f1_at_k", "mrr_at_k", "ndcg_at_k")},
            "categories": {category: {"n": len([row for row in rows if row["category"] == category]),
                                      "answerability_accuracy": sum(row["answerability_correct"] for row in rows if row["category"] == category) / len([row for row in rows if row["category"] == category])} for category in sorted({row["category"] for row in rows})},
        }
    code_files = sorted(Path(__file__).resolve().parents[1].rglob("*.py"))
    code_hash = sha256(b"".join(str(path.relative_to(Path(__file__).resolve().parents[1])).encode() + b"\0" + path.read_bytes() for path in code_files)).hexdigest()
    installed = {package.metadata["Name"]: package.version for package in distributions() if package.metadata["Name"]}
    return {"report_schema": "2", "dataset_version": dataset.version, "dataset_sha256": fingerprint,
            "dataset_provenance": dataset.provenance, "reviewers": dataset.reviewers,
            "review_status": dataset.review_status, "split": split, "test_unlocked": split == "test",
            "domain": dataset.domain, "adaptation_reviewed": dataset.adaptation_reviewed,
            "leakage_audit": leakage,
            "ranker_sha256": load_ranker(Path(ranker_path), allow_candidate=True).checksum if ranker_path else None,
            "feature_version": FEATURE_VERSION if capture_features or ranker_path else None,
            "latency_protocol": {"mode_order": "seeded shuffled (mode, query) schedule", "warm_repeats_per_query": latency_repeats,
                                 "cold_index_build_ms": cold_index_build_ms, "reported_percentiles": "all repeated in-process API requests; includes snapshot writes"},
            "seed": dataset.seed, "top_k": k, "modes": list(MODES), "source_count": len(sources),
            "environment": {"python": platform.python_version(), "platform": platform.platform(), "machine": platform.machine(),
                            "dependencies": {name: version(name) for name in ("fastapi", "pydantic", "httpx", "pypdf", "uvicorn", "python-multipart")}},
            "installed_environment": dict(sorted(installed.items())),
            "code_sha256": code_hash, "backend_versions": health,
            "extraction": {"mentions": set_metrics(predicted_mentions, gold_mentions), "relations": set_metrics(predicted_relations, gold_relations),
                           "end_to_end_resolution_accuracy": resolved / resolution_total if resolution_total else None,
                           "gold_mentions": resolution_total,
                           "missing_mentions": sorted(gold_mentions - predicted_mentions),
                           "unexpected_mentions": sorted(predicted_mentions - gold_mentions),
                           "missing_relations": sorted(gold_relations - predicted_relations),
                           "unexpected_relations": sorted(predicted_relations - gold_relations)} if "extraction" in dataset.annotation_tasks else None,
            "summary": summaries, "records": records,
            "limitations": ["These results measure only this dataset; inspect review_status and provenance before making quality claims.",
                            "Source-separated evaluation uses an isolated corpus for each partition; it is not a mixed-corpus production benchmark.",
                            "Lexical near-duplicate and shared-fact auditing cannot detect all semantic leakage; manual review is required.",
                            "Candidate rankers may be evaluated explicitly; a successful evaluation alone is not production promotion.",
                            "Heuristic ranking scores are not probabilities; calibration/Brier metrics are intentionally omitted.",
                            "Bootstrap resamples connected source-family clusters; fewer than five independent families suppress the interval.",
                            "Latency uses seeded shuffled mode order and repeated warm in-process API requests, not deployed-network latency.",
                            "Citation integrity checks provenance, not whether an excerpt entails an answer."]}


def markdown(report):
    lines = ["# SoftGraph offline baseline evaluation", "", f"Dataset: `{report['dataset_version']}` · `{report['review_status']}` · split `{report['split']}`", "",
             f"Dataset SHA-256: `{report['dataset_sha256']}`", f"Backend code SHA-256: `{report['code_sha256']}`", "",
             f"Sources: {report['source_count']}; K: {report['top_k']}; seed: {report['seed']}. No provider calls. Ranker: {report.get('ranker_sha256') or 'default baseline'}.", "",
             "| Mode | P@K | R@K | MRR@K | NDCG@K | Answerability | No-answer abstention | Failures |", "|---|---:|---:|---:|---:|---:|---:|---:|"]
    def number(value):
        return "n/a" if value is None else f"{value:.3f}"
    for mode, row in report["summary"].items():
        values = [row["retrieval"][key]["mean"] for key in ("precision_at_k", "recall_at_k", "mrr_at_k", "ndcg_at_k")]
        values += [row["answerability_accuracy"], row["no_answer_abstention_rate"], row["failure_rate"]]
        lines.append(f"| {mode} | " + " | ".join(number(value) for value in values) + " |")
    lines += ["", "Family-cluster bootstrap (95%, 2,000 draws; fewer than 5 independent clusters suppresses CI):", "",
              "| Mode | Independent clusters | MRR 95% CI | Warm p50 / p95 ms | Non-abstaining relevant response rate |", "|---|---:|---|---:|---:|"]
    for mode, row in report["summary"].items():
        metric = row["retrieval"]["mrr_at_k"]
        interval = metric["bootstrap_95_ci"]
        rendered = f"[{interval[0]:.3f}, {interval[1]:.3f}]" if interval else metric["ci_status"]
        lines.append(f"| {mode} | {metric['families']} | {rendered} | {number(row['latency_p50_ms'])} / {number(row['latency_p95_ms'])} | {number(row['answerable_response_with_relevant_evidence_rate'])} |")
    lines += ["", f"Cross-split near duplicates: {len(report['leakage_audit']['near_duplicate_sources'])}; shared-fact pairs requiring review: {len(report['leakage_audit']['shared_cross_split_facts'])}.", "",
              "Extraction (micro counts across documents; null means no extraction gold annotations):", "", "```json", json.dumps(report["extraction"], indent=2), "```", "", "Limitations:", ""]
    lines.extend(f"- {item}" for item in report["limitations"])
    lines += ["", "Full JSON includes per-query failures, rankings, versions, latencies, query counts and bootstrap intervals.", ""]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=Path(__file__).resolve().parents[2] / "evaluation" / "synthetic-course-v1.json")
    parser.add_argument("--split", choices=("train", "validation", "test"), default="validation")
    parser.add_argument("--top-k", type=int, default=3)
    parser.add_argument("--unlock-test", action="store_true")
    parser.add_argument("--ranker", type=Path)
    parser.add_argument("--capture-features", action="store_true")
    parser.add_argument("--latency-repeats", type=int, default=3)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Output already exists; use a new directory to preserve the experiment")
    report = evaluate(args.dataset, args.split, args.top_k, args.unlock_test, args.ranker, args.capture_features, args.latency_repeats)
    args.output.mkdir(parents=True)
    (args.output / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (args.output / "report.md").write_text(markdown(report), encoding="utf-8")
    (args.output / "requirements.txt").write_text("\n".join(f"{name}=={value}" for name, value in report["environment"]["dependencies"].items()) + "\n", encoding="utf-8")
    (args.output / "environment-requirements.txt").write_text("\n".join(f"{name}=={value}" for name, value in report["installed_environment"].items() if name.casefold().replace("_", "-") != "softgraph-backend") + "\n", encoding="utf-8")
    print(f"Saved {args.split} evaluation to {args.output}; dataset {report['dataset_sha256']}")
    if any(row["failed"] for row in report["records"]):
        raise SystemExit("Evaluation recorded failures; inspect report.json")


if __name__ == "__main__":
    main()
