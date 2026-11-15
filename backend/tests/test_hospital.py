import csv
import io
import json
import sqlite3
import time

import openpyxl
import pytest
from fastapi.testclient import TestClient

from app.hospital.routes import install_hospital_api
from app.factory import create_app
from app.platform import create_platform_app
from app.operations.auth import AuthSettings


def record(pid="P001", eid="E001", **updates):
    return {"patient_id": pid, "encounter_id": eid, "recorded_at": "2026-11-14T10:00:00+05:30", "patient_label": "Same label", "observations": [{"name": "measurement alpha", "value": 7.2, "unit": "source-unit"}], "conditions": [{"name": "Recorded condition", "status": "suspected", "detail": "Source assessment only"}], "care_plan": "Documented follow-up plan", "prognosis_note": "Source-recorded prognosis narrative", "notes": "Private alpha narrative", "external_reference": "original field preserved", **updates}


@pytest.fixture
def client(tmp_path):
    app = create_app(database_path=str(tmp_path / "records.sqlite3"), enable_optimizers=False)
    install_hospital_api(app)
    with TestClient(app) as client:
        yield client


def upload(client, rows, filename="records.json"):
    return client.post("/api/hospital/import", files={"file": (filename, json.dumps(rows).encode())})


def test_patient_identity_statuses_provenance_and_scoped_query_survive_restart(tmp_path):
    path = str(tmp_path / "records.sqlite3")
    app = create_app(database_path=path, enable_optimizers=False)
    install_hospital_api(app)
    rows = [record(conditions=[{"name": f"Condition {status}", "status": status} for status in ("confirmed", "suspected", "negated", "historical")]), record("P002", "E002", notes="SECRET OTHER PATIENT BRAVO", observations=[])]
    with TestClient(app) as client:
        result = upload(client, rows).json()
        assert result["imported"] == 2
        assert upload(client, rows).json()["duplicate"] is True
        patients = client.get("/api/hospital/patients").json()
        assert patients["total"] == 2
        detail = client.get("/api/hospital/patients/P001").json()
        encounter = detail["encounters"][0]
        assert {condition["status"] for condition in encounter["conditions"]} == {"confirmed", "suspected", "negated", "historical"}
        assert encounter["observations"][0]["unit"] == "source-unit"
        assert encounter["source"]["location"] == {"json_path": "$[0]"}
        assert encounter["raw_record"]["external_reference"] == "original field preserved"
        assert any(node["kind"] == "condition" for node in detail["graph"]["nodes"])
        query = client.post("/api/hospital/query", json={"patient_id": "P001", "question": "BRAVO"}).json()
        assert query["status"] == "not_recorded" and query["evidence"] == []
        evidence = client.post("/api/hospital/query", json={"patient_id": "P001", "question": "follow-up plan"}).json()["evidence"][0]
        assert evidence["text"] == rows[0]["care_plan"]
        assert evidence["source"]["filename"] == "records.json" and evidence["field"] == "care_plan"
        assert "SECRET" not in json.dumps(detail)
        assert client.get("/api/hospital/patients?search=Same").json()["total"] == 2
    restarted = create_app(database_path=path, enable_optimizers=False)
    install_hospital_api(restarted)
    with TestClient(restarted) as client:
        assert client.get("/api/hospital/patients/P001").json() == detail


@pytest.mark.parametrize("bad", [
    {"patient_id": "", "encounter_id": "E"},
    record(recorded_at="tomorrow"),
    record(conditions=[{"name": "Condition", "status": "likely"}]),
    record(conditions=[{"name": "Condition"}]),
])
def test_malformed_import_is_atomic_and_never_echoes_record_values(client, bad):
    result = upload(client, [record(), {**bad, "notes": "PRIVATE SOURCE VALUE"}])
    assert result.status_code == 400
    assert "PRIVATE SOURCE VALUE" not in result.text
    assert client.get("/api/hospital/patients").json()["total"] == 0


def test_duplicate_encounter_conflict_rolls_back_other_rows(client):
    assert upload(client, [record()]).status_code == 200
    result = upload(client, [record("P003", "E003"), record(notes="modified original")])
    assert result.status_code == 409
    assert client.get("/api/hospital/patients").json()["total"] == 1
    assert client.get("/api/hospital/patients/P001").json()["encounters"][0]["notes"] == "Private alpha narrative"
    assert upload(client, [record(), record()]).status_code == 400


