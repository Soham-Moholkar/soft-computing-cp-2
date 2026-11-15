import time
import pytest
from fastapi.testclient import TestClient
from app.platform import create_platform_app
from app.operations.auth import AuthSettings, COOKIE
from app.operations.backup import backup, restore

KEY = "editor-key-" + "a" * 40
READ_KEY = "reader-key-" + "b" * 40
def configuration():
    return AuthSettings({"owner": {"key": KEY, "role": "editor", "workspaces": ["personal", "engineering", "course"]}, "viewer": {"key": READ_KEY, "role": "reader", "workspaces": ["personal"]}}, secret="s" * 40)

def seeded(client, workspace):
    prefix = f"/workspaces/{workspace}/api"
    accepted = client.post(prefix + "/workspace/examples").json()
    for job in accepted["jobs"]:
        for _ in range(200):
            result = client.get(prefix + "/ingestion/jobs/" + job["job_id"]).json()
            if result["status"] in {"completed", "failed"}: break
            time.sleep(.01)
        assert result["status"] == "completed"
    response = client.post(prefix + "/graph/build", json={"document_ids": [job["document_id"] for job in accepted["jobs"]], "extraction_configuration_version": accepted["extraction_version"]})
    assert response.status_code == 200, response.text
    return accepted

def test_workspaces_are_isolated_and_settings_survive_restart(tmp_path):
    path = tmp_path / "course.sqlite3"
    with TestClient(create_platform_app(str(path), AuthSettings({}), enable_optimizers=False)) as client:
        accepted = seeded(client, "personal")
        again = client.post("/workspaces/personal/api/workspace/examples").json()
        assert again["jobs"][0]["document_id"] == accepted["jobs"][0]["document_id"]
        summary = client.get("/workspaces/personal/api/workspace/summary").json()
        assert summary["counts"]["sources"] == 4 and summary["counts"]["relations"] >= 5 and summary["counts"]["review_candidates"] >= 1
        assert client.get("/api/workspace/summary").json()["counts"]["sources"] == 0
        query = client.post("/workspaces/personal/api/retrieve", json={"query": "How do Research Notes support Project Atlas?"}).json()
        assert query["answer_status"] == "evidence" and query["evidence"]
        assert client.get("/workspaces/engineering/api/ingestion/documents/" + accepted["jobs"][0]["document_id"]).status_code == 404
        assert client.put("/workspaces/personal/api/workspace/settings", json={"mode": "lexical", "top_k": 3, "max_hops": 2, "view": "list"}).status_code == 200
        assert client.get("/ready").json()["status"] == "ready"
    backup(tmp_path / "personal.sqlite3", tmp_path / "backup.sqlite3")
    restore(tmp_path / "backup.sqlite3", tmp_path / "restored.sqlite3")
    with pytest.raises(FileExistsError): restore(tmp_path / "backup.sqlite3", tmp_path / "restored.sqlite3")
    with TestClient(create_platform_app(str(path), AuthSettings({}), enable_optimizers=False)) as client:
        assert client.get("/workspaces/personal/api/workspace/settings").json()["top_k"] == 3
        assert client.get("/workspaces/personal/api/workspace/summary").json()["counts"]["retained_queries"] == 1
    from app.factory import create_app
    with TestClient(create_app(database_path=str(tmp_path / "restored.sqlite3"), enable_optimizers=False)) as client:
        assert client.get("/api/retrieval/results/" + query["result_id"]).status_code == 200

def test_auth_roles_memberships_sessions_and_limits(tmp_path):
    auth = configuration()
    with TestClient(create_platform_app(str(tmp_path / "data.sqlite3"), auth, enable_optimizers=False)) as client:
        assert client.get("/api/workspaces").status_code == 401
        assert client.get("/ready").status_code == 200
        client.headers["authorization"] = "Bearer " + READ_KEY
        assert len(client.get("/api/workspaces").json()) == 1
        assert client.get("/workspaces/engineering/api/workspace/summary").status_code == 403
        assert client.post("/workspaces/personal/api/workspace/examples").status_code == 403
        assert client.post("/workspaces/personal/api/retrieve", json={"query": "Knowledge Vault"}).status_code == 200
        del client.headers["authorization"]
        response = client.post("/api/auth/session", json={"access_key": KEY}, headers={"origin": "http://localhost:3000"})
        assert response.status_code == 200 and "HttpOnly" in response.headers["set-cookie"]
        assert client.get("/api/auth/session").json()["actor"]["user"] == "owner"
        assert client.put("/api/workspace/settings", json={"top_k": 2}).status_code == 403
        assert client.put("/api/workspace/settings", json={"top_k": 2}, headers={"origin": "http://localhost:3000"}).status_code == 200
        response = client.post("/api/workspace/examples", content=b"x", headers={"origin": "http://localhost:3000", "content-length": "999999999"})
        assert response.status_code == 413
        token = auth.issue("owner")
        assert auth.session(token) and auth.session(token + "x") is None
        client.delete("/api/auth/session")
        assert client.get("/api/workspaces").status_code == 401
        for _ in range(4): client.post("/api/auth/session", json={"access_key": "wrong"}, headers={"origin": "http://localhost:3000"})
        limited = client.post("/api/auth/session", json={"access_key": KEY}, headers={"origin": "http://localhost:3000"})
        assert limited.status_code == 429
        assert limited.headers["retry-after"] == "60"
        assert limited.headers["cache-control"] == "no-store"
        assert limited.json()["code"] == "rate_limited"

