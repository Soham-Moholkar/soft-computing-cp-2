from dataclasses import dataclass, field
from os import getenv
from pathlib import Path


DEFAULT_CORS_ORIGINS = ("http://localhost:3000", "http://127.0.0.1:3000")


def cors_origins_from_environment() -> tuple[str, ...]:
    raw_origins = getenv("SOFTGRAPH_CORS_ORIGINS")
    if not raw_origins:
        return DEFAULT_CORS_ORIGINS
    return tuple(origin.strip() for origin in raw_origins.split(",") if origin.strip())


@dataclass(frozen=True, slots=True)
class Settings:
    application_name: str = "SoftGraph API"
    environment: str = "local"
    schema_version: str = "1.0"
    graph_version: str = "graph-local-1"
    index_version: str = "index-local-1"
    configuration_version: str = "config-local-1"
    cors_origins: tuple[str, ...] = field(default_factory=cors_origins_from_environment)
    ingestion_database: str = field(default_factory=lambda: getenv("SOFTGRAPH_INGESTION_DB", str(Path(__file__).resolve().parents[2] / ".local" / "ingestion.sqlite3")))


settings = Settings()
