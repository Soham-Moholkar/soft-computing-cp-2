"""Transactional local records and patient-scoped exact evidence retrieval."""
import csv
from datetime import UTC
from hashlib import sha256
import io
import json
from pathlib import PurePosixPath
import re
import sqlite3
import zipfile
from threading import Lock

from pydantic import ValidationError

from app.core.errors import IngestionError, NotFoundError
from app.hospital.models import EncounterRecord, EvidenceQuery
from app.hospital.importers import spreadsheet_rows, sqlite_rows

MAX_IMPORT_BYTES = 2 * 1024 * 1024
MAX_IMPORT_RECORDS = 1000
MAX_ENCOUNTERS = 5000
MAX_PATIENT_ENCOUNTERS = 500
MODEL_STATUS = {"automatic_patient_prediction": "not_configured", "description": "Documented records only. Educational model assessments are separate and are not clinically validated patient predictions."}
FIELDS = ["patient_id", "encounter_id", "recorded_at", "patient_label", "observations", "conditions", "care_plan", "prognosis_note", "notes"]


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def strict_json(text):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("Duplicate JSON key")
            result[key] = value
        return result
    return json.loads(text, object_pairs_hook=pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))


def parse_import(content: bytes, filename: str, table: str | None = None):
    if not content or len(content) > MAX_IMPORT_BYTES:
        raise IngestionError("Import a nonempty CSV, JSON, XLSX or SQLite file of at most 2 MiB.", "hospital_size", 413)
    extension = PurePosixPath(filename.replace("\\", "/")).suffix.lower()
    try:
        if extension == ".xlsx":
            rows = spreadsheet_rows(content, table)
        elif extension in {".db", ".sqlite", ".sqlite3"}:
            rows = sqlite_rows(content, table)
        elif extension == ".json":
            text = content.decode("utf-8-sig")
            data = strict_json(text)
            if not isinstance(data, list):
                raise ValueError()
            rows = [(row, {"json_path": f"$[{index}]"}) for index, row in enumerate(data)]
        elif extension == ".csv":
            text = content.decode("utf-8-sig")
            reader = csv.reader(io.StringIO(text), strict=True)
            header = next(reader, None)
            if not header or len(header) > 100 or any(not name.strip() for name in header) or len(header) != len(set(header)) or not {"patient_id", "encounter_id", "recorded_at"}.issubset(header):
                raise ValueError()
            rows = []
            previous_end = reader.line_num
            for values in reader:
                start_line, end_line = previous_end + 1, reader.line_num
                previous_end = end_line
                if not values or not any(value.strip() for value in values):
                    continue
                if len(values) != len(header):
                    raise ValueError()
                rows.append((dict(zip(header, values)), {"row": start_line, "line_end": end_line}))
                if len(rows) > MAX_IMPORT_RECORDS:
                    raise ValueError()
        else:
            raise ValueError()
        if not 1 <= len(rows) <= MAX_IMPORT_RECORDS:
            raise ValueError()
        parsed = []
        seen = set()
        for original, location in rows:
            if not isinstance(original, dict) or len(original) > 100:
                raise ValueError()
            data = dict(original)
            if extension != ".json":
                for field in ("observations", "conditions"):
                    cell = data.get(field, "")
                    if not isinstance(cell, str):
                        raise ValueError()
                    data[field] = strict_json(cell) if cell.strip() else []
            pending_values = [(original, 0)]
            while pending_values:
                value, depth = pending_values.pop()
                if depth > 32:
                    raise ValueError()
                if isinstance(value, dict):
                    pending_values.extend((item, depth + 1) for item in value.values())
                elif isinstance(value, list):
                    pending_values.extend((item, depth + 1) for item in value)
            record = EncounterRecord.model_validate(data)
            if (record.patient_id, record.encounter_id) in seen:
                raise ValueError()
            seen.add((record.patient_id, record.encounter_id))
            body = record.model_dump(mode="json")
            if record.recorded_at.tzinfo:
                body["recorded_at"] = record.recorded_at.astimezone(UTC).isoformat()
            if len(canonical(body).encode()) + len(canonical(original).encode()) > 128 * 1024:
                raise ValueError()
            parsed.append((body, original, location))
        return parsed
    except (ValueError, TypeError, UnicodeError, csv.Error, RecursionError, ValidationError, sqlite3.Error, zipfile.BadZipFile, KeyError, OSError, SyntaxError) as error:
        raise IngestionError("Import rejected. Use the template: unique patient_id + encounter_id, an ISO recorded_at date, JSON arrays for observations/conditions, and an explicit condition status. No records were saved.", "hospital_format") from error


