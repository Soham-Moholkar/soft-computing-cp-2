from typing import Literal

from pydantic import Field, field_validator

from app.models.common import SchemaModel
from app.models.fuzzy import FuzzyEvaluationResult
from app.models.graph import EntityModel, RelationModel


class RetrievalRequest(SchemaModel):
    query: str = Field(min_length=1, max_length=2000)
    mode: Literal["lexical", "semantic", "graph", "fuzzy", "hybrid", "aco"] = "hybrid"
    top_k: int = Field(default=5, ge=1, le=10)
    max_hops: int = Field(default=4, ge=1, le=5)
    use_provider: bool = False
    ranking_profile: Literal["balanced", "domain"] = "balanced"
    document_id: str | None = Field(default=None, min_length=1, max_length=100)

    @field_validator("query")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("query must not be blank")
        return value.strip()


class Evidence(SchemaModel):
    citation: int
    chunk_id: str
    document_id: str
    document_name: str
    text: str
    excerpt: str
    source_location: dict[str, str | int]
    lexical_score: float
    graph_score: float
    fuzzy_score: float
    rank_score: float


class RetrievalPath(SchemaModel):
    labels: list[str]
    entity_ids: list[str]
    relation_ids: list[str]
    citation_ids: list[int]
    score: float
    traversal: str = "undirected BFS; edge direction remains in the relations"


class ScoreContribution(SchemaModel):
    component: str
    raw_score: float
    weight: float
    contribution: float


class RetrievalResult(SchemaModel):
    result_id: str
    query: str
    answer: str
    answer_status: Literal["evidence", "insufficient_evidence"]
    confidence: float
    confidence_label: str = "Heuristic ranking score; not a probability of correctness"
    mode: str
    nodes: list[EntityModel]
    relations: list[RelationModel]
    evidence: list[Evidence]
    paths: list[RetrievalPath]
    score_breakdown: list[ScoreContribution]
    fuzzy_explanation: FuzzyEvaluationResult
    graph_version: str
    index_version: str
    configuration_version: str = "retrieval-bm25-1"
    provider_status: str
    provider_model_requested: str | None = None
    provider_parameters: dict[str, str | int | float] = Field(default_factory=dict)
    warnings: list[str]
    timeline: list[dict[str, str | float]]


class FeedbackRequest(SchemaModel):
    result_id: str = Field(min_length=1, max_length=80)
    feedback: Literal["relevant", "partial", "irrelevant"]


class ExplanationRequest(SchemaModel):
    result_id: str = Field(min_length=1, max_length=80)
