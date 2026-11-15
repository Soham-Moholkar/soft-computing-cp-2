from __future__ import annotations

from datetime import UTC, datetime
from hashlib import sha256

from app.core.config import Settings, settings
from app.core.errors import NotFoundError
from app.models.ingestion import (
    ChunkModel,
    DocumentModel,
    IngestionAccepted,
    IngestionJob,
    IngestionRequest,
    JobStage,
    PasteIngestionRequest,
    ProcessingStatus,
    ReferenceIngestionRequest,
    UrlIngestionRequest,
)


class InMemoryIngestionRepository:
    """Repeatable JSON-ingestion reference with no file/network side effects."""

    _TIMESTAMP = datetime(2026, 9, 2, 5, 0, tzinfo=UTC)

    def __init__(self, app_settings: Settings = settings) -> None:
        self.settings = app_settings
        self.documents: dict[str, DocumentModel] = {}
        self.chunks: dict[str, list[ChunkModel]] = {}
        self.jobs: dict[str, IngestionJob] = {}

    @staticmethod
    def _identifier(prefix: str, identity: str) -> str:
        return f"{prefix}-{sha256(identity.encode()).hexdigest()[:16]}"

    @staticmethod
    def _source_text(request: IngestionRequest) -> str:
        if isinstance(request, PasteIngestionRequest):
            return request.text
        if isinstance(request, UrlIngestionRequest):
            return f"Reference source: {request.source_uri}"
        return f"Reference document: {request.name}"

    def submit(self, request: IngestionRequest) -> IngestionAccepted:
        source_text = self._source_text(request)
        identity = "|".join((request.source_type, request.domain, request.name, source_text, str(request.chunk_size)))
        document_id = self._identifier("document", identity)
        job_id = self._identifier("job", identity)
        document = DocumentModel(
            document_id=document_id,
            name=request.name,
            source_type=request.source_type,
            domain=request.domain,
            timestamp=self._TIMESTAMP,
            source_uri=str(request.source_uri) if hasattr(request, "source_uri") and request.source_uri else None,
            processing_status=ProcessingStatus.COMPLETED,
            graph_version=self.settings.graph_version,
        )
        chunks = self._chunk(document_id, source_text, request.chunk_size)
        stages = [
            JobStage(stage=stage, progress=progress, recorded_at=self._TIMESTAMP)
            for stage, progress in (
                (ProcessingStatus.UPLOADED, 10),
                (ProcessingStatus.PARSING, 45),
                (ProcessingStatus.CHUNKING, 80),
                (ProcessingStatus.COMPLETED, 100),
            )
        ]
        job = IngestionJob(
            job_id=job_id,
            document_id=document_id,
            status=ProcessingStatus.COMPLETED,
            progress=100,
            created_at=self._TIMESTAMP,
            updated_at=self._TIMESTAMP,
            stages=stages,
            warnings=self._warnings(request),
            final_counts={"chunks": len(chunks), "entities": 0, "relations": 0},
        )
        self.documents[document_id] = document
        self.chunks[document_id] = chunks
        self.jobs[job_id] = job
        return IngestionAccepted(job_id=job_id, document_id=document_id, status=job.status, progress=job.progress, created_at=job.created_at)

    @staticmethod
    def _warnings(request: IngestionRequest) -> list[str]:
        deferred = "Extraction and graph mutation are deferred in the deterministic reference backend."
        if isinstance(request, UrlIngestionRequest):
            return ["The URL source was not fetched by the deterministic reference backend.", deferred]
        if isinstance(request, ReferenceIngestionRequest):
            return ["Metadata-only file/sample content was not parsed by the deterministic reference backend.", deferred]
        return [deferred]

    def _chunk(self, document_id: str, source_text: str, chunk_size: int) -> list[ChunkModel]:
        words = source_text.split() or ["(empty)"]
        chunks: list[ChunkModel] = []
        for sequence, start in enumerate(range(0, len(words), chunk_size)):
            text = " ".join(words[start : start + chunk_size])
            content_hash = sha256(text.encode()).hexdigest()
            chunks.append(ChunkModel(
                chunk_id=self._identifier("chunk", f"{document_id}|{sequence}|{content_hash}"),
                document_id=document_id,
                text=text,
                sequence=sequence,
                token_count=len(text.split()),
                content_hash=content_hash,
            ))
        return chunks

    def get_job(self, job_id: str) -> IngestionJob:
        try:
            return self.jobs[job_id]
        except KeyError as error:
            raise NotFoundError("ingestion job", job_id) from error
