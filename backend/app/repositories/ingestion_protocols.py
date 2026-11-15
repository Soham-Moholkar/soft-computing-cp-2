from typing import Protocol

from app.models.ingestion import IngestionAccepted, IngestionJob, IngestionRequest


class IngestionRepository(Protocol):
    def submit(self, request: IngestionRequest) -> IngestionAccepted: ...

    def get_job(self, job_id: str) -> IngestionJob: ...
