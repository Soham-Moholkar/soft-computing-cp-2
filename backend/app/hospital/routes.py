from fastapi import File, Form, Query, UploadFile
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

from app.core.errors import IngestionError
from app.hospital.models import EvidenceQuery
from app.hospital.service import HospitalService, MAX_IMPORT_BYTES


def install_hospital_api(app):
    service = HospitalService(app.state.ingestion_repository, app.state.ingestion_service)
    app.state.hospital_service = service

    @app.get("/api/hospital/patients")
    def patients(search: str = Query(default="", max_length=160), offset: int = Query(default=0, ge=0), limit: int = Query(default=50, ge=1, le=100)):
        return service.patients(search, offset, limit)

    @app.get("/api/hospital/patients/{patient_id}")
    def patient(patient_id: str, offset: int = Query(default=0, ge=0), limit: int = Query(default=50, ge=1, le=50)):
        return service.detail(patient_id, offset, limit)

    @app.get("/api/hospital/patients/{patient_id}/documents")
    def documents(patient_id: str):
        return {"documents": service.documents(patient_id)}

    @app.post("/api/hospital/patients/{patient_id}/documents", status_code=202)
    async def attach_document(patient_id: str, file: UploadFile = File(...)):
        from app.ingestion.parser import MAX_BYTES
        try:
            content = await file.read(MAX_BYTES + 1)
            filename = file.filename or ""
        finally:
            await file.close()
        return await run_in_threadpool(service.attach_document, patient_id, content, filename)

    @app.post("/api/hospital/import")
    async def import_records(file: UploadFile = File(...), table: str | None = Form(default=None, max_length=255)):
        try:
            content = await file.read(MAX_IMPORT_BYTES + 1)
            filename = file.filename or ""
        finally:
            await file.close()
        return await run_in_threadpool(service.import_file, content, filename, table)

    @app.post("/api/hospital/inspect")
    async def inspect_records(file: UploadFile = File(...)):
        from pathlib import PurePosixPath
        from app.hospital.importers import spreadsheet_rows, sqlite_rows
        try:
            content = await file.read(MAX_IMPORT_BYTES + 1)
            extension = PurePosixPath(file.filename or "").suffix.lower()
            if not content or len(content) > MAX_IMPORT_BYTES:
                raise ValueError()
            if extension == ".xlsx":
                tables = await run_in_threadpool(spreadsheet_rows, content, inspect=True)
            elif extension in {".db", ".sqlite", ".sqlite3"}:
                tables = await run_in_threadpool(sqlite_rows, content, inspect=True)
            else:
                raise ValueError()
            return {"tables": tables}
        except Exception as error:
            raise IngestionError("Cannot inspect this file. Use a plain XLSX workbook without formulas or a SQLite database containing ordinary tables only, at most 2 MiB.", "hospital_format") from error
        finally:
            await file.close()

    @app.post("/api/hospital/query")
    def query(request: EvidenceQuery):
        return service.query(request)

    @app.get("/api/hospital/template")
    def template(format: str = Query(default="json")):
        import csv
        import io
        import json
        from app.hospital.service import FIELDS
        if format not in {"json", "csv", "xlsx", "sqlite"}:
            raise IngestionError("Choose a JSON, CSV, XLSX or SQLite template.")
        # Deliberately no example diagnosis, treatment, or prediction.
        row = {"patient_id": "SYNTHETIC-P001", "encounter_id": "SYNTHETIC-E001", "recorded_at": "2026-11-14T09:00:00+05:30", "patient_label": "Synthetic patient", "observations": [{"name": "Recorded measurement", "value": "Replace with source value", "unit": "Source unit"}], "conditions": [], "care_plan": "", "prognosis_note": "", "notes": "Synthetic template only. Replace with source-recorded information."}
        values = {**row, "observations": json.dumps(row["observations"]), "conditions": "[]"}
        if format == "xlsx":
            import openpyxl
            workbook = openpyxl.Workbook()
            sheet = workbook.active
            sheet.title = "encounters"
            sheet.append(FIELDS)
            sheet.append([values[field] for field in FIELDS])
            buffer = io.BytesIO()
            workbook.save(buffer)
            workbook.close()
            content = buffer.getvalue()
        elif format == "sqlite":
            import sqlite3
            import tempfile
            from pathlib import Path
            with tempfile.TemporaryDirectory(prefix="hospital-template-") as directory:
                path = Path(directory) / "template.sqlite3"
                connection = sqlite3.connect(path)
                try:
                    connection.execute("CREATE TABLE encounters (" + ",".join(field + " TEXT" for field in FIELDS) + ")")
                    connection.execute("INSERT INTO encounters VALUES (" + ",".join("?" for _ in FIELDS) + ")", [values[field] for field in FIELDS])
                    connection.commit()
                finally:
                    connection.close()
                content = path.read_bytes()
        elif format == "json":
            content = json.dumps([row], indent=2)
        else:
            output = io.StringIO(newline="")
            writer = csv.DictWriter(output, fieldnames=FIELDS)
            writer.writeheader()
            writer.writerow(values)
            content = output.getvalue()
        return Response(content, media_type={"json": "application/json", "csv": "text/csv", "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "sqlite": "application/vnd.sqlite3"}[format], headers={"Content-Disposition": f'attachment; filename="hospital-records-template.{format}"'})