@pytest.mark.parametrize("format", ["csv", "json", "xlsx", "sqlite"])
def test_downloadable_templates_roundtrip_all_supported_formats(client, format):
    template = client.get(f"/api/hospital/template?format={format}")
    assert template.status_code == 200
    assert f".{format}" in template.headers["content-disposition"]
    if format in {"xlsx", "sqlite"}:
        inspect = client.post("/api/hospital/inspect", files={"file": (f"template.{format}", template.content)})
        assert inspect.json()["tables"] == ["encounters"]
    result = client.post("/api/hospital/import", files={"file": (f"template.{format}", template.content)})
    assert result.status_code == 200, result.text
    detail = client.get("/api/hospital/patients/SYNTHETIC-P001").json()
    location = detail["encounters"][0]["source"]["location"]
    if format == "json":
        assert location == {"json_path": "$[0]"}
    else:
        assert location["row"] == 2
    if format == "xlsx":
        assert location["sheet"] == "encounters"
    if format == "sqlite":
        assert location["table"] == "encounters" and location["row_kind"] == "import_scan_ordinal"


def test_csv_row_citation_and_nested_arrays(client):
    output = io.StringIO(newline="")
    row = record()
    writer = csv.DictWriter(output, fieldnames=list(row))
    writer.writeheader()
    writer.writerow({**row, "observations": json.dumps(row["observations"]), "conditions": json.dumps(row["conditions"])})
    response = client.post("/api/hospital/import", files={"file": ("source.csv", output.getvalue().encode())})
    assert response.status_code == 200, response.text
    encounter = client.get("/api/hospital/patients/P001").json()["encounters"][0]
    assert encounter["source"]["location"]["row"] == 2
    assert encounter["observations"][0]["value"] == 7.2


def test_sqlite_requires_table_selection_and_refuses_views_and_triggers(client, tmp_path):
    path = tmp_path / "source.db"
    with sqlite3.connect(path) as db:
        db.execute("CREATE TABLE first (patient_id TEXT, encounter_id TEXT, recorded_at TEXT)")
        db.execute("INSERT INTO first VALUES ('P1','E1','2026-11-14')")
        db.execute("CREATE TABLE second (patient_id TEXT, encounter_id TEXT, recorded_at TEXT)")
    content = path.read_bytes()
    assert client.post("/api/hospital/import", files={"file": ("source.sqlite", content)}).status_code == 400
    chosen = client.post("/api/hospital/import", data={"table": "first"}, files={"file": ("source.sqlite", content)})
    assert chosen.status_code == 200, chosen.text
    with sqlite3.connect(path) as db:
        db.execute("CREATE VIEW hidden AS SELECT * FROM first")
    bad = client.post("/api/hospital/import", data={"table": "first"}, files={"file": ("source.sqlite", path.read_bytes())})
    assert bad.status_code == 400
    with sqlite3.connect(path) as db:
        db.execute("DROP VIEW hidden")
        db.execute("CREATE TRIGGER hidden AFTER INSERT ON first BEGIN SELECT 1; END")
    assert client.post("/api/hospital/import", data={"table": "first"}, files={"file": ("source.sqlite", path.read_bytes())}).status_code == 400


def test_xlsx_refuses_formulas_and_oversized_sheet(client):
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(["patient_id", "encounter_id", "recorded_at"])
    sheet.append(["=1+1", "E1", "2026-11-14"])
    output = io.BytesIO()
    workbook.save(output)
    result = client.post("/api/hospital/import", files={"file": ("formula.xlsx", output.getvalue())})
    assert result.status_code == 400
    assert client.get("/api/hospital/patients").json()["total"] == 0
    workbook.close()


