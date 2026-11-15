import io
import socket
import time
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from app.core.errors import IngestionError
from app.ingestion.parser import MAX_BYTES, chunk_segments, parse_content
from app.ingestion.url_fetcher import public_target, fetch_url
from app.ingestion import url_fetcher
from app.main import create_app
from app.models.ingestion import PasteIngestionRequest, ProcessingStatus
from app.repositories.sqlite_ingestion import SQLiteIngestionRepository


def pdf_bytes(text: str = "Fuzzy logic improves retrieval.") -> bytes:
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
    stream = DecodedStreamObject()
    stream.set_data(f"BT /F1 12 Tf 50 700 Td ({text}) Tj ET".encode())
    page[NameObject("/Contents")] = writer._add_object(stream)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def wait_job(client: TestClient, job_id: str) -> dict:
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        response = client.get(f"/api/ingestion/jobs/{job_id}")
        assert response.status_code == 200
        job = response.json()
        if job["status"] in {"completed", "failed"}:
            return job
        time.sleep(0.01)
    pytest.fail("Ingestion did not finish within the test deadline")


def upload(client: TestClient, kind: str, content: bytes, **configuration) -> dict:
    response = client.post("/api/ingestion/upload/file", data={"name": f"notes.{kind}", "source_type": kind, "domain": "course", "chunk_size": 8, "chunk_overlap": 2, **configuration}, files={"file": (f"notes.{kind}", content)})
    assert response.status_code == 202, response.text
    return response.json()


@pytest.mark.parametrize("content", [b"x" * 100001, b"a." * 2001], ids=["long-token", "many-sentences"])
def test_unretrievable_chunk_fails_ingestion_without_blocking_saved_sources(tmp_path, content):
    with TestClient(create_app(database_path=str(tmp_path / "sources.sqlite3"))) as client:
        good = upload(client, "txt", b"Fuzzy Logic supports Hybrid Retrieval.")
        assert wait_job(client, good["job_id"])["status"] == "completed"
        bad = upload(client, "txt", content)
        job = wait_job(client, bad["job_id"])
        assert job["status"] == "failed" and "Retrieval chunks must" in job["error"]
        assert client.get(f"/api/ingestion/documents/{job['document_id']}").json()["total_chunks"] == 0
        result = client.post("/api/retrieve", json={"query": "Fuzzy Logic"})
        assert result.status_code == 200 and result.json()["answer_status"] == "evidence"


@pytest.mark.parametrize("kind,content,location,expected", [
    ("txt", "Fuzzy logic handles uncertainty. Café notes explain retrieval.".encode(), "section", "Café"),
    ("csv", b"concept,description\nFuzzy logic,Handles uncertainty\nPSO,Tunes weights\n", "row", "Fuzzy logic"),
    ("json", b'[{"concept":"Fuzzy logic","description":"Handles uncertainty"}]', "json_path", "Fuzzy logic"),
    ("pdf", pdf_bytes(), "page", "Fuzzy logic"),
], ids=["txt", "csv", "json", "pdf"])
def test_actual_files_preserve_text_provenance_and_survive_restart(tmp_path, kind, content, location, expected):
    database = str(tmp_path / "sources.sqlite3")
    with TestClient(create_app(database_path=database)) as client:
        accepted = upload(client, kind, content)
        assert accepted["status"] == "uploaded"
        job = wait_job(client, accepted["job_id"])
        assert job["status"] == "completed", job
        assert [stage["stage"] for stage in job["stages"]] == ["uploaded", "parsing", "chunking", "completed"]
        detail = client.get(f"/api/ingestion/documents/{job['document_id']}").json()
        assert detail["total_chunks"] > 0
        assert expected in " ".join(chunk["text"] for chunk in detail["chunks"])
        assert location in detail["chunks"][0]["source_location"]
        assert detail["document"]["byte_count"] == len(content)
        assert detail["document"]["content_hash"]
        duplicate = upload(client, kind, content)
        assert duplicate["job_id"] == job["job_id"]
        assert len(client.get("/api/ingestion/jobs").json()) == 1
    with TestClient(create_app(database_path=database)) as restarted:
        assert restarted.get(f"/api/ingestion/jobs/{job['job_id']}").json() == job
        assert restarted.get(f"/api/ingestion/documents/{job['document_id']}").json() == detail


