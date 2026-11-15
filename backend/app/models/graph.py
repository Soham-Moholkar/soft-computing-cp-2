from pydantic import ConfigDict, Field, FiniteFloat

from app.models.common import SchemaModel


class EntityModel(SchemaModel):
    entity_id: str
    canonical_name: str
    entity_type: str
    aliases: list[str] = Field(default_factory=list)
    description: str = ""
    source_chunks: list[str] = Field(default_factory=list)
    extraction_confidence: float = Field(ge=0, le=1)
    fuzzy_confidence: float = Field(ge=0, le=1)
    centrality_score: float = Field(ge=0, le=1)
    importance_score: float = Field(ge=0, le=1)
    embedding_reference: str | None = None


class RelationModel(SchemaModel):
    relation_id: str
    source_entity: str
    target_entity: str
    relation_type: str
    evidence: str
    source_chunk: str
    extraction_confidence: float = Field(ge=0, le=1)
    fuzzy_strength: float = Field(ge=0, le=1)
    semantic_strength: float = Field(ge=0, le=1)
    temporal_strength: float = Field(ge=0, le=1)
    final_weight: float = Field(ge=0, le=1)
    source_chunks: list[str] = Field(default_factory=list)


class GraphResponse(SchemaModel):
    entities: list[EntityModel]
    relations: list[RelationModel]
    graph_version: str
    next_cursor: str | None = None


class GraphBuildRequest(SchemaModel):
    model_config = ConfigDict(extra="forbid")
    document_ids: list[str] = Field(min_length=1, max_length=20)
    extraction_configuration_version: str = "course-extractor-1"
    fuzzy_configuration_version: str = "heuristic-confidence-1"
    entity_threshold: FiniteFloat = Field(default=0.8, ge=0, le=1)
    relation_threshold: FiniteFloat = Field(default=0.75, ge=0, le=1)
    dry_run: bool = False


class MentionModel(SchemaModel):
    mention_id: str
    document_id: str
    source_chunk: str
    entity_id: str
    canonical_name: str
    entity_type: str
    surface_form: str
    start_offset: int
    end_offset: int
    source_location: dict[str, str | int]
    extraction_confidence: float = Field(ge=0, le=1)
    accepted: bool


class RelationCandidate(SchemaModel):
    candidate_id: str
    document_id: str
    source_chunk: str
    source_entity: str
    target_entity: str
    relation_type: str
    evidence: str
    start_offset: int
    end_offset: int
    extraction_confidence: float = Field(ge=0, le=1)
    accepted: bool
    reason: str


class GraphBuildResult(SchemaModel):
    graph_version: str
    added_nodes: int
    updated_nodes: int
    removed_nodes: int
    added_relations: int
    updated_relations: int
    removed_relations: int
    review_count: int
    changed: bool
    dry_run: bool
    warnings: list[str]


class RelationPage(SchemaModel):
    relations: list[RelationModel]
    graph_version: str
    next_cursor: str | None = None


class EvidenceModel(SchemaModel):
    chunk_id: str
    document_id: str
    document_name: str
    text: str
    source_location: dict[str, str | int]


class EntityDetail(SchemaModel):
    entity: EntityModel
    mentions: list[MentionModel]
    incoming: list[RelationModel]
    outgoing: list[RelationModel]
    evidence: list[EvidenceModel]
    graph_version: str


class GraphPathRequest(SchemaModel):
    model_config = ConfigDict(extra="forbid")
    source_entity: str
    target_entity: str
    max_hops: int = Field(default=6, ge=1, le=10)
    relation_types: list[str] = Field(default_factory=list, max_length=30)
    minimum_confidence: FiniteFloat = Field(default=0, ge=0, le=1)
    directed: bool = False


class GraphPathResult(SchemaModel):
    nodes: list[EntityModel]
    relations: list[RelationModel]
    path_score: float
    fuzzy_composed_strength: float
    graph_version: str


class DocumentExtraction(SchemaModel):
    document_id: str
    graph_version: str
    configuration: GraphBuildRequest | None = None
    mentions: list[MentionModel]
    relation_candidates: list[RelationCandidate]


class GraphDocumentStatus(SchemaModel):
    document_id: str
    name: str
    built: bool
    accepted_mentions: int
    accepted_relations: int
    review_count: int
