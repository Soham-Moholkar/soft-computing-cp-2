from typing import Protocol

from app.models.graph import GraphResponse


class GraphRepository(Protocol):
    def get_subgraph(
        self,
        entity_type: str | None = None,
        relation_type: str | None = None,
        source: str | None = None,
        minimum_confidence: float = 0,
        cursor: str | None = None,
        limit: int = 100,
    ) -> GraphResponse: ...
