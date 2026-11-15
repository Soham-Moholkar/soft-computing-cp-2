from typing import Annotated
from typing import Literal
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Body, FastAPI, File, Form, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import FiniteFloat

from app.core.config import settings
from app.core.errors import ErrorEnvelope, IngestionError, NotFoundError
from app.core.versions import VersionIdentifiers, version_metadata
from app.models.graph import DocumentExtraction, EntityDetail, GraphBuildRequest, GraphBuildResult, GraphDocumentStatus, GraphPathRequest, GraphPathResult, GraphResponse, RelationPage
from app.models.fuzzy import FuzzyEvaluationRequest, FuzzyEvaluationResult
from app.fuzzy.engine import FuzzyEngine
from app.models.ingestion import DocumentDetail, IngestionAccepted, IngestionJob, IngestionRequest, ReferenceIngestionRequest
from app.repositories.in_memory_graph import InMemoryGraphRepository
from app.repositories.ingestion_protocols import IngestionRepository
from app.repositories.protocols import GraphRepository
from app.repositories.sqlite_ingestion import SQLiteIngestionRepository
from app.repositories.sqlite_graph import SQLiteGraphRepository
from app.ingestion.service import IngestionService
from app.ingestion.parser import MAX_BYTES
from app.models.retrieval import RetrievalRequest, RetrievalResult, FeedbackRequest, ExplanationRequest
from app.retrieval.service import RetrievalService
from app.optimization.service import OptimizationService, BANK_PATHS
from app.optimization.aco import search as ant_search
from app.models.optimization import OptimizationRequest, AntSearchRequest
from app.graph.extraction import DEFAULT_ONTOLOGY
import json


class HealthResponse(VersionIdentifiers):
    code: str
    message: str
    request_id: str
    status: str
    services: dict[str, str]
    schema_version: str
    graph_version: str
    index_version: str
    configuration_version: str


