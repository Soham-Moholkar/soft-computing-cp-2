"""PDF subprocess regressions; every durable source lives in a temporary DB."""
import io
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import sys
import time
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from app.core.errors import IngestionError
from app.ingestion.parser import parse_content
from app.ingestion import parser_worker
from app.main import create_app


def pdf_bytes() -> bytes:
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 50 700 Td (Fuzzy logic supports retrieval.) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(stream)
    writer.add_blank_page(width=600, height=800)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


@pytest.fixture
def launched(monkeypatch):
    records = []
    original = subprocess.Popen

    def launch(*args, **kwargs):
        process = original(*args, **kwargs)
        records.append((process, kwargs))
        return process

    monkeypatch.setattr(parser_worker.subprocess, "Popen", launch)
    return records


def assert_cleaned(records):
    assert records
    for process, options in records:
        assert process.poll() is not None
        assert process.stdout.closed
        assert options["stdin"].closed
        assert not Path(options["cwd"]).exists()


def test_real_pdf_uses_fresh_process_preserving_pages_and_warnings(monkeypatch, launched):
    monkeypatch.setenv("SOFTGRAPH_INGESTION_DB", "/private/sources.sqlite3")
    monkeypatch.setenv("SECRET_ACCESS_TOKEN", "private-token")
    monkeypatch.setenv("HTTPS_PROXY", "https://private-proxy.test")
    segments, warnings = parse_content(pdf_bytes(), "pdf")
    assert segments[0].text == "Fuzzy logic supports retrieval."
    assert segments[0].location == {"page": 1}
    assert warnings == ["Page 2 has no extractable text; scanned pages require OCR."]
    _, options = launched[0]
    assert set(options["env"]) <= {"SystemRoot", "SYSTEMROOT", "windir", "WINDIR", "SystemDrive", "SYSTEMDRIVE"}
    assert options["close_fds"] is True
    assert options["stderr"] == subprocess.DEVNULL
    assert_cleaned(launched)


@pytest.mark.parametrize("content, message", [
    (b"%PDF-malformed source must not appear in errors", "could not be parsed"),
    (b"%PDF-1.7\ntruncated", "could not be parsed"),
])
def test_malformed_pdf_is_a_safe_failure_and_reaps_worker(content, message, launched):
    with pytest.raises(IngestionError, match=message) as error:
        parse_content(content, "pdf")
    assert "source must not appear" not in str(error.value)
    assert_cleaned(launched)


def test_pdf_timeout_kills_worker_and_removes_private_source(monkeypatch, launched):
    monkeypatch.setattr(parser_worker, "PDF_TIMEOUT_SECONDS", 0.2)
    monkeypatch.setattr(parser_worker, "_worker_command", lambda: [sys.executable, "-I", "-c", "import time; time.sleep(60)"])
    started = time.monotonic()
    with pytest.raises(IngestionError, match="time limit"):
        parse_content(b"%PDF-1.7", "pdf")
    assert time.monotonic() - started < 3
    assert_cleaned(launched)
    # Failure must return the process-wide slot for subsequent PDFs.
    assert parser_worker._PDF_SLOTS.acquire(blocking=False)
    assert parser_worker._PDF_SLOTS.acquire(blocking=False)
    parser_worker._PDF_SLOTS.release()
    parser_worker._PDF_SLOTS.release()


def test_process_wide_pdf_capacity_fails_busy_with_bounded_wait(monkeypatch, launched):
    monkeypatch.setattr(parser_worker, "PDF_QUEUE_TIMEOUT_SECONDS", 0.02)
    assert parser_worker._PDF_SLOTS.acquire(blocking=False)
    assert parser_worker._PDF_SLOTS.acquire(blocking=False)
    started = time.monotonic()
    try:
        with pytest.raises(IngestionError, match="PDF parsing is busy") as error:
            parse_content(b"%PDF-1.7", "pdf")
        assert error.value.code == "parser_busy" and error.value.status == 429
        assert time.monotonic() - started < 1
        assert launched == []
    finally:
        parser_worker._PDF_SLOTS.release()
        parser_worker._PDF_SLOTS.release()
    assert parse_content(pdf_bytes(), "pdf")[0][0].location == {"page": 1}
    assert_cleaned(launched)


def test_concurrent_pdf_callers_launch_at_most_two_processes(monkeypatch, launched):
    monkeypatch.setattr(parser_worker, "_worker_command", lambda: [sys.executable, "-I", "-c", 'import time; time.sleep(.3); print(\'{"segments":[{"text":"text","location":{"page":1}}],"warnings":[]}\')'])
    original = parser_worker.subprocess.Popen
    active_counts = []

    def launch(*args, **kwargs):
        process = original(*args, **kwargs)
        active_counts.append(sum(item.poll() is None for item, _ in launched))
        return process

    monkeypatch.setattr(parser_worker.subprocess, "Popen", launch)
    with ThreadPoolExecutor(max_workers=4) as callers:
        results = list(callers.map(lambda _: parse_content(b"%PDF-1.7", "pdf"), range(4)))
    assert len(results) == len(launched) == 4
    assert max(active_counts) == 2
    assert_cleaned(launched)


