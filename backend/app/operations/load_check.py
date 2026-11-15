"""Local concurrent smoke check; no external provider or production SLA claim."""
import argparse
import json
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from statistics import median
from time import perf_counter, sleep
from fastapi.testclient import TestClient
from app.platform import create_platform_app
from app.operations.auth import AuthSettings
from app.workspaces import PROFILES, ontology_for, descriptor

def run(requests=60, concurrency=4):
    memberships = {workspace: {"key": "local-smoke-" + workspace + "-" + "a" * 40, "role": "editor", "workspaces": [workspace]} for workspace in PROFILES}
    auth = AuthSettings(memberships, secret="local-smoke-secret-" + "b" * 40)
    def headers(workspace): return {"authorization": "Bearer " + memberships[workspace]["key"]}
    with tempfile.TemporaryDirectory() as folder:
        with TestClient(create_platform_app(str(Path(folder) / "course.sqlite3"), auth, enable_optimizers=False)) as client:
            for workspace in PROFILES:
                prefix = f"/workspaces/{workspace}/api"
                jobs = client.post(prefix + "/workspace/examples", headers=headers(workspace)).json()["jobs"]
                for job in jobs:
                    for _ in range(500):
                        state = client.get(prefix + "/ingestion/jobs/" + job["job_id"], headers=headers(workspace)).json()
                        if state["status"] in {"completed", "failed"}: break
                        sleep(.01)
                    if state["status"] != "completed": raise ValueError("Seed failed")
                response = client.post(prefix + "/graph/build", json={"document_ids": [job["document_id"] for job in jobs], "extraction_configuration_version": ontology_for(workspace).version}, headers=headers(workspace))
                response.raise_for_status()
                client.post(prefix + "/retrieve", json={"query": PROFILES[workspace]["questions"][0], "ranking_profile": "domain"}, headers=headers(workspace)).raise_for_status()
            def request(index):
                workspace = tuple(PROFILES)[index % len(PROFILES)]; query = PROFILES[workspace]["questions"][(index // len(PROFILES)) % len(PROFILES[workspace]["questions"])]
                started = perf_counter()
                response = client.post(f"/workspaces/{workspace}/api/retrieve", json={"query": query, **{key: descriptor(workspace)["default_preferences"][key] for key in ("mode", "max_hops", "top_k", "ranking_profile")}}, headers=headers(workspace))
                result = response.json()
                return {"ms": (perf_counter() - started) * 1000, "ok": response.status_code == 200, "evidence": result.get("answer_status") == "evidence", "workspace": workspace, "query": query}
            started = perf_counter()
            with ThreadPoolExecutor(max_workers=concurrency) as pool: rows = list(pool.map(request, range(requests)))
            duration = perf_counter() - started
    timings = sorted(row["ms"] for row in rows)
    return {"protocol": "local-concurrent-smoke-2", "workspaces": len(PROFILES), "distinct_queries": len({(row["workspace"], row["query"]) for row in rows}), "requests": requests, "concurrency": concurrency, "failures": sum(not row["ok"] for row in rows), "evidence_responses": sum(row["evidence"] for row in rows), "p50_ms": median(timings), "p95_ms": timings[int(.95 * (len(timings)-1))], "duration_seconds": duration, "provider_enabled": False, "production_sla": False, "corpus": "four small theoretical documents per isolated workspace", "limitations": "In-process test client, warm small corpora. Does not test network, large corpora, uploads, distributed workers or hostile parser resources.", "rows": rows}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--output", type=Path, required=True); args = parser.parse_args()
    if args.output.exists(): parser.error("Choose a new output path")
    result = run(); args.output.parent.mkdir(parents=True, exist_ok=True); args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key != "rows"}, indent=2))
