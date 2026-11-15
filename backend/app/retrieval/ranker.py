"""Small data-only ranking artifacts; no pickle, executable code or remote loads."""
import json
from hashlib import sha256
from math import isclose
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator

FEATURES = ("lexical", "graph", "fuzzy", "coverage")
FEATURE_VERSION = "ranking-features-1"
PROMOTION_POLICY_VERSION = "course-production-gate-1"


class RankerArtifact(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    schema_version: Literal["1"] = "1"
    feature_version: Literal["ranking-features-1"] = FEATURE_VERSION
    status: Literal["candidate", "promoted"] = "candidate"
    domain: str
    weights: tuple[FiniteFloat, FiniteFloat, FiniteFloat, FiniteFloat]
    dataset_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    training_code_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    seed: int
    training: dict
    promotion: dict | None = None
    checksum: str = Field(pattern=r"^[a-f0-9]{64}$")

    @model_validator(mode="after")
    def valid(self):
        if any(weight < 0 or weight > 1 for weight in self.weights) or not isclose(sum(self.weights), 1, abs_tol=1e-9):
            raise ValueError("Weights must be a nonnegative simplex")
        if digest(self.model_dump(exclude={"checksum"})) != self.checksum:
            raise ValueError("Artifact checksum mismatch")
        if self.status == "promoted" and (not self.promotion or self.promotion.get("accepted") is not True):
            raise ValueError("Promotion evidence is required")
        if self.status == "promoted":
            candidate = {**self.model_dump(exclude={"checksum"}), "status": "candidate", "promotion": None}
            if self.promotion.get("policy", {}).get("version") != PROMOTION_POLICY_VERSION or self.promotion.get("reasons") != [] or self.promotion.get("candidate_checksum") != digest(candidate):
                raise ValueError("Promotion record does not match this model and policy")
            if set(self.promotion.get("report_digests", {})) != {"validation", "test"}:
                raise ValueError("Validation and test evidence hashes are required")
        return self

    def score(self, features):
        return sum(weight * value for weight, value in zip(self.weights, features, strict=True))


def digest(payload):
    return sha256(json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def seal(payload):
    body = {key: value for key, value in payload.items() if key != "checksum"}
    body["weights"] = [float(value) for value in body["weights"]]
    body.setdefault("schema_version", "1")
    body.setdefault("feature_version", FEATURE_VERSION)
    body.setdefault("status", "candidate")
    body.setdefault("promotion", None)
    body["checksum"] = digest(body)
    return RankerArtifact.model_validate(body)


def load_ranker(path: Path, allow_candidate=False):
    if path.stat().st_size > 65536:
        raise ValueError("Artifact exceeds 64 KiB")
    artifact = RankerArtifact.model_validate_json(path.read_text(encoding="utf-8"))
    if not allow_candidate and artifact.status != "promoted":
        raise ValueError("Candidate artifacts cannot serve live retrieval")
    if not allow_candidate and artifact.domain != "soft-computing-course":
        raise ValueError("Artifact domain does not match the production course ontology")
    return artifact
