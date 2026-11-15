from pydantic import BaseModel

from app.core.config import settings


class VersionIdentifiers(BaseModel):
    schema_version: str
    graph_version: str
    index_version: str
    configuration_version: str


def version_metadata() -> VersionIdentifiers:
    return VersionIdentifiers(schema_version=settings.schema_version, graph_version=settings.graph_version, index_version=settings.index_version, configuration_version=settings.configuration_version)
