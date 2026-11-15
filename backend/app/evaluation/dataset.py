"""Strict, versioned annotations with source-family split validation."""
import json
import re
from hashlib import sha256
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.ingestion.parser import normalize
from app.evaluation.leakage import audit

Split = Literal["train", "validation", "test"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Mention(StrictModel):
    start: int = Field(ge=0)
    end: int = Field(gt=0)
    canonical_name: str = Field(min_length=1)


class Relation(StrictModel):
    source: str
    predicate: str
    target: str


class Source(StrictModel):
    id: str = Field(min_length=1)
    family: str = Field(min_length=1)
    split: Split
    license: str = Field(min_length=1)
    text: str = Field(min_length=1, max_length=100000)
    mentions: list[Mention]
    relations: list[Relation]

    @model_validator(mode="after")
    def annotations(self):
        if not self.text.strip() or normalize(self.text) != self.text:
            raise ValueError(f"Source text must be normalized before annotation: {self.id}")
        names = {mention.canonical_name for mention in self.mentions}
        spans = set()
        for mention in self.mentions:
            if not mention.start < mention.end <= len(self.text):
                raise ValueError(f"Invalid mention span in {self.id}")
            span = (mention.start, mention.end)
            if span in spans:
                raise ValueError(f"Duplicate mention span in {self.id}")
            spans.add(span)
        triples = [(item.source, item.predicate, item.target) for item in self.relations]
        if len(set(triples)) != len(triples):
            raise ValueError(f"Duplicate relation in {self.id}")
        if any(item.source not in names or item.target not in names for item in self.relations):
            raise ValueError(f"Relation endpoint has no gold mention in {self.id}")
        return self


class Judgment(StrictModel):
    source_id: str
    excerpt: str = Field(min_length=1)
    grade: Literal[1, 2]


class Query(StrictModel):
    id: str
    split: Split
    text: str = Field(min_length=1, max_length=2000)
    category: Literal["single_hop", "multi_hop", "alias", "ambiguous", "no_answer", "negation"]
    answerable: bool
    judgments: list[Judgment]
    family: str | None = None


class Dataset(StrictModel):
    schema_version: Literal["1"]
    version: str
    provenance: str
    review_status: Literal["unreviewed_synthetic", "human_reviewed", "upstream_human_annotated"]
    reviewers: list[str]
    seed: int
    sources: list[Source] = Field(min_length=3, max_length=500)
    queries: list[Query] = Field(min_length=1, max_length=5000)
    annotation_tasks: list[Literal["retrieval", "extraction"]] = Field(default_factory=lambda: ["retrieval", "extraction"])
    domain: str = "soft-computing-course"
    adaptation_reviewed: bool = False

    @model_validator(mode="after")
    def integrity(self):
        sources = {source.id: source for source in self.sources}
        if len(sources) != len(self.sources) or len({q.id for q in self.queries}) != len(self.queries):
            raise ValueError("Duplicate source or query ID")
        if self.review_status == "human_reviewed" and not self.reviewers:
            raise ValueError("Reviewed datasets must name reviewers")
        if {source.split for source in self.sources} != {"train", "validation", "test"}:
            raise ValueError("All three source partitions are required")
        families, texts = {}, {}
        for source in self.sources:
            normalized = re.sub(r"\s+", " ", source.text).strip().casefold()
            for key, index in ((source.family, families), (normalized, texts)):
                if key in index and index[key] != source.split:
                    raise ValueError("Source family or duplicate text leaks across partitions")
                index[key] = source.split
        if audit(self.sources, self.queries)["near_duplicate_sources"]:
            raise ValueError("Near-duplicate source text leaks across partitions; regroup source families")
        query_texts = {}
        query_families = {source.family: source.split for source in self.sources}
        for query in self.queries:
            key = re.sub(r"\s+", " ", query.text).strip().casefold()
            if not key:
                raise ValueError("Query must not be blank")
            if key in query_texts and query_texts[key] != query.split:
                raise ValueError("Duplicate query text leaks across partitions")
            query_texts[key] = query.split
            if not query.family:
                families_for_query = sorted({sources[item.source_id].family for item in query.judgments if item.source_id in sources})
                # Shared-evidence families form the dependence unit; join in evaluator.
                query.family = "|".join(families_for_query) if families_for_query else f"unanswerable-{query.split}"
            if query.family in query_families and query_families[query.family] != query.split:
                raise ValueError("Query family leaks across partitions")
            query_families[query.family] = query.split
            if query.answerable != bool(query.judgments):
                raise ValueError(f"Answerability and evidence disagree: {query.id}")
            if (query.category == "no_answer") == query.answerable:
                raise ValueError(f"Query category and answerability disagree: {query.id}")
            seen = set()
            for judgment in query.judgments:
                source = sources.get(judgment.source_id)
                if source is None or source.split != query.split or judgment.excerpt not in source.text:
                    raise ValueError(f"Missing, cross-split or invalid evidence: {query.id}")
                if (judgment.source_id, judgment.excerpt) in seen:
                    raise ValueError(f"Duplicate judgment: {query.id}")
                seen.add((judgment.source_id, judgment.excerpt))
        return self


def load_dataset(path: Path) -> tuple[Dataset, str]:
    dataset = Dataset.model_validate_json(path.read_text(encoding="utf-8"))
    canonical = json.dumps(dataset.model_dump(), sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return dataset, sha256(canonical.encode()).hexdigest()


def query_clusters(sources, queries):
    """Connect queries sharing any source family, including multi-source questions."""
    parent = {}
    def root(value):
        parent.setdefault(value, value)
        if parent[value] != value:
            parent[value] = root(parent[value])
        return parent[value]
    families = {source.id: source.family for source in sources}
    for query in queries:
        linked = [query.family, *[families[item.source_id] for item in query.judgments]]
        for value in linked[1:]:
            parent[root(value)] = root(linked[0])
    return {query.id: root(query.family) for query in queries}
