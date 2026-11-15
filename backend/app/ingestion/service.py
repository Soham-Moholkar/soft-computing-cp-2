from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock

from app.core.errors import IngestionError
from app.ingestion.parser import MAX_BYTES, chunk_segments, parse_content
from app.ingestion.url_fetcher import fetch_url
from app.models.ingestion import IngestionAccepted, IngestionRequest, ProcessingStatus, SourceType
from app.repositories.sqlite_ingestion import SQLiteIngestionRepository


class IngestionService:
    def __init__(self, repository: SQLiteIngestionRepository, url_fetcher=fetch_url) -> None:
        self.repository = repository
        self.url_fetcher = url_fetcher
        self.executor: ThreadPoolExecutor | None = None
        self.lock = Lock()
        self.scheduled: set[str] = set()

    def start(self) -> None:
        with self.lock:
            if self.executor is not None:
                return
            self.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="softgraph-ingestion")
        for job_id in self.repository.pending():
            self.schedule(job_id)

    def close(self) -> None:
        with self.lock:
            executor, self.executor = self.executor, None
        if executor:
            executor.shutdown(wait=True)

    def submit(self, request: IngestionRequest, content: bytes | None = None) -> IngestionAccepted:
        kind = request.source_type.value
        if kind == "paste":
            content = request.text.encode()
        elif kind == "sample":
            content = (Path(__file__).parent / "samples" / "course-overview.txt").read_bytes()
        elif kind != "url" and content is None:
            raise IngestionError("File sources require an actual file upload.")
        if content is not None and (not content or len(content) > MAX_BYTES):
            raise IngestionError("Source must contain between 1 byte and 10 MiB.", "source_size", 413 if content else 400)
        # Ensure older pending jobs are resumed before accepting more work.
        self.start()
        accepted = self.repository.enqueue(request, content, kind)
        self.schedule(accepted.job_id)
        return accepted

    def schedule(self, job_id: str) -> None:
        with self.lock:
            if job_id in self.scheduled or self.repository.get_job(job_id).status in {ProcessingStatus.COMPLETED, ProcessingStatus.FAILED}:
                return
            if self.executor is None:
                return
            self.scheduled.add(job_id)
            self.executor.submit(self.process, job_id)

    def process(self, job_id: str) -> None:
        try:
            configuration, content, kind = self.repository.source(job_id)
            self.repository.stage(job_id, ProcessingStatus.PARSING, 25)
            final_uri = None
            if kind == SourceType.URL:
                content, kind, final_uri = self.url_fetcher(configuration["source_uri"])
            segments, warnings = parse_content(content or b"", kind)
            self.repository.stage(job_id, ProcessingStatus.CHUNKING, 65)
            chunks = chunk_segments(self.repository.get_job(job_id).document_id, segments, configuration["chunk_size"], configuration["chunk_overlap"])
            self.repository.finish(job_id, chunks, content or b"", warnings, final_uri)
        except IngestionError as error:
            self.repository.fail(job_id, str(error))
        except Exception:
            self.repository.fail(job_id, "Ingestion failed unexpectedly. Retry the job or check the backend logs.")
            import logging
            logging.getLogger(__name__).exception("Ingestion worker failed for job %s", job_id)
        finally:
            with self.lock:
                self.scheduled.discard(job_id)
            # A retry can arrive after failure is saved but before this worker exits.
            if self.repository.get_job(job_id).status == ProcessingStatus.UPLOADED:
                self.schedule(job_id)