@pytest.mark.parametrize("script", [
    "import os; os._exit(7)",
    "print('not json')",
    "print('{}')",
    "import sys; sys.stdout.buffer.write(b'\\xff')",
])
def test_worker_crashes_or_invalid_protocol_fail_closed(monkeypatch, launched, script):
    monkeypatch.setattr(parser_worker, "_worker_command", lambda: [sys.executable, "-I", "-c", script])
    with pytest.raises(IngestionError, match="parser failed"):
        parse_content(b"%PDF-1.7", "pdf")
    assert_cleaned(launched)


def test_oversized_ipc_result_kills_worker_without_waiting_for_deadline(monkeypatch, launched):
    monkeypatch.setattr(parser_worker, "MAX_RESULT_BYTES", 128)
    monkeypatch.setattr(parser_worker, "_worker_command", lambda: [sys.executable, "-I", "-c", "import sys,time; sys.stdout.buffer.write(b'x'*129); sys.stdout.flush(); time.sleep(60)"])
    started = time.monotonic()
    with pytest.raises(IngestionError, match="parser failed"):
        parse_content(b"%PDF-1.7", "pdf")
    assert time.monotonic() - started < 3
    assert_cleaned(launched)


@pytest.mark.parametrize("result", [
    {"segments": [{"text": "text", "location": {"page": True}}], "warnings": []},
    {"segments": [{"text": "text", "location": {"page": 201}}], "warnings": []},
    {"segments": [{"text": "text", "location": {"path": "/private/file"}}], "warnings": []},
    {"segments": [{"text": "text", "location": {"page": 1}}], "warnings": [1]},
    {"segments": [], "warnings": []},
    {"error": "attacker-controlled source contents"},
])
def test_worker_protocol_validates_types_bounds_and_safe_errors(result):
    with pytest.raises(IngestionError, match="parser failed"):
        parser_worker._decode_result(json.dumps(result).encode())


def test_posix_limits_include_memory_cpu_files_and_descriptors(monkeypatch):
    applied = {}
    names = ["RLIMIT_AS", "RLIMIT_CPU", "RLIMIT_FSIZE", "RLIMIT_NOFILE", "RLIMIT_CORE"]
    resource = SimpleNamespace(**{name: index for index, name in enumerate(names)}, RLIM_INFINITY=-1,
                               getrlimit=lambda _: (-1, -1), setrlimit=lambda key, values: applied.update({key: values}))
    monkeypatch.setitem(sys.modules, "resource", resource)
    monkeypatch.setattr(parser_worker, "os", SimpleNamespace(name="posix"))
    parser_worker._apply_resource_limits()
    assert applied[resource.RLIMIT_AS] == (512 * 1024 * 1024,) * 2
    assert applied[resource.RLIMIT_CPU] == (10, 10)
    assert applied[resource.RLIMIT_FSIZE] == (1024 * 1024,) * 2
    assert applied[resource.RLIMIT_NOFILE] == (32, 32)
    assert applied[resource.RLIMIT_CORE] == (0, 0)


def wait_job(client, job_id):
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        job = client.get(f"/api/ingestion/jobs/{job_id}").json()
        if job["status"] in {"failed", "completed"}:
            return job
        time.sleep(0.01)
    pytest.fail("Job did not finish")


def test_url_pdf_timeout_is_durable_and_retry_preserves_provenance(tmp_path, monkeypatch, launched):
    app = create_app(database_path=str(tmp_path / "sources.sqlite3"))
    pdf = pdf_bytes()
    app.state.ingestion_service.url_fetcher = lambda _: (pdf, "pdf", "https://example.com/final.pdf")
    original_command = parser_worker._worker_command
    monkeypatch.setattr(parser_worker, "PDF_TIMEOUT_SECONDS", 0.2)
    monkeypatch.setattr(parser_worker, "_worker_command", lambda: [sys.executable, "-I", "-c", "import time; time.sleep(60)"])
    with TestClient(app) as client:
        accepted = client.post("/api/ingestion/upload", json={"source_type": "url", "source_uri": "https://example.com/source.pdf", "domain": "course", "name": "notes"}).json()
        job = wait_job(client, accepted["job_id"])
        assert job["status"] == "failed" and "time limit" in job["error"]
        detail_url = f"/api/ingestion/documents/{job['document_id']}"
        assert client.get(detail_url).json()["chunks"] == []
        assert_cleaned(launched)
        monkeypatch.setattr(parser_worker, "PDF_TIMEOUT_SECONDS", 15.0)
        monkeypatch.setattr(parser_worker, "_worker_command", original_command)
        assert client.post(f"/api/ingestion/jobs/{job['job_id']}/retry").status_code == 202
        retried = wait_job(client, job["job_id"])
        assert retried["status"] == "completed" and retried["attempt"] == 2
        detail = client.get(detail_url).json()
        assert detail["chunks"][0]["source_location"] == {"page": 1}
        assert detail["document"]["source_uri"] == "https://example.com/final.pdf"
        assert detail["document"]["byte_count"] == len(pdf)
        assert detail["document"]["content_hash"]
        assert retried["warnings"][0].startswith("Page 2")
    assert_cleaned(launched)