def test_json_duplicate_keys_size_limit_and_patient_detail_pagination(client):
    duplicate = b'[{"patient_id":"P1","patient_id":"P2","encounter_id":"E1","recorded_at":"2026-11-14"}]'
    assert client.post("/api/hospital/import", files={"file": ("source.json", duplicate)}).status_code == 400
    assert client.post("/api/hospital/import", files={"file": ("source.json", b"x" * (2 * 1024 * 1024 + 1))}).status_code == 413
    assert upload(client, [record(eid=f"E{i:03d}") for i in range(60)]).status_code == 200
    first = client.get("/api/hospital/patients/P001").json()
    assert first["total_encounters"] == 60 and len(first["encounters"]) == 50
    assert len(client.get("/api/hospital/patients/P001?offset=50").json()["encounters"]) == 10


def test_hospital_api_is_healthcare_only_with_reader_query_permissions(tmp_path):
    editor = "editor-" + "a" * 40
    reader = "reader-" + "b" * 40
    auth = AuthSettings({"editor": {"key": editor, "role": "editor", "workspaces": ["healthcare"]}, "reader": {"key": reader, "role": "reader", "workspaces": ["healthcare"]}}, secret="s" * 40)
    with TestClient(create_platform_app(str(tmp_path / "course.sqlite3"), auth, enable_optimizers=False)) as client:
        client.headers["authorization"] = "Bearer " + editor
        prefix = "/workspaces/healthcare/api/hospital"
        assert client.post(prefix + "/import", files={"file": ("source.json", json.dumps([record()]).encode())}).status_code == 200
        client.headers["authorization"] = "Bearer " + reader
        assert client.post(prefix + "/query", json={"patient_id": "P001", "question": "alpha"}).status_code == 200
        assert client.post(prefix + "/import", files={"file": ("source.json", b"[]")}).status_code == 403
        client.headers["authorization"] = "Bearer " + editor
        assert client.get("/workspaces/personal/api/hospital/patients").status_code == 403
    with TestClient(create_platform_app(str(tmp_path / "other.sqlite3"), AuthSettings({}), enable_optimizers=False)) as client:
        assert client.get("/api/hospital/patients").status_code == 404
        assert client.get("/workspaces/personal/api/hospital/patients").status_code == 404


def wait_document(client, patient_id, job_id):
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        rows = client.get(f"/api/hospital/patients/{patient_id}/documents").json()["documents"]
        document = next(row for row in rows if row["job_id"] == job_id)
        if document["status"] in {"completed", "failed"}:
            return document
        time.sleep(.01)
    pytest.fail("Attached document did not finish")


def test_patient_documents_are_explicit_scoped_idempotent_and_persist(tmp_path):
    path = str(tmp_path / "documents.sqlite3")
    app = create_app(database_path=path, enable_optimizers=False)
    install_hospital_api(app)
    with TestClient(app) as client:
        assert upload(client, [record(), record("P002", "E002", notes="other patient")]).status_code == 200
        assert client.post("/api/hospital/patients/MISSING/documents", files={"file": ("note.txt", b"private zirconium")}).status_code == 404
        response = client.post("/api/hospital/patients/P001/documents", files={"file": ("clinical-note.md", b"# Documented source\nThe source records zirconium. No diagnosis inferred.")})
        assert response.status_code == 202, response.text
        accepted = response.json()
        assert wait_document(client, "P001", accepted["job_id"])["status"] == "completed"
        duplicate = client.post("/api/hospital/patients/P001/documents", files={"file": ("clinical-note.md", b"# Documented source\nThe source records zirconium. No diagnosis inferred.")}).json()
        assert duplicate["document_id"] == accepted["document_id"]
        result = client.post("/api/hospital/query", json={"patient_id": "P001", "question": "zirconium"}).json()
        assert result["status"] == "evidence"
        citation = next(item for item in result["evidence"] if item["kind"] == "document_chunk")
        assert citation["source"]["filename"] == "clinical-note.md"
        assert citation["source"]["location"]["section"] == 1
        assert "zirconium" in citation["text"]
        assert client.post("/api/hospital/query", json={"patient_id": "P002", "question": "zirconium"}).json()["status"] == "not_recorded"
        detail = client.get("/api/hospital/patients/P001").json()
        assert detail["attachment_count"] == 1
        assert any(node["kind"] == "document_chunk" for node in detail["graph"]["nodes"])
        assert client.get("/api/hospital/patients/P002").json()["attachment_count"] == 0
        failed = client.post("/api/hospital/patients/P001/documents", files={"file": ("broken.pdf", b"not a pdf")}).json()
        assert wait_document(client, "P001", failed["job_id"])["status"] == "failed"
        assert client.post(f"/api/ingestion/jobs/{failed['job_id']}/retry").status_code == 202
        assert wait_document(client, "P001", failed["job_id"])["status"] == "failed"
        assert client.get(f"/api/ingestion/jobs/{failed['job_id']}").json()["attempt"] == 2
        assert len(client.get("/api/hospital/patients/P001/documents").json()["documents"]) == 2
    restarted = create_app(database_path=path, enable_optimizers=False)
    install_hospital_api(restarted)
    with TestClient(restarted) as client:
        assert len(client.get("/api/hospital/patients/P001/documents").json()["documents"]) == 2
        assert client.post("/api/hospital/query", json={"patient_id": "P001", "question": "zirconium"}).json()["status"] == "evidence"


