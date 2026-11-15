"""Single-instance SaaS shell with isolated workspace databases."""
import json
from contextlib import AsyncExitStack, asynccontextmanager
from os import getenv
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.core.config import settings
from app.factory import create_app
from app.models.ingestion import PasteIngestionRequest
from app.operations.auth import AuthSettings, COOKIE
from app.operations.middleware import RequestGuard
from app.workspaces import PROFILES, descriptor, ontology_for
from app.domain_profiles import POLICIES
from app.hospital.routes import install_hospital_api
from app.hospital.assessment import install_assessment_api

class Login(BaseModel):
    model_config = ConfigDict(extra="forbid")
    access_key: str = Field(min_length=1, max_length=256)

class Preferences(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["lexical", "hybrid", "fuzzy", "graph"] = "hybrid"
    top_k: int = Field(default=5, ge=1, le=10)
    max_hops: int = Field(default=3, ge=1, le=5)
    view: Literal["cards", "list"] = "cards"
    ranking_profile: Literal["balanced", "domain"] = "balanced"

def install_workspace_api(app, workspace):
    repository = app.state.ingestion_repository
    with repository.connect() as db:
        db.execute("CREATE TABLE IF NOT EXISTS workspace_preferences (id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL)")

    @app.get("/api/workspace/summary")
    def summary():
        with repository.connect() as db:
            db.execute("BEGIN")
            documents = [json.loads(row[0]) for row in db.execute("SELECT body FROM documents ORDER BY rowid DESC LIMIT 100")]
            counts = {name: db.execute(f"SELECT count(*) FROM {table}").fetchone()[0] for name, table in (("sources", "documents"), ("chunks", "chunks"), ("concepts", "graph_entities"), ("relations", "graph_relations"), ("retained_queries", "retrieval_results"))}
            counts["review_candidates"] = db.execute("SELECT count(*) FROM graph_candidates WHERE json_extract(body,'$.accepted')=0").fetchone()[0]
            counts["pending_jobs"] = db.execute("SELECT count(*) FROM jobs WHERE status NOT IN ('completed','failed')").fetchone()[0]
            counts["failed_jobs"] = db.execute("SELECT count(*) FROM jobs WHERE status='failed'").fetchone()[0]
            recent = [json.loads(row[0]) for row in db.execute("SELECT body FROM retrieval_results ORDER BY rowid DESC LIMIT 6")]
            version = app.state.graph_repository.version(db)
        return {"profile": descriptor(workspace), "counts": counts, "documents": documents, "recent_queries": recent, "graph_version": version, "documents_limit": 100, "ranking": "promoted" if app.state.retrieval_service.ranker else "baseline", "ranker_warning": app.state.retrieval_service.ranker_warning}

    @app.get("/api/workspace/settings")
    def get_preferences():
        with repository.connect() as db: row = db.execute("SELECT body FROM workspace_preferences WHERE id=1").fetchone()
        return Preferences(**json.loads(row[0])).model_dump() if row else descriptor(workspace)["default_preferences"]

    @app.put("/api/workspace/settings")
    def set_preferences(payload: Preferences):
        with repository.connect() as db: db.execute("INSERT OR REPLACE INTO workspace_preferences VALUES (1,?)", (payload.model_dump_json(),))
        return payload

    @app.post("/api/workspace/examples", status_code=202)
    def examples():
        # Explicit, idempotent ingestion. No automatic seed or replacement of user sources.
        jobs = [app.state.ingestion_service.submit(PasteIngestionRequest(source_type="paste", name=name, domain=f"theoretical-{workspace}-v1", text=text)) for name, text in PROFILES[workspace]["examples"]]
        return {"kind": "theoretical", "jobs": jobs, "extraction_version": ontology_for(workspace).version}

def create_platform_app(database_path=None, auth=None, enable_optimizers=True):
    auth = auth or AuthSettings.from_environment(); auth.validate()
    course_path = Path(database_path or settings.ingestion_database).resolve()
    paths = {workspace: (course_path if workspace == "course" else course_path.with_name(f"{workspace}.sqlite3").resolve()) for workspace in PROFILES}
    if len(set(paths.values())) != len(paths):
        raise ValueError("Workspace database paths must be distinct; domain workspace filenames are reserved")
    children = {workspace: create_app(database_path=str(paths[workspace]), ranker_path=getenv("SOFTGRAPH_RANKER_ARTIFACT") if workspace == "course" else None, ontology=ontology_for(workspace), enable_optimizers=enable_optimizers and workspace == "course", retrieval_policy={**POLICIES[workspace], "version": f"{workspace}-policy-1"}) for workspace in PROFILES}
    for workspace, child in children.items(): install_workspace_api(child, workspace)
    install_hospital_api(children["healthcare"])
    install_assessment_api(children["healthcare"])
    @asynccontextmanager
    async def lifespan(_app):
        async with AsyncExitStack() as stack:
            for child in children.values(): await stack.enter_async_context(child.router.lifespan_context(child))
            yield
    app = FastAPI(title="SoftGraph Workspaces", lifespan=lifespan)
    app.state.workspaces = children
    app.add_middleware(RequestGuard, auth=auth, origins=settings.cors_origins)
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_credentials=True, allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["content-type", "authorization"])

    @app.get("/api/auth/session")
    def session(request: Request):
        return {"authenticated": bool(request.state.actor), "local_mode": not bool(auth.users), "actor": request.state.actor}

    @app.post("/api/auth/session")
    def login(payload: Login, request: Request, response: Response):
        if request.headers.get("origin") not in settings.cors_origins:
            return JSONResponse(status_code=403, content={"code": "origin_forbidden", "message": "Sign in from an allowed application origin.", "details": {}, "request_id": request.state.request_id})
        actor = auth.authenticate_key(payload.access_key)
        if not actor: return JSONResponse(status_code=401, content={"code": "invalid_credentials", "message": "Invalid access key.", "details": {}, "request_id": request.state.request_id})
        response.set_cookie(COOKIE, auth.issue(actor["user"]), max_age=auth.session_seconds, httponly=True, secure=auth.production, samesite="lax")
        return {"authenticated": True, "local_mode": False, "actor": actor}

    @app.delete("/api/auth/session")
    def logout(response: Response):
        response.delete_cookie(COOKIE, httponly=True, secure=auth.production, samesite="lax")
        return {"authenticated": False, "local_mode": not bool(auth.users), "actor": None}

    @app.get("/api/workspaces")
    def workspaces(request: Request):
        allowed = request.state.actor["workspaces"] if request.state.actor else PROFILES
        return [descriptor(workspace) for workspace in PROFILES if workspace in allowed]

    @app.get("/ready")
    def ready():
        try:
            for child in children.values():
                with child.state.ingestion_repository.connect() as db: db.execute("SELECT 1 FROM graph_meta").fetchone()
        except Exception:
            return JSONResponse(status_code=503, content={"status": "not_ready"})
        return {"status": "ready", "workspaces": len(children), "authentication": "enabled" if auth.users else "local_only", "deployment": "single_instance"}

    for workspace, child in children.items(): app.mount(f"/workspaces/{workspace}", child)
    app.mount("/", children["course"])
    return app