def test_paste_overlap_offsets_and_paginated_chunk_reads(tmp_path):
    text = "zero one two three four five six seven eight nine"
    with TestClient(create_app(database_path=str(tmp_path / "sources.sqlite3"))) as client:
        accepted = client.post("/api/ingestion/upload", json={"name": "notes", "source_type": "paste", "domain": "course", "text": text, "chunk_size": 4, "chunk_overlap": 1}).json()
        job = wait_job(client, accepted["job_id"])
        first = client.get(f"/api/ingestion/documents/{job['document_id']}?limit=1").json()
        second = client.get(f"/api/ingestion/documents/{job['document_id']}?offset=1&limit=1").json()
        assert first["total_chunks"] == 3
        assert first["next_offset"] == 1
        assert first["chunks"][0]["text"] == "zero one two three"
        assert second["chunks"][0]["text"] == "three four five six"
        for chunk in first["chunks"] + second["chunks"]:
            assert text[chunk["start_offset"]:chunk["end_offset"]] == chunk["text"]


@pytest.mark.parametrize("kind,content", [("json", b"{broken}"), ("csv", b"a,b\n1,2,3"), ("pdf", b"not a pdf"), ("txt", b"   "), ("txt", b"\xff")])
def test_parse_failures_are_durable_failed_jobs_without_chunks(tmp_path, kind, content):
    with TestClient(create_app(database_path=str(tmp_path / "sources.sqlite3"))) as client:
        accepted = upload(client, kind, content)
        job = wait_job(client, accepted["job_id"])
        assert job["status"] == "failed"
        assert job["error"]
        detail = client.get(f"/api/ingestion/documents/{job['document_id']}").json()
        assert detail["chunks"] == []
        assert detail["document"]["processing_status"] == "failed"


def test_upload_rejects_size_extension_missing_file_and_bad_configuration(tmp_path):
    with TestClient(create_app(database_path=str(tmp_path / "sources.sqlite3"))) as client:
        fields = {"name": "notes", "source_type": "txt", "domain": "course"}
        assert client.post("/api/ingestion/upload/file", data=fields, files={"file": ("notes.txt", b"x" * (MAX_BYTES + 1))}).status_code == 413
        assert client.post("/api/ingestion/upload/file", data=fields, files={"file": ("notes.pdf", b"x")}).status_code == 400
        assert client.post("/api/ingestion/upload", json={**fields, "source_type": "txt"}).status_code == 400
        assert client.post("/api/ingestion/upload", json={**fields, "source_type": "paste", "text": "data", "chunk_size": 2, "chunk_overlap": 2}).status_code == 422
        assert client.get("/api/ingestion/jobs").json() == []


def test_queued_source_resumes_when_backend_starts_and_concurrent_duplicates_share_job(tmp_path):
    database = str(tmp_path / "sources.sqlite3")
    repository = SQLiteIngestionRepository(database)
    request = PasteIngestionRequest(source_type="paste", name="notes", domain="course", text="fuzzy graph evidence")
    with ThreadPoolExecutor(max_workers=4) as executor:
        accepted = list(executor.map(lambda _: repository.enqueue(request, request.text.encode(), "paste"), range(4)))
    assert len({result.job_id for result in accepted}) == 1
    # Simulate a process stopping after its source and parsing stage were committed.
    repository.stage(accepted[0].job_id, ProcessingStatus.PARSING, 25)
    with TestClient(create_app(database_path=database)) as client:
        job = wait_job(client, accepted[0].job_id)
        assert job["status"] == "completed"
        assert client.get(f"/api/ingestion/documents/{job['document_id']}").json()["total_chunks"] == 1


def test_queue_is_bounded(tmp_path):
    repository = SQLiteIngestionRepository(str(tmp_path / "sources.sqlite3"))
    for index in range(repository.MAX_PENDING):
        request = PasteIngestionRequest(source_type="paste", name=str(index), domain="course", text="fuzzy graph")
        repository.enqueue(request, b"fuzzy graph", "paste")
    with pytest.raises(IngestionError) as error:
        repository.enqueue(PasteIngestionRequest(source_type="paste", name="extra", domain="course", text="fuzzy graph"), b"fuzzy graph", "paste")
    assert error.value.status == 429


