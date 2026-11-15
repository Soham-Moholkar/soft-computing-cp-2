"""Persistent bounded optimizer jobs using immutable diagnostic feature banks."""
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from threading import Lock
from uuid import uuid4

from app.core.errors import IngestionError, NotFoundError
from app.models.optimization import OptimizationRequest
from app.optimization.engine import FeatureObjective, optimize, train_neuro_fuzzy
from app.retrieval.ranker import seal

EVALUATION = Path(__file__).resolve().parents[2] / "evaluation"
BANK_PATHS = {kind: {split: EVALUATION / "runs" / f"optimizer-{kind}-{split}-v1" / "report.json" for split in ("train", "validation")} for kind in ("synthetic", "real")}


def code_hash():
    app = Path(__file__).resolve().parents[1]
    return sha256(b"".join(str(path.relative_to(app)).encode() + b"\0" + path.read_bytes() for path in sorted(app.rglob("*.py")))).hexdigest()


def load_bank(kind, split="validation"):
    path = BANK_PATHS[kind][split]
    if not path.exists():
        raise IngestionError("Optimization feature bank is not prepared. Follow docs/OPTIMIZATION.md.", "evaluation_not_ready", 409)
    report = json.loads(path.read_text(encoding="utf-8"))
    FeatureObjective(report, split)
    return report


class OptimizationService:
    def __init__(self, repository):
        self.repository = repository
        self.executor, self.lock, self.scheduled = None, Lock(), set()
        with repository.connect() as db:
            db.executescript("CREATE TABLE IF NOT EXISTS optimization_jobs (id TEXT PRIMARY KEY, status TEXT NOT NULL, body TEXT NOT NULL)")

    def start(self):
        with self.lock:
            if self.executor: return
            self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="softgraph-optimizer")
        with self.repository.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            active = [json.loads(row[0]) for row in db.execute("SELECT body FROM optimization_jobs WHERE status='running'")]
            for job in active:
                job.update(status="failed", error="Run interrupted by restart; submit a new run with the saved settings.")
                db.execute("UPDATE optimization_jobs SET status='failed',body=? WHERE id=?", (json.dumps(job), job["job_id"]))
            queued = [row[0] for row in db.execute("SELECT id FROM optimization_jobs WHERE status='queued' ORDER BY rowid")]
        for job_id in queued: self.schedule(job_id)

    def close(self):
        with self.lock:
            executor, self.executor = self.executor, None
        if executor: executor.shutdown(wait=True)

    def submit(self, request):
        validation = load_bank(request.dataset)
        if request.algorithm == "NEURO_FUZZY":
            training = load_bank(request.dataset, "train")
            rows = FeatureObjective(training, "train").rows
            pairs = sum(sum(item["grade"] > 0 for item in row["candidates"]) * min(5, sum(item["grade"] == 0 for item in row["candidates"])) for row in rows)
            if training["dataset_sha256"] != validation["dataset_sha256"] or pairs < 20:
                raise IngestionError("Neuro-fuzzy training requires matching train/validation banks and at least 20 train-only preference pairs. Use the prepared real collection.", "training_not_ready", 409)
        self.start()
        job = {"job_id": "optimization-" + uuid4().hex, "status": "queued", "request": request.model_dump(mode="json"),
               "created_at": datetime.now(UTC).isoformat(), "result": None, "artifact": None, "error": None}
        with self.repository.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            if db.execute("SELECT count(*) FROM optimization_jobs WHERE status IN ('queued','running')").fetchone()[0] >= 4:
                raise IngestionError("Optimizer queue is full; wait for a run to finish.", "queue_full", 429)
            db.execute("INSERT INTO optimization_jobs VALUES (?,?,?)", (job["job_id"], job["status"], json.dumps(job)))
            db.execute("DELETE FROM optimization_jobs WHERE status NOT IN ('queued','running') AND rowid NOT IN (SELECT rowid FROM optimization_jobs ORDER BY rowid DESC LIMIT 100)")
        self.schedule(job["job_id"])
        return job

    def schedule(self, job_id):
        with self.lock:
            if job_id in self.scheduled or self.executor is None: return
            self.scheduled.add(job_id)
            self.executor.submit(self.process, job_id)

    def process(self, job_id):
        job = self.get(job_id)
        try:
            job["status"] = "running"; self.save(job)
            request = OptimizationRequest.model_validate(job["request"])
            report = load_bank(request.dataset)
            if request.algorithm == "NEURO_FUZZY":
                result = train_neuro_fuzzy(load_bank(request.dataset, "train"), report, request.seed, request.evaluation_budget)
                artifact = {"schema_version": "neuro-fuzzy-candidate-1", "status": "candidate", **result["model"],
                            "provenance": result["provenance"], "seed": request.seed, "training_report_sha256": result["training_report_sha256"]}
                artifact["checksum"] = sha256(json.dumps(artifact, sort_keys=True).encode()).hexdigest()
            else:
                result = optimize(FeatureObjective(report), request.algorithm, request.evaluation_budget, request.population_size,
                                  request.seed, request.mutation_rate, request.crossover_rate, request.selection)
                artifact = seal({"domain": report["domain"], "weights": result["best_vector"],
                                 "dataset_sha256": report["dataset_sha256"], "training_code_sha256": code_hash(),
                                 "seed": request.seed, "training": {"method": request.algorithm + " validation configuration search",
                                 "selection_split": "validation", "fitness": result["best_metrics"], "provenance": result["provenance"]}}).model_dump()
            result["optimization_code_sha256"] = code_hash()
            job.update(status="completed", result=result, artifact=artifact, finished_at=datetime.now(UTC).isoformat())
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Optimization job failed: %s", job_id)
            job.update(status="failed", error="Optimization failed. Inspect server logs and feature-bank compatibility.")
        finally:
            self.save(job)
            with self.lock: self.scheduled.discard(job_id)

    def save(self, job):
        with self.repository.connect() as db:
            db.execute("UPDATE optimization_jobs SET status=?,body=? WHERE id=?", (job["status"], json.dumps(job), job["job_id"]))

    def get(self, job_id):
        with self.repository.connect() as db:
            row = db.execute("SELECT body FROM optimization_jobs WHERE id=?", (job_id,)).fetchone()
        if not row: raise NotFoundError("optimization job", job_id)
        return json.loads(row[0])

    def list(self):
        with self.repository.connect() as db:
            return [json.loads(row[0]) for row in db.execute("SELECT body FROM optimization_jobs ORDER BY rowid DESC LIMIT 20")]