def test_production_requires_config_and_backup_tampering_rejected(tmp_path):
    with pytest.raises(ValueError): create_platform_app(str(tmp_path / "data.sqlite3"), AuthSettings({}, production=True))
    import sqlite3
    source = tmp_path / "source.sqlite3"
    with sqlite3.connect(source) as db: db.execute("CREATE TABLE example(value TEXT)")
    backup(source, tmp_path / "copy.sqlite3")
    with (tmp_path / "copy.sqlite3").open("ab") as stream: stream.write(b"changed")
    with pytest.raises(ValueError): restore(tmp_path / "copy.sqlite3", tmp_path / "new.sqlite3")

def test_colliding_workspace_paths_are_rejected_before_opening_databases(tmp_path):
    with pytest.raises(ValueError, match="distinct"):
        create_platform_app(str(tmp_path / "personal.sqlite3"), AuthSettings({}), enable_optimizers=False)
    assert not (tmp_path / "personal.sqlite3").exists()

@pytest.mark.parametrize("workspace", ["healthcare", "agriculture", "engineering", "finance"])
def test_domain_evidence_profiles_and_isolation(tmp_path, workspace):
    from app.workspaces import PROFILES, ontology_for
    from app.domain_profiles import POLICIES
    path = tmp_path / "course.sqlite3"
    with TestClient(create_platform_app(str(path), AuthSettings({}), enable_optimizers=False)) as client:
        profiles = client.get("/api/workspaces").json()
        assert {profile["workspace_id"] for profile in profiles} == set(PROFILES)
        prefix = f"/workspaces/{workspace}/api"
        defaults = client.get(prefix + "/workspace/settings").json()
        assert defaults["ranking_profile"] == "domain"
        assert defaults["max_hops"] == POLICIES[workspace]["max_hops"]
        accepted = seeded(client, workspace)
        for question in PROFILES[workspace]["questions"]:
            response = client.post(prefix + "/retrieve", json={"query": question, **{key: defaults[key] for key in ("mode", "max_hops", "top_k", "ranking_profile")}})
            assert response.status_code == 200, response.text
            result = response.json()
            assert result["answer_status"] == "evidence", result["warnings"]
            assert result["configuration_version"] == f"{workspace}-policy-1"
            assert [row["weight"] for row in result["score_breakdown"]] == list(POLICIES[workspace]["weights"])
        summary = client.get(prefix + "/workspace/summary").json()
        assert summary["counts"]["review_candidates"] >= 1
        query = PROFILES[workspace]["questions"][0]
        result = client.post(prefix + "/retrieve", json={"query": query, "ranking_profile": "balanced"}).json()
        assert [row["weight"] for row in result["score_breakdown"]] == [.6, .25, .15]
        assert result["configuration_version"] == "retrieval-bm25-1"
        assert client.put(prefix + "/workspace/settings", json={**defaults, "ranking_profile": "balanced"}).status_code == 200
        for other in set(PROFILES) - {workspace}:
            other_prefix = f"/workspaces/{other}/api"
            assert client.get(other_prefix + "/workspace/summary").json()["counts"]["sources"] == 0
            assert client.get(other_prefix + "/ingestion/documents/" + accepted["jobs"][0]["document_id"]).status_code == 404
            assert client.get(other_prefix + "/retrieval/results/" + result["result_id"]).status_code == 404
        if workspace != "engineering":
            assert "Particle Swarm Optimization" not in {concept.name for concept in ontology_for(workspace).catalog}
    with TestClient(create_platform_app(str(path), AuthSettings({}), enable_optimizers=False)) as client:
        assert client.get(prefix + "/workspace/settings").json()["ranking_profile"] == "balanced"

def test_domain_memberships_are_enforced(tmp_path):
    auth = AuthSettings({"clinician": {"key": KEY, "role": "reader", "workspaces": ["healthcare"]}}, secret="s" * 40)
    with TestClient(create_platform_app(str(tmp_path / "course.sqlite3"), auth, enable_optimizers=False)) as client:
        client.headers["authorization"] = "Bearer " + KEY
        assert [profile["workspace_id"] for profile in client.get("/api/workspaces").json()] == ["healthcare"]
        assert client.get("/workspaces/healthcare/api/workspace/summary").status_code == 200
        assert client.get("/workspaces/finance/api/workspace/summary").status_code == 403
        assert client.get("/api/workspace/summary").status_code == 403
        assert client.put("/workspaces/healthcare/api/workspace/settings", json={"ranking_profile": "balanced"}).status_code == 403
