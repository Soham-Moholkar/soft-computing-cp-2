from fastapi.testclient import TestClient

from app.main import create_app
from app.repositories.in_memory_graph import InMemoryGraphRepository


def test_repository_is_deterministic_and_filters_by_contract_fields() -> None:
    repository = InMemoryGraphRepository()
    initial = repository.get_subgraph()
    rerun = repository.get_subgraph()
    assert initial == rerun
    assert initial.graph_version == "graph-local-1"
    assert [entity.entity_id for entity in repository.get_subgraph(entity_type="Concept").entities] == ["entity-fuzzy"]
    confidence_filtered = repository.get_subgraph(minimum_confidence=0.88)
    assert [entity.entity_id for entity in confidence_filtered.entities] == ["entity-fuzzy", "entity-graph", "entity-retrieval"]
    assert [relation.relation_id for relation in confidence_filtered.relations] == ["relation-fuzzy-retrieval"]


def test_health_reports_dependency_state_and_version_identifiers() -> None:
    client = TestClient(create_app(repository=InMemoryGraphRepository()))
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["services"] == {"graph_repository": "healthy", "ingestion_repository": "healthy"}
    assert body["schema_version"] == "1.0"
    assert body["graph_version"] == "graph-local-1"


def test_graph_endpoint_matches_documented_response_shape_and_openapi_schema() -> None:
    client = TestClient(create_app(repository=InMemoryGraphRepository()))
    response = client.get("/api/graph", params={"entity_type": "Concept", "minimum_confidence": 0.9})
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"schema_version", "entities", "relations", "graph_version", "next_cursor"}
    assert body["entities"][0]["canonical_name"] == "Fuzzy Logic"
    assert all(0 <= relation["final_weight"] <= 1 for relation in body["relations"])

    schema = client.get("/openapi.json").json()
    operation = schema["paths"]["/api/graph"]["get"]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/GraphResponse"
    graph_schema = schema["components"]["schemas"]["GraphResponse"]
    assert {"entities", "relations", "graph_version", "next_cursor", "schema_version"} <= set(graph_schema["properties"])


def test_invalid_query_uses_the_typed_error_envelope() -> None:
    client = TestClient(create_app(repository=InMemoryGraphRepository()))
    response = client.get("/api/graph", params={"minimum_confidence": "not-a-number"})
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert body["request_id"] == "local-request"
    assert body["details"]["errors"][0]["loc"] == ["query", "minimum_confidence"]


def test_graph_pages_are_stable_and_every_relation_has_returned_endpoints() -> None:
    client = TestClient(create_app(repository=InMemoryGraphRepository()))
    first_page = client.get("/api/graph", params={"limit": 2}).json()
    second_page = client.get("/api/graph", params={"limit": 2, "cursor": first_page["next_cursor"]}).json()
    assert first_page["next_cursor"] == "entity-graph"
    assert [entity["entity_id"] for entity in first_page["entities"]] == ["entity-fuzzy", "entity-graph"]
    assert [entity["entity_id"] for entity in second_page["entities"]] == ["entity-retrieval"]
    for page in (first_page, second_page):
        entity_ids = {entity["entity_id"] for entity in page["entities"]}
        assert all(relation["source_entity"] in entity_ids and relation["target_entity"] in entity_ids for relation in page["relations"])


def test_graph_source_and_confidence_filters_apply_to_entities_and_relations() -> None:
    client = TestClient(create_app(repository=InMemoryGraphRepository()))
    source_filtered = client.get("/api/graph", params={"source": "seed-fuzzy"}).json()
    assert [entity["entity_id"] for entity in source_filtered["entities"]] == ["entity-fuzzy"]
    assert source_filtered["relations"] == []

    confidence_filtered = client.get("/api/graph", params={"minimum_confidence": 0.88}).json()
    assert [entity["entity_id"] for entity in confidence_filtered["entities"]] == ["entity-fuzzy", "entity-graph", "entity-retrieval"]
    assert [relation["relation_id"] for relation in confidence_filtered["relations"]] == ["relation-fuzzy-retrieval"]


def test_graph_query_bounds_and_local_cors_are_enforced() -> None:
    client = TestClient(create_app(repository=InMemoryGraphRepository()))
    for query in ({"minimum_confidence": -0.01}, {"minimum_confidence": 1.01}, {"minimum_confidence": "inf"}, {"limit": 0}, {"limit": 501}):
        assert client.get("/api/graph", params=query).status_code == 422

    cors = client.options(
        "/api/graph",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert cors.status_code == 200
    assert cors.headers["access-control-allow-origin"] == "http://localhost:3000"
