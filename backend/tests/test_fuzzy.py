import math

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.fuzzy.engine import FuzzyEngine
from app.fuzzy.membership import complement, gaussian, intersection, trapezoidal, triangular, union
from app.main import create_app
from app.models.fuzzy import FuzzyEvaluationRequest, MembershipDefinition, MembershipType


def request(**overrides: object) -> FuzzyEvaluationRequest:
    return FuzzyEvaluationRequest(
        inputs={"semantic_similarity": 0.91, "relation_strength": 0.83, "graph_distance": 1.6},
        **overrides,
    )


def test_memberships_support_shoulders_reject_degenerate_support_and_bound_values() -> None:
    assert triangular(0, 0, 0, 1) == 1
    assert triangular(1, 0, 1, 1) == 1
    assert trapezoidal(-5, 0, 0, 0.4, 1) == 1
    assert trapezoidal(5, 0, 0.6, 1, 1) == 1
    assert math.isclose(gaussian(0.5, 0.5, 0.2), 1)
    assert union(0.2, 0.8) == 0.8
    assert intersection(0.2, 0.8) == 0.2
    assert complement(0.2) == 0.8
    with pytest.raises(ValueError):
        triangular(0.5, 0, 0, 0)
    with pytest.raises(ValueError):
        trapezoidal(0.5, 0, 0.5, 1, 0.9)
    with pytest.raises(ValueError):
        triangular(float("nan"), 0, 0.5, 1)
    with pytest.raises(ValueError):
        union(float("inf"), 0.5)
    with pytest.raises(ValidationError):
        MembershipDefinition(membership_type=MembershipType.GAUSSIAN, parameters=(0.5, 0))


def test_mamdani_exposes_full_trace_output_universe_and_defuzzification_variants() -> None:
    engine = FuzzyEngine()
    centroid = engine.evaluate(request())
    bisector = engine.evaluate(request(defuzzification_method="bisector"))
    maxima = engine.evaluate(request(defuzzification_method="mean_of_maxima"))
    assert centroid.inference_method == "mamdani"
    assert 0 <= centroid.score <= 1
    assert len(centroid.aggregated_output) == 101
    assert centroid.aggregated_output[0].x == 0
    assert centroid.aggregated_output[-1].x == 1
    assert len(centroid.rule_firings) == 3
    assert all(0 <= trace.unweighted_firing <= 1 and trace.weighted_firing == trace.strength <= 1 for trace in centroid.rule_firings)
    rule_two = centroid.rule_firings[1]
    assert rule_two.weight == 0.9
    assert rule_two.weighted_firing == pytest.approx(rule_two.unweighted_firing * rule_two.weight)
    assert centroid.variable_set_version == "fuzzy-variables-1"
    assert centroid.rule_set_version == "fuzzy-rules-1"
    assert len({centroid.score, bisector.score, maxima.score}) >= 2


def test_sugeno_uses_weighted_consequents_and_changes_with_inputs() -> None:
    engine = FuzzyEngine()
    high = engine.evaluate(request(inference_method="sugeno"))
    low = engine.evaluate(FuzzyEvaluationRequest(inputs={"semantic_similarity": 0.05, "relation_strength": 0.05, "graph_distance": 5}, inference_method="sugeno"))
    assert high.inference_method == "sugeno"
    assert not high.defuzzification_applied
    assert high.score > low.score
    assert len(high.aggregated_output) == 101
    assert high.controller_decision in {"Reject", "Review", "Accept weakly", "Accept strongly"}


def test_fuzzy_endpoint_contract_validation_and_openapi_are_typed() -> None:
    client = TestClient(create_app())
    payload = {
        "inputs": {"semantic_similarity": 0.91, "relation_strength": 0.83, "graph_distance": 1.6},
        "inference_method": "mamdani",
        "defuzzification_method": "centroid",
    }
    response = client.post("/api/fuzzy/evaluate", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == "1.0"
    assert body["inference_method"] == "mamdani"
    assert len(body["aggregated_output"]) == 101
    assert body["defuzzification_applied"]
    invalid = client.post("/api/fuzzy/evaluate", json={**payload, "inputs": {"semantic_similarity": 2, "relation_strength": 0.83, "graph_distance": 1.6}})
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "validation_error"
    missing = client.post("/api/fuzzy/evaluate", json={**payload, "inputs": {"semantic_similarity": 0.9}})
    assert missing.status_code == 422
    unsupported_version = client.post("/api/fuzzy/evaluate", json={**payload, "rule_set_version": "unknown"})
    assert unsupported_version.status_code == 422
    schema = client.get("/openapi.json").json()
    operation = schema["paths"]["/api/fuzzy/evaluate"]["post"]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/FuzzyEvaluationResult"
