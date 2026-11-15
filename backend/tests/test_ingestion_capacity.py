"""Atomic corpus/source admission; all tests use disposable SQLite databases."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import time

import pytest
from fastapi.testclient import TestClient

from app.core.errors import IngestionError
from app.core.corpus_limits import MAX_CORPUS_CHUNKS, MAX_CORPUS_CHARACTERS, MAX_STORED_SOURCE_BYTES
from app.ingestion.parser import parse_content, chunk_segments
from app.main import create_app
from app.models.ingestion import PasteIngestionRequest, ProcessingStatus, UrlIngestionRequest
from app.repositories.sqlite_ingestion import SQLiteIngestionRepository
from app.retrieval.service import RetrievalService


def request(name="notes", text="Fuzzy logic supports retrieval."):
    return PasteIngestionRequest(source_type="paste", name=name, domain="course", text=text)


def finish(repository, accepted, content):
    segments, _ = parse_content(content, "txt")
    chunks = chunk_segments(accepted.document_id, segments, 400, 0)
    repository.finish(accepted.job_id, chunks, content, [])


def wait_job(client, job_id):
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        job = client.get(f"/api/ingestion/jobs/{job_id}").json()
        if job["status"] in {"failed", "completed"}:
            return job
        time.sleep(0.01)
    pytest.fail("Job did not finish")


def test_admission_and_retrieval_share_default_corpus_limits():
    assert SQLiteIngestionRepository.MAX_CORPUS_CHUNKS == RetrievalService.MAX_CHUNKS == MAX_CORPUS_CHUNKS == 20_000
    assert SQLiteIngestionRepository.MAX_CORPUS_CHARACTERS == RetrievalService.MAX_CHARACTERS == MAX_CORPUS_CHARACTERS == 20_000_000
    assert SQLiteIngestionRepository.MAX_STORED_SOURCE_BYTES == MAX_STORED_SOURCE_BYTES == 128 * 1024 * 1024


def test_source_admission_rejects_new_jobs_but_full_capacity_duplicate_is_idempotent(tmp_path, monkeypatch):
    repository = SQLiteIngestionRepository(str(tmp_path / "sources.sqlite3"))
    monkeypatch.setattr(repository, "MAX_STORED_SOURCE_BYTES", 5)
    original = request(text="fuzzy")
    accepted = repository.enqueue(original, b"fuzzy", "paste")
    assert repository.enqueue(original, b"fuzzy", "paste") == accepted
    with pytest.raises(IngestionError) as error:
        repository.enqueue(request("extra", "graph"), b"graph", "paste")
    assert error.value.code == "source_capacity" and error.value.status == 413
    with repository.connect() as db:
        assert db.execute("SELECT count(*) FROM jobs").fetchone()[0] == 1
        assert db.execute("SELECT count(*) FROM documents").fetchone()[0] == 1
    # Completion replaces the retained BLOB rather than charging it twice.
    finish(repository, accepted, b"fuzzy")
    assert repository.get_job(accepted.job_id).status == ProcessingStatus.COMPLETED


def test_concurrent_source_admission_cannot_overbook_capacity(tmp_path, monkeypatch):
    repository = SQLiteIngestionRepository(str(tmp_path / "sources.sqlite3"))
    monkeypatch.setattr(repository, "MAX_STORED_SOURCE_BYTES", 6)
    ready = Barrier(2)

    def enqueue(index):
        ready.wait()
        try:
            repository.enqueue(request(str(index), "data"), b"data", "paste")
            return "accepted"
        except IngestionError as error:
            return error.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(enqueue, range(2)))
    assert sorted(results) == ["accepted", "source_capacity"]
    with repository.connect() as db:
        assert db.execute("SELECT sum(length(source)) FROM jobs").fetchone()[0] == 4


@pytest.mark.parametrize("limit, value", [("MAX_CORPUS_CHUNKS", 1), ("MAX_CORPUS_CHARACTERS", 6)])
def test_concurrent_completions_cannot_overbook_searchable_corpus(tmp_path, monkeypatch, limit, value):
    repository = SQLiteIngestionRepository(str(tmp_path / "sources.sqlite3"))
    monkeypatch.setattr(repository, limit, value)
    accepted = [repository.enqueue(request(str(index), "fuzzy"), b"fuzzy", "paste") for index in range(2)]
    ready = Barrier(2)

    def complete(item):
        ready.wait()
        try:
            finish(repository, item, b"fuzzy")
            return "completed"
        except IngestionError as error:
            repository.fail(item.job_id, str(error))
            return error.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(complete, accepted))
    assert sorted(results) == ["completed", "corpus_capacity"]
    with repository.connect() as db:
        assert db.execute("SELECT count(*) FROM chunks").fetchone()[0] == 1
    assert sorted(repository.get_job(item.job_id).status for item in accepted) == ["completed", "failed"]


def test_character_capacity_counts_unicode_characters_and_accepts_exact_boundary(tmp_path, monkeypatch):
    repository = SQLiteIngestionRepository(str(tmp_path / "sources.sqlite3"))
    monkeypatch.setattr(repository, "MAX_CORPUS_CHARACTERS", 2)
    first = repository.enqueue(request("first", "é"), "é".encode(), "paste")
    second = repository.enqueue(request("second", "🙂"), "🙂".encode(), "paste")
    third = repository.enqueue(request("third", "x"), b"x", "paste")
    finish(repository, first, "é".encode())
    finish(repository, second, "🙂".encode())
    with pytest.raises(IngestionError) as error:
        finish(repository, third, b"x")
    assert error.value.code == "corpus_capacity"
    # Replacing an existing document excludes its prior chunks from admission.
    finish(repository, second, "🙂".encode())
    with repository.connect() as db:
        assert db.execute("SELECT count(*) FROM chunks").fetchone()[0] == 2


def test_url_source_capacity_failure_rolls_back_every_finish_write(tmp_path, monkeypatch):
    repository = SQLiteIngestionRepository(str(tmp_path / "sources.sqlite3"))
    monkeypatch.setattr(repository, "MAX_STORED_SOURCE_BYTES", 8)
    existing = repository.enqueue(request(text="fuzzy"), b"fuzzy", "paste")
    finish(repository, existing, b"fuzzy")
    url = UrlIngestionRequest(source_type="url", name="url", domain="course", source_uri="https://example.com/notes")
    accepted = repository.enqueue(url, None, "url")
    with pytest.raises(IngestionError) as error:
        finish(repository, accepted, b"graph")
    assert error.value.code == "source_capacity"
    with repository.connect() as db:
        assert db.execute("SELECT source FROM jobs WHERE id=?", (accepted.job_id,)).fetchone()[0] is None
        assert db.execute("SELECT count(*) FROM chunks WHERE document_id=?", (accepted.document_id,)).fetchone()[0] == 0
    assert repository.get_document(accepted.document_id).document.byte_count == 0
    assert repository.get_job(accepted.job_id).status == ProcessingStatus.UPLOADED


def test_corpus_capacity_failure_is_durable_retryable_and_preserves_existing_retrieval(tmp_path, monkeypatch):
    database = str(tmp_path / "sources.sqlite3")
    app = create_app(database_path=database)
    monkeypatch.setattr(app.state.ingestion_service.repository, "MAX_CORPUS_CHUNKS", 1)
    with TestClient(app) as client:
        first = client.post("/api/ingestion/upload", json=request().model_dump(mode="json")).json()
        assert wait_job(client, first["job_id"])["status"] == "completed"
        second = client.post("/api/ingestion/upload", json=request("other", "Graph evidence is useful.").model_dump(mode="json")).json()
        failed = wait_job(client, second["job_id"])
        assert failed["status"] == "failed" and "searchable corpus" in failed["error"]
        assert client.get(f"/api/ingestion/documents/{failed['document_id']}").json()["chunks"] == []
        result = client.post("/api/retrieve", json={"query": "Fuzzy logic"})
        assert result.status_code == 200 and result.json()["answer_status"] == "evidence"
        assert client.post(f"/api/ingestion/jobs/{failed['job_id']}/retry").status_code == 202
        retried = wait_job(client, failed["job_id"])
        assert retried["status"] == "failed" and retried["attempt"] == 2
    with TestClient(create_app(database_path=database)) as restarted:
        assert restarted.get(f"/api/ingestion/jobs/{failed['job_id']}").json() == retried
        assert restarted.post("/api/retrieve", json={"query": "Fuzzy logic"}).status_code == 200