def create_app(
    repository: GraphRepository | None = None,
    ingestion_repository: IngestionRepository | None = None,
    database_path: str | None = None,
    ranker_path: str | None = None,
    enable_optimizers: bool = True,
    ontology=DEFAULT_ONTOLOGY,
    retrieval_policy=None,
) -> FastAPI:
    durable_repository = SQLiteIngestionRepository(database_path or settings.ingestion_database) if ingestion_repository is None else None
    ingestion_service = IngestionService(durable_repository) if durable_repository else None

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if ingestion_service:
            ingestion_service.start()
        if optimization_service:
            optimization_service.start()
        yield
        if ingestion_service:
            ingestion_service.close()
        if optimization_service:
            optimization_service.close()

    app = FastAPI(title=settings.application_name, version=settings.schema_version, lifespan=lifespan)
    persistent_graph = SQLiteGraphRepository(durable_repository, ontology) if durable_repository and repository is None else None
    app.state.graph_repository = repository or persistent_graph or InMemoryGraphRepository()
    app.state.ingestion_repository = ingestion_repository or durable_repository
    app.state.ingestion_service = ingestion_service
    app.state.fuzzy_engine = FuzzyEngine()
    retrieval_service = RetrievalService(durable_repository, persistent_graph, ranker_path=ranker_path, policy=retrieval_policy) if persistent_graph else None
    app.state.retrieval_service = retrieval_service
    optimization_service = OptimizationService(durable_repository) if durable_repository and enable_optimizers else None
    app.state.optimization_service = optimization_service
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
    )

    @app.exception_handler(NotFoundError)
    async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
        body = ErrorEnvelope(code="not_found", message=str(exc), details={"resource": exc.resource, "id": exc.identifier}, request_id=request.headers.get("x-request-id", "local-request"))
        return JSONResponse(status_code=404, content=body.model_dump(mode="json"))

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [{"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]} for error in exc.errors()]
        body = ErrorEnvelope(code="validation_error", message="Request validation failed", details={"errors": errors}, request_id=request.headers.get("x-request-id", "local-request"))
        return JSONResponse(status_code=422, content=body.model_dump(mode="json"))

    @app.exception_handler(IngestionError)
    async def ingestion_error_handler(request: Request, exc: IngestionError) -> JSONResponse:
        body = ErrorEnvelope(code=exc.code, message=str(exc), request_id=request.headers.get("x-request-id", "local-request"))
        return JSONResponse(status_code=exc.status, content=body.model_dump(mode="json"))

    @app.get("/health", response_model=HealthResponse, tags=["operations"])
    def health() -> HealthResponse:
        metadata = version_metadata().model_dump()
        metadata["graph_version"] = app.state.graph_repository.get_subgraph(limit=1).graph_version
        services = {"graph_repository": "healthy", "ingestion_repository": "healthy"}
        if retrieval_service:
            metadata.update(retrieval_service.versions())
            services["ranking_artifact"] = retrieval_service.ranker.status if retrieval_service.ranker else "baseline_artifact_rejected" if retrieval_service.ranker_warning else "baseline"
        return HealthResponse(code="ok", message="SoftGraph backend is healthy", request_id="local-request", status="healthy", services=services, **metadata)

    @app.post("/api/ingestion/upload", response_model=IngestionAccepted, status_code=202, tags=["ingestion"])
    def upload_ingestion(
        payload: Annotated[IngestionRequest, Body(discriminator="source_type")],
    ) -> IngestionAccepted:
        if ingestion_service:
            return ingestion_service.submit(payload)
        return app.state.ingestion_repository.submit(payload)

    @app.post("/api/ingestion/upload/file", response_model=IngestionAccepted, status_code=202, tags=["ingestion"])
    async def upload_file(
        file: Annotated[UploadFile, File()],
        source_type: Annotated[Literal["txt", "pdf", "docx", "csv", "json"], Form()],
        name: Annotated[str, Form(min_length=1, max_length=255)],
        domain: Annotated[str, Form(min_length=1, max_length=120)],
        chunk_size: Annotated[int, Form(ge=1, le=2000)] = 400,
        chunk_overlap: Annotated[int, Form(ge=0, le=256)] = 64,
    ) -> IngestionAccepted:
        if not ingestion_service:
            raise IngestionError("File uploads require the durable ingestion service.")
        try:
            if not name.strip() or not domain.strip() or chunk_overlap >= chunk_size:
                raise IngestionError("Provide nonblank metadata and an overlap smaller than the chunk size.")
            if Path(file.filename or "").suffix.lower() != "." + source_type:
                raise IngestionError("The selected source type must match the file extension.")
            content = await file.read(MAX_BYTES + 1)
            payload = ReferenceIngestionRequest(source_type=source_type, name=name, domain=domain, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
            return ingestion_service.submit(payload, content)
        finally:
            await file.close()

    @app.get("/api/ingestion/jobs/{job_id}", response_model=IngestionJob, tags=["ingestion"])
    def get_ingestion_job(job_id: str) -> IngestionJob:
        return app.state.ingestion_repository.get_job(job_id)

    @app.get("/api/ingestion/jobs", response_model=list[IngestionJob], tags=["ingestion"])
    def list_ingestion_jobs(limit: Annotated[int, Query(ge=1, le=100)] = 20) -> list[IngestionJob]:
        if durable_repository is None:
            return []
        return durable_repository.list_jobs(limit)

    @app.post("/api/ingestion/jobs/{job_id}/retry", response_model=IngestionAccepted, status_code=202, tags=["ingestion"])
    def retry_ingestion(job_id: str) -> IngestionAccepted:
        if durable_repository is None or ingestion_service is None:
            raise IngestionError("Retries require the durable ingestion service.")
        ingestion_service.start()
        accepted = durable_repository.retry(job_id)
        ingestion_service.schedule(job_id)
        return accepted

    @app.get("/api/ingestion/documents/{document_id}", response_model=DocumentDetail, tags=["ingestion"])
    def get_ingested_document(document_id: str, offset: Annotated[int, Query(ge=0)] = 0, limit: Annotated[int, Query(ge=1, le=100)] = 20) -> DocumentDetail:
        if durable_repository is None:
            raise NotFoundError("document", document_id)
        return durable_repository.get_document(document_id, offset, limit)

    @app.post("/api/fuzzy/evaluate", response_model=FuzzyEvaluationResult, tags=["fuzzy"])
    def evaluate_fuzzy(payload: FuzzyEvaluationRequest) -> FuzzyEvaluationResult:
        return app.state.fuzzy_engine.evaluate(payload)

    def retrieval_store() -> RetrievalService:
        if retrieval_service is None:
            raise IngestionError("Retrieval requires persistent ingestion and graph repositories.", "retrieval_unavailable", 409)
        return retrieval_service

    @app.post("/api/retrieve", response_model=RetrievalResult, tags=["retrieval"])
    @app.post("/api/hybrid/retrieve", response_model=RetrievalResult, tags=["retrieval"])
    def retrieve(payload: RetrievalRequest) -> RetrievalResult:
        return retrieval_store().retrieve(payload)

    @app.get("/api/retrieval/results/{result_id}", response_model=RetrievalResult, tags=["retrieval"])
    def retrieval_result(result_id: str) -> RetrievalResult:
        return retrieval_store().get_result(result_id)

    @app.post("/api/hybrid/feedback", tags=["retrieval"])
    def retrieval_feedback(payload: FeedbackRequest):
        return retrieval_store().feedback(payload)

    @app.post("/api/explanations", tags=["retrieval"])
    def retrieval_explanation(payload: ExplanationRequest):
        return retrieval_store().explain(payload.result_id)

    def optimizer_store():
        if optimization_service is None:
            raise IngestionError("Optimization requires persistent storage and enabled diagnostics.", "optimization_unavailable", 409)
        return optimization_service

    @app.post("/api/optimization/jobs", status_code=202, tags=["optimization"])
    def submit_optimization(payload: OptimizationRequest):
        return optimizer_store().submit(payload)

    @app.get("/api/optimization/jobs", tags=["optimization"])
    def list_optimization():
        return optimizer_store().list()

    @app.get("/api/optimization/jobs/{job_id}", tags=["optimization"])
    def get_optimization(job_id: str):
        return optimizer_store().get(job_id)

    @app.get("/api/optimization/datasets", tags=["optimization"])
    def optimization_datasets():
        result = []
        for name, paths in BANK_PATHS.items():
            ready = paths["validation"].exists()
            report = json.loads(paths["validation"].read_text(encoding="utf-8")) if ready else {}
            result.append({"id": name, "ready": ready, "training_ready": paths["train"].exists(),
                           "domain": report.get("domain"), "dataset_version": report.get("dataset_version"),
                           "review_status": report.get("review_status"), "dataset_sha256": report.get("dataset_sha256")})
        return result

    @app.post("/api/aco/search", tags=["optimization"])
    def search_ants(payload: AntSearchRequest):
        entities, relations, version = graph_store().snapshot()
        try:
            result = ant_search(entities, relations, payload.source_entity, payload.target_entity,
                               payload.ants, payload.iterations, payload.max_hops, payload.seed, payload.directed)
        except ValueError as error:
            raise IngestionError(str(error), "invalid_aco_search", 422) from error
        return {**result, "graph_version": version}

    @app.get("/api/benchmark", tags=["evaluation"])
    def benchmark_reports():
        folder = Path(__file__).resolve().parents[1] / "evaluation" / "runs"
        reports = []
        for identifier in ("synthetic-hard-validation-v3", "squad-validation-baseline-v3", "squad-validation-candidate-v3"):
            path = folder / identifier / "report.json"
            if path.exists():
                report = json.loads(path.read_text(encoding="utf-8"))
                reports.append({"id": identifier, **{key: report[key] for key in ("dataset_version", "dataset_sha256", "code_sha256", "review_status", "domain", "split", "source_count", "top_k", "summary", "extraction", "limitations")}})
        return {"reports": reports, "optimizer_runs": optimizer_store().list(), "production_promoted": bool(retrieval_service and retrieval_service.ranker)}

    def graph_store() -> SQLiteGraphRepository:
        if persistent_graph is None:
            raise IngestionError("This operation requires the persistent graph repository.", "graph_unavailable", 409)
        return persistent_graph

    @app.post("/api/graph/build", response_model=GraphBuildResult, tags=["graph"])
    def build_graph(payload: GraphBuildRequest) -> GraphBuildResult:
        return graph_store().build(payload)

    @app.get("/api/graph/relations", response_model=RelationPage, tags=["graph"])
    def graph_relations(cursor: str | None = None, limit: Annotated[int, Query(ge=1, le=500)] = 100, relation_type: str | None = None, source: str | None = None, minimum_confidence: Annotated[FiniteFloat, Query(ge=0, le=1)] = 0) -> RelationPage:
        return graph_store().relation_page(cursor, limit, relation_type, source, minimum_confidence)

    @app.get("/api/graph/entity/{entity_id}", response_model=EntityDetail, tags=["graph"])
    def graph_entity(entity_id: str) -> EntityDetail:
        return graph_store().entity_detail(entity_id)

    @app.post("/api/graph/path", response_model=GraphPathResult, tags=["graph"])
    def graph_path(payload: GraphPathRequest) -> GraphPathResult:
        return graph_store().path(payload)

    @app.get("/api/graph/documents/{document_id}", response_model=DocumentExtraction, tags=["graph"])
    def graph_document(document_id: str) -> DocumentExtraction:
        return graph_store().extraction(document_id)

    @app.get("/api/graph/documents", response_model=list[GraphDocumentStatus], tags=["graph"])
    def graph_documents(limit: Annotated[int, Query(ge=1, le=100)] = 100) -> list[GraphDocumentStatus]:
        return graph_store().documents(limit)

    @app.delete("/api/graph/documents/{document_id}", tags=["graph"])
    def remove_graph_document(document_id: str) -> dict[str, str]:
        return {"graph_version": graph_store().remove_document(document_id)}

    @app.get("/api/graph", response_model=GraphResponse, tags=["graph"])
    def graph(
        entity_type: str | None = None,
        relation_type: str | None = None,
        source: str | None = None,
        minimum_confidence: Annotated[
            FiniteFloat,
            Query(ge=0, le=1, description="Minimum fuzzy confidence/strength for both entities and relations."),
        ] = 0,
        cursor: str | None = None,
        limit: Annotated[int, Query(ge=1, le=500)] = 100,
    ) -> GraphResponse:
        return app.state.graph_repository.get_subgraph(
            entity_type=entity_type,
            relation_type=relation_type,
            source=source,
            minimum_confidence=minimum_confidence,
            cursor=cursor,
            limit=limit,
        )

    return app
