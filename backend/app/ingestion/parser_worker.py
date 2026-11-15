"""Disposable PDF process with bounded IPC and a hard wall-clock deadline.

POSIX resource limits constrain the worker, but are not a filesystem/network
sandbox. Windows enforces the deadline and IPC bounds, without an OS memory cap.
Do not add application configuration, database access, or source logging here.
"""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import threading
import time

PDF_TIMEOUT_SECONDS = 15.0
PDF_QUEUE_TIMEOUT_SECONDS = 2.0
PDF_CPU_SECONDS = 10
PDF_MEMORY_BYTES = 512 * 1024 * 1024
# Non-BMP characters use two six-byte escapes in the ASCII JSON protocol.
MAX_RESULT_BYTES = 24_100_000
MAX_PAGES = 200
_PARSE_ERRORS = frozenset({
    "Source must contain between 1 byte and 10 MiB.",
    "The uploaded content is not a PDF.",
    "Encrypted PDFs are not supported. Upload an unlocked copy.",
    "PDFs are limited to 200 pages.",
    "Extracted text exceeds the 2 million character limit.",
    "The source contains no extractable text. Scanned PDFs require OCR.",
    "The source could not be parsed. Check its format and contents.",
})
_FAILURE = "The PDF parser failed or exceeded its resource limits. Check the PDF and retry."
_TIMEOUT = "PDF parsing exceeded the 15 second time limit. Reduce the PDF and retry."
# Shared by every workspace's ingestion service in this API process.
_PDF_SLOTS = threading.BoundedSemaphore(2)


def _worker_command() -> list[str]:
    # -I ignores PYTHONPATH, user site packages and Python environment settings.
    return [sys.executable, "-I", str(Path(__file__).resolve())]


def _worker_environment() -> dict[str, str]:
    # Deliberately do not inherit tokens, database locations, proxies, or PATH.
    # These Windows OS/runtime variables are needed by some Python installations.
    return {key: value for key, value in os.environ.items()
            if key.upper() in {"SYSTEMROOT", "WINDIR", "SYSTEMDRIVE"}}


def _kill_worker(process: subprocess.Popen) -> None:
    if os.name == "posix":
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    elif process.poll() is None:
        process.kill()


def _decode_result(raw: bytes):
    from app.core.errors import IngestionError
    from app.ingestion.parser import MAX_TEXT, Segment

    try:
        result = json.loads(raw)
        if not isinstance(result, dict):
            raise ValueError
        if set(result) == {"error"} and isinstance(result["error"], str) and result["error"] in _PARSE_ERRORS:
            raise IngestionError(result["error"])
        if set(result) != {"segments", "warnings"}:
            raise ValueError
        records, warnings = result["segments"], result["warnings"]
        if not isinstance(records, list) or not 1 <= len(records) <= MAX_PAGES:
            raise ValueError
        if not isinstance(warnings, list) or len(warnings) > MAX_PAGES:
            raise ValueError
        if any(not isinstance(warning, str) or len(warning) > 200 for warning in warnings):
            raise ValueError
        segments = []
        total = 0
        pages = set()
        for record in records:
            if not isinstance(record, dict) or set(record) != {"text", "location"}:
                raise ValueError
            text, location = record["text"], record["location"]
            if not isinstance(text, str) or not text or not isinstance(location, dict) or set(location) != {"page"}:
                raise ValueError
            page = location["page"]
            if type(page) is not int or not 1 <= page <= MAX_PAGES or page in pages:
                raise ValueError
            pages.add(page)
            total += len(text)
            if total > MAX_TEXT:
                raise ValueError
            segments.append(Segment(text, location))
        return segments, warnings
    except (ValueError, TypeError, RecursionError, UnicodeDecodeError) as error:
        raise IngestionError(_FAILURE) from error


