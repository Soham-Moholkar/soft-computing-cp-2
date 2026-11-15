from typing import Any

from pydantic import BaseModel, Field


class ErrorEnvelope(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
    request_id: str


class NotFoundError(Exception):
    def __init__(self, resource: str, identifier: str) -> None:
        self.resource = resource
        self.identifier = identifier
        super().__init__(f"{resource} '{identifier}' was not found")


class IngestionError(Exception):
    def __init__(self, message: str, code: str = "invalid_source", status: int = 400) -> None:
        self.code = code
        self.status = status
        super().__init__(message)