def test_pdf_attachment_preserves_actual_page_and_original_bytes(client):
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 50 700 Td (Synthetic documented azurite source.) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(stream)
    output = io.BytesIO()
    writer.write(output)
    content = output.getvalue()
    assert upload(client, [record()]).status_code == 200
    accepted = client.post("/api/hospital/patients/P001/documents", files={"file": ("synthetic.pdf", content)}).json()
    assert wait_document(client, "P001", accepted["job_id"])["status"] == "completed"
    evidence = client.post("/api/hospital/query", json={"patient_id": "P001", "question": "azurite"}).json()["evidence"][0]
    assert evidence["source"]["location"]["page"] == 1
    assert evidence["source"]["location"]["chunk_sequence"] == 0
    repository = client.app.state.ingestion_repository
    assert repository.source(accepted["job_id"])[1] == content


def test_docx_attachment_preserves_paragraph_citation(client):
    from test_docx_ingestion import package
    assert upload(client, [record()]).status_code == 200
    content = package('<w:p><w:r><w:t>Synthetic carnelian record only.</w:t></w:r></w:p>')
    accepted = client.post("/api/hospital/patients/P001/documents", files={"file": ("clinical.docx", content)}).json()
    assert wait_document(client, "P001", accepted["job_id"])["status"] == "completed"
    evidence = client.post("/api/hospital/query", json={"patient_id": "P001", "question": "carnelian"}).json()["evidence"][0]
    assert evidence["source"]["filename"] == "clinical.docx"
    assert evidence["source"]["location"]["paragraph"] == 1


def test_sqlite_virtual_tables_and_disguised_view_names_are_refused(client, tmp_path):
    path = tmp_path / "virtual.sqlite"
    with sqlite3.connect(path) as db:
        db.execute("CREATE TABLE records (patient_id TEXT, encounter_id TEXT, recorded_at TEXT)")
        db.execute("CREATE VIEW sqliteXhidden AS SELECT * FROM records")
    assert client.post("/api/hospital/inspect", files={"file": ("source.sqlite", path.read_bytes())}).status_code == 400
    with sqlite3.connect(path) as db:
        db.execute("DROP VIEW sqliteXhidden")
        db.execute("CREATE VIRTUAL TABLE fulltext USING fts5(content)")
    assert client.post("/api/hospital/inspect", files={"file": ("source.sqlite", path.read_bytes())}).status_code == 400


def test_hospital_query_preserves_excerpt_offsets_near_actual_match(client):
    text = "earlier " * 700 + "lapis actual source match" + " later" * 700
    assert upload(client, [record(notes=text)]).status_code == 200
    evidence = client.post("/api/hospital/query", json={"patient_id": "P001", "question": "lapis"}).json()["evidence"][0]
    assert "lapis" in evidence["text"] and evidence["truncated"] is True
    assert evidence["text"] == text[evidence["excerpt_start"]:evidence["excerpt_end"]]


def test_csv_blank_lines_and_multiline_cells_preserve_physical_source_rows(client):
    content = b'patient_id,encounter_id,recorded_at,notes\n\nP001,E001,2026-11-14,"source line one\nsource line two"\n'
    assert client.post("/api/hospital/import", files={"file": ("source.csv", content)}).status_code == 200
    source = client.get("/api/hospital/patients/P001").json()["encounters"][0]["source"]
    assert source["location"] == {"row": 3, "line_end": 4}