def parse_pdf_isolated(content: bytes):
    from app.core.errors import IngestionError

    deadline = time.monotonic() + PDF_TIMEOUT_SECONDS
    if not _PDF_SLOTS.acquire(timeout=min(PDF_QUEUE_TIMEOUT_SECONDS, PDF_TIMEOUT_SECONDS)):
        raise IngestionError("PDF parsing is busy. Retry after another PDF finishes.", "parser_busy", 429)
    try:
        return _parse_pdf_process(content, deadline)
    finally:
        _PDF_SLOTS.release()


def _parse_pdf_process(content: bytes, deadline: float):
    from app.core.errors import IngestionError

    # The source file is private, unnamed to the child, and removed on all paths.
    # A regular stdin file avoids a blocked pipe write escaping the deadline.
    with tempfile.TemporaryDirectory(prefix="softgraph-pdf-") as directory:
        with tempfile.TemporaryFile(dir=directory) as source:
            source.write(content)
            source.seek(0)
            try:
                process = subprocess.Popen(
                    _worker_command(), stdin=source, stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL, cwd=directory,
                    env=_worker_environment(), close_fds=True,
                    start_new_session=os.name == "posix",
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                )
            except OSError as error:
                raise IngestionError(_FAILURE) from error
            output: list[bytes] = []
            finished = threading.Event()

            def read_result() -> None:
                try:
                    raw = process.stdout.read(MAX_RESULT_BYTES + 1)
                    if len(raw) > MAX_RESULT_BYTES:
                        _kill_worker(process)
                    else:
                        output.append(raw)
                except (OSError, ValueError):
                    pass
                finally:
                    finished.set()

            reader = threading.Thread(target=read_result, name="softgraph-pdf-result", daemon=True)
            reader.start()
            try:
                process.wait(timeout=max(0, deadline - time.monotonic()))
                if not finished.wait(timeout=max(0, deadline - time.monotonic())):
                    raise subprocess.TimeoutExpired(process.args, PDF_TIMEOUT_SECONDS)
                if process.returncode != 0 or not output:
                    raise IngestionError(_FAILURE)
                return _decode_result(output[0])
            except subprocess.TimeoutExpired as error:
                raise IngestionError(_TIMEOUT) from error
            finally:
                # Also kill descendants retaining the stdout pipe on POSIX.
                _kill_worker(process)
                process.wait()
                reader.join(timeout=1)
                process.stdout.close()


def _apply_resource_limits() -> None:
    if os.name != "posix":
        return
    import resource

    def limit(name: str, value: int) -> None:
        category = getattr(resource, name, None)
        if category is None:
            return
        _, hard = resource.getrlimit(category)
        bounded = value if hard == resource.RLIM_INFINITY else min(value, hard)
        resource.setrlimit(category, (bounded, bounded))

    limit("RLIMIT_AS", PDF_MEMORY_BYTES)
    limit("RLIMIT_CPU", PDF_CPU_SECONDS)
    limit("RLIMIT_FSIZE", 1024 * 1024)
    limit("RLIMIT_NOFILE", 32)
    limit("RLIMIT_CORE", 0)


def _main() -> None:
    # Apply limits before importing pypdf or processing attacker-controlled bytes.
    try:
        _apply_resource_limits()
        sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
        from app.core.errors import IngestionError
        from app.ingestion.parser import MAX_BYTES, _parse_content_local

        try:
            segments, warnings = _parse_content_local(sys.stdin.buffer.read(MAX_BYTES + 1), "pdf")
            result = {"segments": [{"text": item.text, "location": item.location} for item in segments], "warnings": warnings}
        except IngestionError as error:
            message = str(error)
            result = {"error": message if message in _PARSE_ERRORS else "The source could not be parsed. Check its format and contents."}
        raw = json.dumps(result, ensure_ascii=True, separators=(",", ":")).encode("ascii")
        if len(raw) > MAX_RESULT_BYTES:
            raise ValueError("Parser result too large")
        sys.stdout.buffer.write(raw)
        sys.stdout.buffer.flush()
    except BaseException:
        # Exit quietly; parser tracebacks may contain excerpts from the source.
        raise SystemExit(1) from None


if __name__ == "__main__":
    _main()
