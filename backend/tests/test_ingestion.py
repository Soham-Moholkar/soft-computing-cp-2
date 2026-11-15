from fastapi.testclient import TestClient

from app.main import create_app
from app.repositories.in_memory_ingestion import InMemoryIngestionRepository


def test_paste_ingestion_is_deterministic_chunked_and_has_completed_job_history() -> None:
    repository = InMemoryIngestionRepository()
    client = TestClient(create_app(ingestion_repository=repository))
    payload = {
        "source_type": "paste",
        "name": "Fuzzy notes",
        "domain": "soft-computing",
        "text": "fuzzy logic ranks graph evidence deterministically",
        "chunk_size": 2,
    }
    first = client.post("/api/ingestion/upload", json=payload)
    second = client.post("/api/ingestion/upload", json=payload)
    assert first.status_code == 202
    assert first.json() == second.json()
    accepted = first.json()
    assert accepted["schema_version"] == "1.0"
    assert accepted["created_at"] == "2026-09-02T05:00:00Z"

    job = client.get(f"/api/ingestion/jobs/{accepted['job_id']}")
    assert job.status_code == 200
    body = job.json()
    assert body["document_id"] == accepted["document_id"]
    assert body["status"] == "completed"
    assert [stage["stage"] for stage in body["stages"]] == ["uploaded", "parsing", "chunking", "completed"]
    assert body["final_counts"] == {"chunks": 3, "entities": 0, "relations": 0}
    assert "deferred" in body["warnings"][0].lower()
    assert [chunk.token_count for chunk in repository.chunks[accepted["document_id"]]] == [2, 2, 2]


def test_url_ingestion_is_accepted_without_fetching_the_source() -> None:
    client = TestClient(create_app(ingestion_repository=InMemoryIngestionRepository()))
    response = client.post(
        "/api/ingestion/upload",
        json={"source_type": "url", "name": "Reference", "domain": "soft-computing", "source_uri": "https://example.test/notes"},
    )
    assert response.status_code == 202
    job = client.get(f"/api/ingestion/jobs/{response.json()['job_id']}").json()
    assert job["final_counts"]["entities"] == 0
    assert job["final_counts"]["relations"] == 0
    assert "not fetched" in job["warnings"][0].lower()


def test_metadata_only_file_placeholder_reports_that_content_was_not_parsed() -> None:
    client = TestClient(create_app(ingestion_repository=InMemoryIngestionRepository()))
    response = client.post(
        "/api/ingestion/upload",
        json={"source_type": "sample", "name": "Teaching sample", "domain": "soft-computing"},
    )
    assert response.status_code == 202
    job = client.get(f"/api/ingestion/jobs/{response.json()['job_id']}").json()
    assert "not parsed" in job["warnings"][0].lower()


def test_ingestion_discriminator_validation_is_strict_and_never_echoes_source_text() -> None:
    client = TestClient(create_app())
    secret_text = "TOP SECRET SOURCE TEXT"
    invalid_payloads = (
        {"source_type": "paste", "name": "x", "domain": "x", "text": "   "},
        {"source_type": "url", "name": "x", "domain": "x"},
        {"source_type": "paste", "name": "x", "domain": "x", "text": secret_text, "unexpected": True},
        {"source_type": "paste", "name": "x", "domain": "x", "text": "valid", "chunk_size": 0},
    )
    for payload in invalid_payloads:
        response = client.post("/api/ingestion/upload", json=payload)
        assert response.status_code == 422
        body = response.json()
        assert body["code"] == "validation_error"
        assert body["request_id"] == "local-request"
        assert secret_text not in response.text


def test_unknown_ingestion_job_uses_typed_not_found_envelope() -> None:
    client = TestClient(create_app())
    response = client.get("/api/ingestion/jobs/job-missing")
    assert response.status_code == 404
    assert response.json() == {
        "code": "not_found",
        "message": "ingestion job 'job-missing' was not found",
        "details": {"resource": "ingestion job", "id": "job-missing"},
        "request_id": "local-request",
    }


def test_ingestion_openapi_documents_discriminated_request_and_job_response() -> None:
    schema = TestClient(create_app()).get("/openapi.json").json()
    upload = schema["paths"]["/api/ingestion/upload"]["post"]
    request_schema = upload["requestBody"]["content"]["application/json"]["schema"]
    assert request_schema["discriminator"]["propertyName"] == "source_type"
    assert upload["responses"]["202"]["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/IngestionAccepted"
    assert schema["paths"]["/api/ingestion/jobs/{job_id}"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/IngestionJob"
