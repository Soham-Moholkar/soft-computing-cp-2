from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SchemaModel(BaseModel):
    """Base for API models that must remain versioned and strict."""

    model_config = ConfigDict(extra="forbid")
    schema_version: str = "1.0"


class VersionedTimestamp(SchemaModel):
    created_at: datetime

