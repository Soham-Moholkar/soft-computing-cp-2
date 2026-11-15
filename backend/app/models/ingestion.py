from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from app.models.common import SchemaModel


class SourceType(StrEnum):
    TXT = "txt"
    PDF = "pdf"
    DOCX = "docx"
    CSV = "csv"
    JSON = "json"
    PASTE = "paste"
    URL = "url"
    SAMPLE = "sample"


class ProcessingStatus(StrEnum):
    UPLOADED = "uploaded"
    PARSING = "parsing"
    CHUNKING = "chunking"
    COMPLETED = "completed"
    FAILED = "failed"


class IngestionRequestBase(BaseModel):
    """Strict JSON ingestion inputs shared by every supported source type."""

    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=255)
    domain: str = Field(min_length=1, max_length=120)
    chunk_size: int = Field(default=400, ge=1, le=2_000, description="Maximum whitespace-delimited words per chunk.")
    chunk_overlap: int = Field(default=0, ge=0, le=256)

    @field_validator("name", "domain")
    @classmethod
    def nonblank_metadata(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("metadata must not be blank")
        return value.strip()

    @model_validator(mode="after")
    def valid_overlap(self) -> "IngestionRequestBase":
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size")
        return self


class PasteIngestionRequest(IngestionRequestBase):
    source_type: Literal[SourceType.PASTE]
    text: str = Field(max_length=100_000)

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text must not be blank")
        return value


class UrlIngestionRequest(IngestionRequestBase):
    source_type: Literal[SourceType.URL]
    source_uri: HttpUrl


class ReferenceIngestionRequest(IngestionRequestBase):
    """Sample selection or metadata accompanying the multipart file route."""

    source_type: Literal[SourceType.TXT, SourceType.PDF, SourceType.DOCX, SourceType.CSV, SourceType.JSON, SourceType.SAMPLE]
    source_uri: HttpUrl | None = None


IngestionRequest = Annotated[
    PasteIngestionRequest | UrlIngestionRequest | ReferenceIngestionRequest,
    Field(discriminator="source_type"),
]


class DocumentModel(SchemaModel):
    document_id: str
    name: str
    source_type: SourceType
    domain: str
    timestamp: datetime
    source_uri: str | None = None
    processing_status: ProcessingStatus
    graph_version: str
    content_hash: str = ""
    byte_count: int = 0
    metadata: dict[str, str | int | bool] = Field(default_factory=dict)


class ChunkModel(SchemaModel):
    chunk_id: str
    document_id: str
    text: str
    sequence: int = Field(ge=0)
    token_count: int = Field(ge=0)
    content_hash: str
    source_location: dict[str, str | int] = Field(default_factory=dict)
    start_offset: int = 0
    end_offset: int = 0


class JobStage(SchemaModel):
    stage: ProcessingStatus
    progress: int = Field(ge=0, le=100)
    recorded_at: datetime


class IngestionAccepted(SchemaModel):
    job_id: str
    document_id: str
    status: ProcessingStatus
    progress: int = Field(ge=0, le=100)
    created_at: datetime


class IngestionJob(SchemaModel):
    job_id: str
    document_id: str
    status: ProcessingStatus
    progress: int = Field(ge=0, le=100)
    created_at: datetime
    updated_at: datetime
    stages: list[JobStage]
    warnings: list[str] = Field(default_factory=list)
    final_counts: dict[str, int] = Field(default_factory=dict)
    error: str | None = None
    attempt: int = 1


class DocumentDetail(SchemaModel):
    document: DocumentModel
    chunks: list[ChunkModel]
    total_chunks: int
    next_offset: int | None = None
