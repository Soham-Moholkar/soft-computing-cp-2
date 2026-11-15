"""Offline shortlist stress benchmark with cold/warm runs and stage timings."""
import argparse
import json
import tempfile
from pathlib import Path
from time import perf_counter

from fastapi.testclient import TestClient

from app.evaluation.dataset import Source
from app.evaluation.metrics import percentile
from app.evaluation.run import ingest
from app.factory import create_app


def benchmark(documents=120, repeats=20):
    with tempfile.TemporaryDirectory(prefix="softgraph-latency-") as directory:
        with TestClient(create_app(database_path=str(Path(directory) / "latency.sqlite3"))) as client:
            for index in range(documents):
                text = f"PSO improves Hybrid Retrieval. Hybrid Retrieval uses Knowledge Graph. Trial {index} compares retrieval parameters and ranking weights. " + "retrieval " * (index + 1) + "observations."
                ingest(client, Source(id=f"latency-{index}", family=f"latency-{index}", split="train", license="Original synthetic stress fixture", text=text, mentions=[], relations=[]))
            times, stages = [], []
            for _ in range(repeats + 1):
                start = perf_counter()
                response = client.post("/api/retrieve", json={"query": "PSO Hybrid Retrieval", "mode": "hybrid", "top_k": 3})
                response.raise_for_status()
                times.append((perf_counter() - start) * 1000)
                stages.append(response.json()["timeline"])
            return {"documents": documents, "repeats": repeats, "cold_ms": times[0],
                    "warm_p50_ms": percentile(times[1:], .5), "warm_p95_ms": percentile(times[1:], .95),
                    "samples_ms": times, "stage_timings": stages,
                    "limits": "Synthetic in-process shortlist stress run; no graph builds, provider or deployed-network latency."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Output already exists")
    report = benchmark()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key not in {"samples_ms", "stage_timings"}}))
