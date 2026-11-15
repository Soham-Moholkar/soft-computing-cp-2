from enum import StrEnum
from math import isfinite

from pydantic import Field, field_validator, model_validator

from app.models.common import SchemaModel


class MembershipType(StrEnum):
    TRIANGULAR = "triangular"
    TRAPEZOIDAL = "trapezoidal"
    GAUSSIAN = "gaussian"


class InferenceMethod(StrEnum):
    MAMDANI = "mamdani"
    SUGENO = "sugeno"


class DefuzzificationMethod(StrEnum):
    CENTROID = "centroid"
    BISECTOR = "bisector"
    MEAN_OF_MAXIMA = "mean_of_maxima"


class MembershipDefinition(SchemaModel):
    membership_type: MembershipType
    parameters: tuple[float, ...]

    @field_validator("parameters")
    @classmethod
    def parameters_must_be_finite(cls, values: tuple[float, ...]) -> tuple[float, ...]:
        if not all(isfinite(value) for value in values):
            raise ValueError("membership parameters must be finite")
        return values

    @model_validator(mode="after")
    def parameters_match_function(self) -> "MembershipDefinition":
        expected = {MembershipType.TRIANGULAR: 3, MembershipType.TRAPEZOIDAL: 4, MembershipType.GAUSSIAN: 2}[self.membership_type]
        if len(self.parameters) != expected:
            raise ValueError(f"{self.membership_type} requires {expected} parameters")
        if self.membership_type == MembershipType.GAUSSIAN and self.parameters[1] <= 0:
            raise ValueError("gaussian sigma must be positive")
        if self.membership_type != MembershipType.GAUSSIAN and any(left > right for left, right in zip(self.parameters, self.parameters[1:])):
            raise ValueError("membership parameters must be ordered")
        if self.membership_type == MembershipType.TRIANGULAR and self.parameters[0] == self.parameters[2]:
            raise ValueError("triangular support must have non-zero width")
        if self.membership_type == MembershipType.TRAPEZOIDAL and self.parameters[0] == self.parameters[3]:
            raise ValueError("trapezoidal support must have non-zero width")
        return self


class FuzzyEvaluationRequest(SchemaModel):
    inputs: dict[str, float]
    variable_set_version: str = "fuzzy-variables-1"
    rule_set_version: str = "fuzzy-rules-1"
    inference_method: InferenceMethod = InferenceMethod.MAMDANI
    defuzzification_method: DefuzzificationMethod = DefuzzificationMethod.CENTROID

    @field_validator("inputs")
    @classmethod
    def validates_input_universe(cls, inputs: dict[str, float]) -> dict[str, float]:
        expected = {"semantic_similarity", "relation_strength", "graph_distance"}
        if set(inputs) != expected:
            raise ValueError("inputs must contain semantic_similarity, relation_strength, and graph_distance")
        if not all(isfinite(value) for value in inputs.values()):
            raise ValueError("inputs must be finite")
        if not 0 <= inputs["semantic_similarity"] <= 1 or not 0 <= inputs["relation_strength"] <= 1:
            raise ValueError("semantic_similarity and relation_strength must be within 0 and 1")
        if not 1 <= inputs["graph_distance"] <= 5:
            raise ValueError("graph_distance must be within 1 and 5")
        return inputs

    @field_validator("variable_set_version")
    @classmethod
    def validates_variable_version(cls, value: str) -> str:
        if value != "fuzzy-variables-1":
            raise ValueError("unsupported variable_set_version")
        return value

    @field_validator("rule_set_version")
    @classmethod
    def validates_rule_version(cls, value: str) -> str:
        if value != "fuzzy-rules-1":
            raise ValueError("unsupported rule_set_version")
        return value


class RuleTrace(SchemaModel):
    rule_id: str
    rule: str
    antecedent_memberships: dict[str, float]
    unweighted_firing: float = Field(ge=0, le=1)
    weight: float = Field(ge=0, le=1)
    weighted_firing: float = Field(ge=0, le=1)
    strength: float = Field(ge=0, le=1)
    consequent: str


class OutputSample(SchemaModel):
    x: float = Field(ge=0, le=1)
    membership: float = Field(ge=0, le=1)


class FuzzyEvaluationResult(SchemaModel):
    score: float = Field(ge=0, le=1)
    label: str
    memberships: dict[str, float]
    rule_firings: list[RuleTrace]
    aggregated_output: list[OutputSample]
    controller_decision: str
    variable_set_version: str
    rule_set_version: str
    inference_method: InferenceMethod
    defuzzification_method: DefuzzificationMethod
    defuzzification_applied: bool