def test_url_fetch_content_retry_and_sample_read_actual_sources(tmp_path):
    app = create_app(database_path=str(tmp_path / "sources.sqlite3"))
    attempts = []
    def fetcher(url):
        attempts.append(url)
        if len(attempts) == 1:
            raise IngestionError("Source is temporarily unavailable.")
        return b"<html><script>ignore me</script><p>Fuzzy logic supports graph retrieval.</p></html>", "html", url
    app.state.ingestion_service.url_fetcher = fetcher
    with TestClient(app) as client:
        accepted = client.post("/api/ingestion/upload", json={"name": "article", "source_type": "url", "source_uri": "https://example.com/article", "domain": "course"}).json()
        assert wait_job(client, accepted["job_id"])["status"] == "failed"
        assert client.post(f"/api/ingestion/jobs/{accepted['job_id']}/retry").status_code == 202
        job = wait_job(client, accepted["job_id"])
        assert job["status"] == "completed" and job["attempt"] == 2
        text = client.get(f"/api/ingestion/documents/{job['document_id']}").json()["chunks"][0]["text"]
        assert "Fuzzy logic" in text and "ignore me" not in text
        assert client.post(f"/api/ingestion/jobs/{accepted['job_id']}/retry").status_code == 409
        sample = client.post("/api/ingestion/upload", json={"name": "sample", "source_type": "sample", "domain": "course"}).json()
        sample_job = wait_job(client, sample["job_id"])
        assert sample_job["status"] == "completed"
        sample_text = client.get(f"/api/ingestion/documents/{sample_job['document_id']}").json()["chunks"][0]["text"]
        assert "Whale Optimization" in sample_text


@pytest.mark.parametrize("url", ["http://example.com", "https://localhost", "https://example.com:8443", "https://user:pass@example.com"])
def test_url_policy_rejects_unsafe_targets_without_connecting(url):
    with pytest.raises(IngestionError):
        public_target(url)


def test_url_policy_rejects_private_dns_and_pins_public_dns(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))])
    with pytest.raises(IngestionError):
        public_target("https://example.com")
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))])
    assert public_target("https://example.com/article?q=fuzzy") == ("example.com", "93.184.216.34", "/article?q=fuzzy")


def test_empty_pdf_and_chunk_explosion_fail_explicitly():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    buffer = io.BytesIO()
    writer.write(buffer)
    with pytest.raises(IngestionError, match="no extractable text"):
        parse_content(buffer.getvalue(), "pdf")
    segments, _ = parse_content(b"word " * 5001, "txt")
    with pytest.raises(IngestionError, match="Too many chunks"):
        chunk_segments("document-test", segments, 1, 0)


def test_url_redirects_revalidate_destination_and_close_connection(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda host, *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1" if host == "private.example" else "93.184.216.34", 443))])
    connections = []
    class RedirectConnection:
        status = 302
        def __init__(self, host, address):
            self.closed = False
            connections.append(self)
        def request(self, *args, **kwargs):
            pass
        def getresponse(self):
            return self
        def getheader(self, name):
            return "https://private.example/secret" if name == "Location" else None
        def close(self):
            self.closed = True
    monkeypatch.setattr(url_fetcher, "PinnedHTTPSConnection", RedirectConnection)
    with pytest.raises(IngestionError, match="Private network"):
        fetch_url("https://example.com")
    assert len(connections) == 1 and connections[0].closed


def test_retry_arriving_before_failed_worker_exits_is_scheduled(tmp_path, monkeypatch):
    app = create_app(database_path=str(tmp_path / "sources.sqlite3"))
    service = app.state.ingestion_service
    original_fail = service.repository.fail
    calls = []
    def fetcher(url):
        calls.append(url)
        if len(calls) == 1:
            raise IngestionError("Transient failure")
        return b"Fuzzy evidence", "txt", url
    def fail_then_retry(job_id, message):
        original_fail(job_id, message)
        service.repository.retry(job_id)
        service.schedule(job_id)
    service.url_fetcher = fetcher
    monkeypatch.setattr(service.repository, "fail", fail_then_retry)
    with TestClient(app) as client:
        accepted = client.post("/api/ingestion/upload", json={"name": "article", "source_type": "url", "source_uri": "https://example.com", "domain": "course"}).json()
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            job = client.get(f"/api/ingestion/jobs/{accepted['job_id']}").json()
            if job["status"] == "completed":
                break
            time.sleep(0.01)
        assert job["status"] == "completed" and job["attempt"] == 2
