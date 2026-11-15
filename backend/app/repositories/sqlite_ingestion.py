"""Durable sources, jobs and chunks; each operation uses its own SQLite connection."""
import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path

from app.core.errors import IngestionError, NotFoundError
from app.core.corpus_limits import MAX_CORPUS_CHUNKS, MAX_CORPUS_CHARACTERS, MAX_STORED_SOURCE_BYTES
from app.models.ingestion import DocumentDetail, DocumentModel, IngestionAccepted, IngestionJob, IngestionRequest, JobStage, ProcessingStatus


def now() -> datetime:
    return datetime.now(UTC)


class SQLiteIngestionRepository:
    MAX_PENDING = 16
    MAX_CORPUS_CHUNKS = MAX_CORPUS_CHUNKS
    MAX_CORPUS_CHARACTERS = MAX_CORPUS_CHARACTERS
    MAX_STORED_SOURCE_BYTES = MAX_STORED_SOURCE_BYTES

    def __init__(self, database_path: str) -> None:
        self.database_path = str(Path(database_path).resolve())
        Path(self.database_path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY, body TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id),
                    status TEXT NOT NULL, body TEXT NOT NULL, request TEXT NOT NULL,
                    source BLOB, kind TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status);
                CREATE TABLE IF NOT EXISTS chunks (
                    document_id TEXT NOT NULL REFERENCES documents(id), sequence INTEGER NOT NULL,
                    body TEXT NOT NULL, PRIMARY KEY(document_id, sequence)
                );
            """)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.database_path, timeout=10)
        try:
            db.execute("PRAGMA foreign_keys=ON")
            with db:
                yield db
        finally:
            db.close()

    def enqueue(self, request: IngestionRequest, source: bytes | None, kind: str) -> IngestionAccepted:
        configuration = request.model_dump(mode="json")
        identity = sha256(json.dumps(configuration, sort_keys=True).encode() + b"\0" + (source or b"")).hexdigest()
        document_id, job_id = f"document-{identity}", f"job-{identity}"
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            previous = db.execute("SELECT body FROM jobs WHERE id=?", (job_id,)).fetchone()
            if previous:
                return self.accepted(IngestionJob.model_validate_json(previous[0]))
            self._check_source_capacity(db, len(source or b""))
            if db.execute("SELECT count(*) FROM jobs WHERE status NOT IN ('completed','failed')").fetchone()[0] >= self.MAX_PENDING:
                raise IngestionError("The ingestion queue is full. Try again after a job finishes.", "queue_full", 429)
            timestamp = now()
            document = DocumentModel(document_id=document_id, name=request.name, source_type=request.source_type, domain=request.domain, timestamp=timestamp, source_uri=str(request.source_uri) if getattr(request, "source_uri", None) else None, processing_status=ProcessingStatus.UPLOADED, graph_version="graph-local-1", byte_count=len(source or b""), metadata={"chunk_size": request.chunk_size, "chunk_overlap": request.chunk_overlap})
            document.graph_version = "unbuilt"
            job = IngestionJob(job_id=job_id, document_id=document_id, status=ProcessingStatus.UPLOADED, progress=5, created_at=timestamp, updated_at=timestamp, stages=[JobStage(stage=ProcessingStatus.UPLOADED, progress=5, recorded_at=timestamp)])
            db.execute("INSERT INTO documents VALUES (?,?)", (document_id, document.model_dump_json()))
            db.execute("INSERT INTO jobs VALUES (?,?,?,?,?,?,?)", (job_id, document_id, job.status, job.model_dump_json(), json.dumps(configuration), source, kind))
        return self.accepted(job)

    @staticmethod
    def accepted(job: IngestionJob) -> IngestionAccepted:
        return IngestionAccepted(job_id=job.job_id, document_id=job.document_id, status=job.status, progress=job.progress, created_at=job.created_at)

    def get_job(self, job_id: str) -> IngestionJob:
        with self.connect() as db:
            row = db.execute("SELECT body FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not row:
            raise NotFoundError("ingestion job", job_id)
        return IngestionJob.model_validate_json(row[0])

    def list_jobs(self, limit: int = 20) -> list[IngestionJob]:
        with self.connect() as db:
            rows = db.execute("SELECT body FROM jobs ORDER BY rowid DESC LIMIT ?", (limit,)).fetchall()
        return [IngestionJob.model_validate_json(row[0]) for row in rows]

    def pending(self) -> list[str]:
        with self.connect() as db:
            return [row[0] for row in db.execute("SELECT id FROM jobs WHERE status NOT IN ('completed','failed') ORDER BY rowid")]

    def source(self, job_id: str) -> tuple[dict, bytes | None, str]:
        with self.connect() as db:
            row = db.execute("SELECT request,source,kind FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not row:
            raise NotFoundError("ingestion job", job_id)
        return json.loads(row[0]), row[1], row[2]

    def stage(self, job_id: str, status: ProcessingStatus, progress: int) -> None:
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT body FROM jobs WHERE id=?", (job_id,)).fetchone()
            job = IngestionJob.model_validate_json(row[0])
            job.status, job.progress, job.updated_at = status, progress, now()
            job.stages.append(JobStage(stage=status, progress=progress, recorded_at=job.updated_at))
            db.execute("UPDATE jobs SET status=?,body=? WHERE id=?", (status, job.model_dump_json(), job_id))
            document = DocumentModel.model_validate_json(db.execute("SELECT body FROM documents WHERE id=?", (job.document_id,)).fetchone()[0])
            document.processing_status = status
            db.execute("UPDATE documents SET body=? WHERE id=?", (document.model_dump_json(), document.document_id))

    def finish(self, job_id: str, chunks: list, content: bytes, warnings: list[str], source_uri: str | None = None) -> None:
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            job = IngestionJob.model_validate_json(db.execute("SELECT body FROM jobs WHERE id=?", (job_id,)).fetchone()[0])
            document = DocumentModel.model_validate_json(db.execute("SELECT body FROM documents WHERE id=?", (job.document_id,)).fetchone()[0])
            # The write lock covers both admission checks and the complete update:
            # concurrent workers cannot individually admit an oversized corpus.
            self._check_source_capacity(db, len(content), replacing_job=job_id)
            existing_count, existing_characters = db.execute("""
                SELECT count(*), coalesce(sum(length(json_extract(c.body,'$.text'))),0)
                FROM chunks c JOIN documents d ON c.document_id=d.id
                WHERE json_extract(d.body,'$.processing_status')='completed' AND c.document_id!=?
            """, (job.document_id,)).fetchone()
            if existing_count + len(chunks) > self.MAX_CORPUS_CHUNKS or existing_characters + sum(len(chunk.text) for chunk in chunks) > self.MAX_CORPUS_CHARACTERS:
                raise IngestionError("The searchable corpus would exceed 20,000 chunks or 20 million characters. Use a separate database for additional documents.", "corpus_capacity", 413)
            document.processing_status = ProcessingStatus.COMPLETED
            document.content_hash, document.byte_count = sha256(content).hexdigest(), len(content)
            if source_uri:
                document.source_uri = source_uri
            db.execute("DELETE FROM chunks WHERE document_id=?", (job.document_id,))
            db.executemany("INSERT INTO chunks VALUES (?,?,?)", [(chunk.document_id, chunk.sequence, chunk.model_dump_json()) for chunk in chunks])
            job.status, job.progress, job.updated_at = ProcessingStatus.COMPLETED, 100, now()
            job.warnings = warnings + ["Build this document's knowledge graph in the graph explorer to extract concepts and relations."]
            job.final_counts = {"chunks": len(chunks), "entities": 0, "relations": 0}
            job.stages.append(JobStage(stage=job.status, progress=100, recorded_at=job.updated_at))
            db.execute("UPDATE documents SET body=? WHERE id=?", (document.model_dump_json(), document.document_id))
            db.execute("UPDATE jobs SET status=?,body=?,source=? WHERE id=?", (job.status, job.model_dump_json(), content, job_id))

    def _check_source_capacity(self, db, incoming_bytes: int, replacing_job: str | None = None) -> None:
        # Uploads are counted at enqueue; fetched URL bytes are counted at finish.
        # Excluding the current job prevents counting a retained upload twice.
        stored_bytes = db.execute("SELECT coalesce(sum(length(source)),0) FROM jobs WHERE (? IS NULL OR id!=?)", (replacing_job, replacing_job)).fetchone()[0]
        if stored_bytes + incoming_bytes > self.MAX_STORED_SOURCE_BYTES:
            raise IngestionError("Stored sources would exceed the 128 MiB capacity. Use a separate database for additional sources.", "source_capacity", 413)

    def fail(self, job_id: str, message: str) -> None:
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            job = IngestionJob.model_validate_json(db.execute("SELECT body FROM jobs WHERE id=?", (job_id,)).fetchone()[0])
            job.status, job.error, job.updated_at = ProcessingStatus.FAILED, message, now()
            job.stages.append(JobStage(stage=job.status, progress=job.progress, recorded_at=job.updated_at))
            db.execute("UPDATE jobs SET status=?,body=? WHERE id=?", (job.status, job.model_dump_json(), job_id))
            document = DocumentModel.model_validate_json(db.execute("SELECT body FROM documents WHERE id=?", (job.document_id,)).fetchone()[0])
            document.processing_status = job.status
            db.execute("UPDATE documents SET body=? WHERE id=?", (document.model_dump_json(), job.document_id))

    def retry(self, job_id: str) -> IngestionAccepted:
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT body FROM jobs WHERE id=?", (job_id,)).fetchone()
            if not row:
                raise NotFoundError("ingestion job", job_id)
            job = IngestionJob.model_validate_json(row[0])
            if job.status != ProcessingStatus.FAILED:
                raise IngestionError("Only failed jobs can be retried.", "invalid_job_state", 409)
            if db.execute("SELECT count(*) FROM jobs WHERE status NOT IN ('completed','failed')").fetchone()[0] >= self.MAX_PENDING:
                raise IngestionError("The ingestion queue is full.", "queue_full", 429)
            job.status, job.progress, job.error, job.updated_at = ProcessingStatus.UPLOADED, 5, None, now()
            job.attempt += 1
            job.stages = [JobStage(stage=job.status, progress=5, recorded_at=job.updated_at)]
            db.execute("UPDATE jobs SET status=?,body=? WHERE id=?", (job.status, job.model_dump_json(), job_id))
            document = DocumentModel.model_validate_json(db.execute("SELECT body FROM documents WHERE id=?", (job.document_id,)).fetchone()[0])
            document.processing_status = job.status
            db.execute("UPDATE documents SET body=? WHERE id=?", (document.model_dump_json(), job.document_id))
        return self.accepted(job)

    def get_document(self, document_id: str, offset: int = 0, limit: int = 20) -> DocumentDetail:
        from app.models.ingestion import ChunkModel
        with self.connect() as db:
            row = db.execute("SELECT body FROM documents WHERE id=?", (document_id,)).fetchone()
            if not row:
                raise NotFoundError("document", document_id)
            total = db.execute("SELECT count(*) FROM chunks WHERE document_id=?", (document_id,)).fetchone()[0]
            chunks = db.execute("SELECT body FROM chunks WHERE document_id=? ORDER BY sequence LIMIT ? OFFSET ?", (document_id, limit, offset)).fetchall()
        return DocumentDetail(document=DocumentModel.model_validate_json(row[0]), chunks=[ChunkModel.model_validate_json(chunk[0]) for chunk in chunks], total_chunks=total, next_offset=offset + limit if offset + limit < total else None)
