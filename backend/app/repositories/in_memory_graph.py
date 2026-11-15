from app.core.config import Settings, settings
from app.models.graph import EntityModel, GraphResponse, RelationModel


class InMemoryGraphRepository:
    """Stable teaching graph used until a persistent GraphRepository is added."""

    def __init__(self, app_settings: Settings = settings) -> None:
        self.settings = app_settings
        self._entities = {
            "entity-fuzzy": EntityModel(entity_id="entity-fuzzy", canonical_name="Fuzzy Logic", entity_type="Concept", aliases=["fuzzy inference"], description="Approximate reasoning with graded membership.", source_chunks=["seed-fuzzy"], extraction_confidence=1, fuzzy_confidence=0.92, centrality_score=0.78, importance_score=0.9, embedding_reference="seed-1"),
            "entity-graph": EntityModel(entity_id="entity-graph", canonical_name="Knowledge Graph", entity_type="Technology", aliases=["knowledge network"], description="Typed entities and evidence-backed relations.", source_chunks=["seed-graph"], extraction_confidence=1, fuzzy_confidence=0.9, centrality_score=0.85, importance_score=0.94, embedding_reference="seed-2"),
            "entity-retrieval": EntityModel(entity_id="entity-retrieval", canonical_name="Hybrid Retrieval", entity_type="Process", aliases=["hybrid search"], description="Ranks graph and lexical evidence together.", source_chunks=["seed-retrieval"], extraction_confidence=1, fuzzy_confidence=0.91, centrality_score=0.74, importance_score=0.88, embedding_reference="seed-3"),
        }
        self._relations = {
            "relation-fuzzy-retrieval": RelationModel(relation_id="relation-fuzzy-retrieval", source_entity="entity-fuzzy", target_entity="entity-retrieval", relation_type="improves", evidence="Fuzzy confidence contributes to hybrid retrieval ranking.", source_chunk="seed-fuzzy", extraction_confidence=0.96, fuzzy_strength=0.88, semantic_strength=0.9, temporal_strength=1, final_weight=0.9),
            "relation-graph-retrieval": RelationModel(relation_id="relation-graph-retrieval", source_entity="entity-graph", target_entity="entity-retrieval", relation_type="supports", evidence="Graph structure provides explainable retrieval paths.", source_chunk="seed-graph", extraction_confidence=0.95, fuzzy_strength=0.87, semantic_strength=0.92, temporal_strength=1, final_weight=0.91),
        }

    def get_subgraph(
        self,
        entity_type: str | None = None,
        relation_type: str | None = None,
        source: str | None = None,
        minimum_confidence: float = 0,
        cursor: str | None = None,
        limit: int = 100,
    ) -> GraphResponse:
        """Return a source-aware, cursor-paged induced subgraph.

        ``minimum_confidence`` is a fuzzy evidence threshold: entities are
        included when ``fuzzy_confidence`` meets it, and relations when
        ``fuzzy_strength`` meets it. A response only contains relations whose
        endpoints are on its current entity page, preserving referential
        integrity for every filter and page size.
        """
        eligible_entities = sorted(
            (
                entity
                for entity in self._entities.values()
                if (entity_type is None or entity.entity_type == entity_type)
                and (source is None or source in entity.source_chunks)
                and entity.fuzzy_confidence >= minimum_confidence
            ),
            key=lambda entity: entity.entity_id,
        )
        if cursor is not None:
            eligible_entities = [entity for entity in eligible_entities if entity.entity_id > cursor]

        page_entities = eligible_entities[:limit]
        page_entity_ids = {entity.entity_id for entity in page_entities}
        relations = sorted(
            (
                relation
                for relation in self._relations.values()
                if (relation_type is None or relation.relation_type == relation_type)
                and (source is None or relation.source_chunk == source)
                and relation.fuzzy_strength >= minimum_confidence
                and relation.source_entity in page_entity_ids
                and relation.target_entity in page_entity_ids
            ),
            key=lambda relation: relation.relation_id,
        )
        next_cursor = page_entities[-1].entity_id if len(eligible_entities) > limit else None
        return GraphResponse(
            entities=page_entities,
            relations=relations,
            graph_version=self.settings.graph_version,
            next_cursor=next_cursor,
        )