class HospitalService:
    def __init__(self, repository, ingestion_service=None):
        self.repository = repository
        self.ingestion_service = ingestion_service
        self.attachment_lock = Lock()
        with repository.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS hospital_imports (id TEXT PRIMARY KEY, filename TEXT NOT NULL, record_count INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS hospital_patients (id TEXT PRIMARY KEY, label TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS hospital_encounters (
                    patient_id TEXT NOT NULL REFERENCES hospital_patients(id), id TEXT NOT NULL,
                    recorded_at TEXT NOT NULL, body TEXT NOT NULL, raw_record TEXT NOT NULL,
                    digest TEXT NOT NULL, import_id TEXT NOT NULL REFERENCES hospital_imports(id), location TEXT NOT NULL,
                    PRIMARY KEY(patient_id,id));
                CREATE INDEX IF NOT EXISTS hospital_patient_dates ON hospital_encounters(patient_id,recorded_at);
                CREATE TABLE IF NOT EXISTS hospital_documents (
                    patient_id TEXT NOT NULL REFERENCES hospital_patients(id),
                    document_id TEXT NOT NULL REFERENCES documents(id), job_id TEXT NOT NULL REFERENCES jobs(id),
                    PRIMARY KEY(patient_id,document_id));
            """)

    def attach_document(self, patient_id, content, filename):
        from app.models.ingestion import ReferenceIngestionRequest
        extension = PurePosixPath(filename.replace("\\", "/")).suffix.lower()
        kind = {".pdf": "pdf", ".txt": "txt", ".md": "txt", ".docx": "docx"}.get(extension)
        if kind is None:
            raise IngestionError("Attach a PDF, TXT, Markdown or DOCX document.", "hospital_document")
        name = PurePosixPath(filename.replace("\\", "/")).name[:255]
        request = ReferenceIngestionRequest(source_type=kind, name=name, domain="hospital-patient-" + sha256(patient_id.encode()).hexdigest(), chunk_size=300, chunk_overlap=30)
        with self.attachment_lock:
            with self.repository.connect() as db:
                if not db.execute("SELECT 1 FROM hospital_patients WHERE id=?", (patient_id,)).fetchone():
                    raise NotFoundError("hospital patient", patient_id)
                duplicate = db.execute("SELECT 1 FROM hospital_documents h JOIN jobs j ON h.job_id=j.id WHERE h.patient_id=? AND j.request=? AND j.source=?", (patient_id, json.dumps(request.model_dump(mode="json")), content)).fetchone()
                if not duplicate and db.execute("SELECT count(*) FROM hospital_documents WHERE patient_id=?", (patient_id,)).fetchone()[0] >= 20:
                    raise IngestionError("A patient can have up to 20 attached documents.", "hospital_capacity", 413)
            # Explicit patient key is part of ingestion identity; never infer names.
            accepted = self.ingestion_service.submit(request, content)
            with self.repository.connect() as db:
                db.execute("INSERT OR IGNORE INTO hospital_documents VALUES (?,?,?)", (patient_id, accepted.document_id, accepted.job_id))
        return accepted.model_dump(mode="json")

    def documents(self, patient_id):
        with self.repository.connect() as db:
            if not db.execute("SELECT 1 FROM hospital_patients WHERE id=?", (patient_id,)).fetchone():
                raise NotFoundError("hospital patient", patient_id)
            rows = db.execute("SELECT d.body,j.body FROM hospital_documents h JOIN documents d ON h.document_id=d.id JOIN jobs j ON h.job_id=j.id WHERE h.patient_id=? ORDER BY d.id", (patient_id,)).fetchall()
        return [{"document_id": document["document_id"], "name": document["name"], "source_type": document["source_type"], "job_id": job["job_id"], "status": job["status"], "progress": job["progress"], "error": job["error"], "warnings": job["warnings"], "chunks": job["final_counts"].get("chunks", 0)} for document, job in ((json.loads(doc), json.loads(job)) for doc, job in rows)]

    def document_evidence(self, patient_id):
        # Only explicitly associated, completed sources enter this patient's search.
        with self.repository.connect() as db:
            rows = db.execute("""SELECT c.body,d.body FROM hospital_documents h
                JOIN documents d ON d.id=h.document_id JOIN chunks c ON c.document_id=d.id
                WHERE h.patient_id=? AND json_extract(d.body,'$.processing_status')='completed'
                ORDER BY d.id,c.sequence""", (patient_id,)).fetchall()
        evidence = []
        for chunk_json, document_json in rows:
            chunk, document = json.loads(chunk_json), json.loads(document_json)
            evidence.append({"evidence_id": chunk["chunk_id"], "encounter_id": "attached-document", "recorded_at": document["timestamp"], "field": "document_text", "text": chunk["text"], "kind": "document_chunk", "source": {"import_id": document["document_id"], "filename": document["name"], "location": {**chunk["source_location"], "chunk_sequence": chunk["sequence"], "start_offset": chunk["start_offset"], "end_offset": chunk["end_offset"]}}})
        return evidence

    def import_file(self, content: bytes, filename: str, table: str | None = None):
        records = parse_import(content, filename, table)
        filename = PurePosixPath(filename.replace("\\", "/")).name[:255] or "records"
        import_id = "hospital-import-" + sha256(content + b"\0" + (table or "").encode()).hexdigest()
        with self.repository.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            previous = db.execute("SELECT record_count FROM hospital_imports WHERE id=?", (import_id,)).fetchone()
            if previous:
                return {"import_id": import_id, "imported": 0, "unchanged": previous[0], "duplicate": True}
            if db.execute("SELECT count(*) FROM hospital_imports").fetchone()[0] >= 500:
                raise IngestionError("Hospital import history is full (500 files).", "hospital_capacity", 413)
            pending = []
            labels = {}
            for body, original, location in records:
                pid, eid, label = body["patient_id"], body["encounter_id"], body["patient_label"]
                digest = sha256(canonical(body).encode()).hexdigest()
                old = db.execute("SELECT digest FROM hospital_encounters WHERE patient_id=? AND id=?", (pid, eid)).fetchone()
                if old and old[0] != digest:
                    raise IngestionError("An encounter ID conflicts with a saved record. Resolve the source IDs before importing. No records were saved.", "hospital_conflict", 409)
                old_label = db.execute("SELECT label FROM hospital_patients WHERE id=?", (pid,)).fetchone()
                expected = labels.get(pid, old_label[0] if old_label else "")
                if expected and label and expected != label:
                    raise IngestionError("A patient ID has conflicting labels. Resolve the source IDs before importing. No records were saved.", "hospital_conflict", 409)
                labels[pid] = expected or label
                if not old:
                    pending.append((pid, eid, body["recorded_at"], canonical(body), canonical(original), digest, import_id, canonical(location)))
            if db.execute("SELECT count(*) FROM hospital_encounters").fetchone()[0] + len(pending) > MAX_ENCOUNTERS:
                raise IngestionError("Hospital record capacity is 5,000 encounters.", "hospital_capacity", 413)
            stored_bytes = db.execute("SELECT coalesce(sum(length(CAST(body AS BLOB))+length(CAST(raw_record AS BLOB))),0) FROM hospital_encounters").fetchone()[0]
            if stored_bytes + sum(len(item[3].encode()) + len(item[4].encode()) for item in pending) > 32 * 1024 * 1024:
                raise IngestionError("Hospital record storage capacity is 32 MiB.", "hospital_capacity", 413)
            for pid in labels:
                count = db.execute("SELECT count(*) FROM hospital_encounters WHERE patient_id=?", (pid,)).fetchone()[0]
                if count + sum(item[0] == pid for item in pending) > MAX_PATIENT_ENCOUNTERS:
                    raise IngestionError("A patient can have at most 500 encounters in this local workspace.", "hospital_capacity", 413)
            db.execute("INSERT INTO hospital_imports VALUES (?,?,?)", (import_id, filename, len(records)))
            for pid, label in labels.items():
                db.execute("INSERT INTO hospital_patients VALUES (?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label", (pid, label))
            db.executemany("INSERT INTO hospital_encounters VALUES (?,?,?,?,?,?,?,?)", pending)
        return {"import_id": import_id, "imported": len(pending), "unchanged": len(records) - len(pending), "duplicate": False}

    def patients(self, search="", offset=0, limit=50):
        with self.repository.connect() as db:
            # instr is literal substring matching, never SQL LIKE wildcards.
            where = "WHERE instr(lower(p.id),lower(?))>0 OR instr(lower(p.label),lower(?))>0"
            total = db.execute("SELECT count(*) FROM hospital_patients p " + where, (search, search)).fetchone()[0]
            rows = db.execute("SELECT p.id,p.label,count(e.id),max(e.recorded_at) FROM hospital_patients p JOIN hospital_encounters e ON p.id=e.patient_id " + where + " GROUP BY p.id ORDER BY p.id LIMIT ? OFFSET ?", (search, search, limit, offset)).fetchall()
        return {"patients": [{"patient_id": r[0], "patient_label": r[1], "encounters": r[2], "last_recorded_at": r[3]} for r in rows], "total": total, "offset": offset, "limit": limit, "model_status": MODEL_STATUS}

    def records(self, patient_id):
        with self.repository.connect() as db:
            db.execute("BEGIN")
            patient = db.execute("SELECT label FROM hospital_patients WHERE id=?", (patient_id,)).fetchone()
            if not patient:
                raise NotFoundError("hospital patient", patient_id)
            rows = db.execute("SELECT e.body,e.raw_record,e.import_id,e.location,i.filename FROM hospital_encounters e JOIN hospital_imports i ON i.id=e.import_id WHERE e.patient_id=? ORDER BY e.recorded_at DESC,e.id", (patient_id,)).fetchall()
        records = [{**json.loads(body), "raw_record": json.loads(raw), "source": {"import_id": iid, "filename": name, "location": json.loads(location)}} for body, raw, iid, location, name in rows]
        return {"patient_id": patient_id, "patient_label": patient[0], "encounters": records, "model_status": MODEL_STATUS}

    @staticmethod
    def evidence(record):
        fields = []
        for index, observation in enumerate(record["observations"]):
            fields.append((f"observations[{index}]", canonical(observation), "observation"))
        for index, condition in enumerate(record["conditions"]):
            fields.append((f"conditions[{index}]", canonical(condition), "condition"))
        for field in ("care_plan", "prognosis_note", "notes"):
            if record[field].strip():
                fields.append((field, record[field], field))
        for field, value in record["raw_record"].items():
            if field not in FIELDS:
                fields.append((field, canonical(value), "additional_field"))
        return [{"evidence_id": "evidence-" + sha256(f'{record["patient_id"]}\0{record["encounter_id"]}\0{field}'.encode()).hexdigest()[:24], "encounter_id": record["encounter_id"], "recorded_at": record["recorded_at"], "field": field, "text": text, "kind": kind, "source": record["source"]} for field, text, kind in fields]

    def detail(self, patient_id, offset=0, limit=50):
        detail = self.records(patient_id)
        evidence = [item for record in detail["encounters"] for item in self.evidence(record)]
        # Render a bounded graph; all encounter records remain in the timeline.
        nodes = [{"id": "patient", "label": patient_id, "kind": "patient"}]
        edges = []
        for record in detail["encounters"][:20]:
            encounter_node = "encounter:" + record["encounter_id"]
            nodes.append({"id": encounter_node, "label": record["encounter_id"], "kind": "encounter"})
            edges.append({"source": "patient", "target": encounter_node, "label": "has recorded encounter"})
            for item in self.evidence(record)[:15]:
                nodes.append({"id": item["evidence_id"], "label": item["text"][:140], "kind": item["kind"], "evidence_id": item["evidence_id"]})
                edges.append({"source": encounter_node, "target": item["evidence_id"], "label": "documents"})
        detail["graph"] = {"nodes": nodes, "edges": edges, "shown_encounters": min(20, len(detail["encounters"])), "encounter_limit": 20, "evidence_per_encounter_limit": 15, "description": "Structural links from recorded fields only; no inferred clinical relationships."}
        detail["evidence_count"] = len(evidence)
        attached = self.documents(patient_id)
        for document in attached:
            node_id = "document:" + document["document_id"]
            nodes.append({"id": node_id, "label": document["name"] + " · " + document["status"], "kind": "source_document"})
            edges.append({"source": "patient", "target": node_id, "label": "explicitly attached source"})
        seen_chunks = {}
        for item in self.document_evidence(patient_id):
            document_id = item["source"]["import_id"]
            if seen_chunks.get(document_id, 0) >= 2:
                continue
            seen_chunks[document_id] = seen_chunks.get(document_id, 0) + 1
            nodes.append({"id": item["evidence_id"], "label": item["text"][:140], "kind": "document_chunk", "evidence_id": item["evidence_id"]})
            edges.append({"source": "document:" + document_id, "target": item["evidence_id"], "label": "contains source chunk"})
        detail["attachment_count"] = len(attached)
        detail["total_encounters"] = len(detail["encounters"])
        detail["encounters"] = detail["encounters"][offset:offset + limit]
        detail["offset"], detail["limit"] = offset, limit
        return detail

    def query(self, request: EvidenceQuery):
        # Fetch and filter this patient's records BEFORE computing lexical scores.
        detail = self.records(request.patient_id)
        terms = set(re.findall(r"[^\W_]+", request.question.casefold())) - set("what is the a an are was were does do for of in to and has have patient recorded show me".split())
        if not terms or len(terms) > 50:
            raise IngestionError("Enter 1–50 meaningful search terms.", "hospital_query")
        candidates = []
        recorded_evidence = [item for record in detail["encounters"] for item in self.evidence(record)]
        for item in recorded_evidence + self.document_evidence(request.patient_id):
            matches = list(re.finditer(r"[^\W_]+", item["text"]))
            overlap = terms & {match.group().casefold() for match in matches}
            if overlap:
                first_match = next(match for match in matches if match.group().casefold() in overlap)
                start = max(0, first_match.start() - 300)
                end = min(len(item["text"]), start + 4000)
                candidates.append({**item, "text": item["text"][start:end], "excerpt_start": start, "excerpt_end": end, "truncated": start > 0 or end < len(item["text"]), "matched_terms": sorted(overlap), "score": len(overlap) / len(terms)})
        candidates.sort(key=lambda item: (-item["score"], item["evidence_id"]))
        return {"patient_id": request.patient_id, "status": "evidence" if candidates else "not_recorded", "message": "Matching recorded excerpts; lexical matches do not establish a diagnosis or prognosis." if candidates else "No matching evidence was found in this patient's imported records.", "evidence": candidates[:request.limit], "model_status": MODEL_STATUS}
