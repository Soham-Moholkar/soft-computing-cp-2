"""Read data files only: no SQL scripts, formula execution, or schema guessing."""
from contextlib import contextmanager
import io
from pathlib import Path
import sqlite3
import re
import tempfile
import time
import zipfile

from app.core.errors import IngestionError

MAX_ROWS = 1000
MAX_COLUMNS = 100
MAX_CELL = 20000


def rows_with_header(rows, location):
    iterator = iter(rows)
    header = next(iterator, None)
    if not header or len(header) > MAX_COLUMNS or any(not isinstance(name, str) or not name.strip() for name in header) or len(set(header)) != len(header):
        raise ValueError("Invalid header")
    if not {"patient_id", "encounter_id", "recorded_at"}.issubset(header):
        raise ValueError("Missing required columns")
    result = []
    for number, row in enumerate(iterator, 2):
        if len(row) != len(header):
            raise ValueError("Invalid row")
        if all(value is None or value == "" for value in row):
            continue
        if len(result) >= MAX_ROWS:
            raise ValueError("Too many rows")
        values = {}
        for key, value in zip(header, row):
            if isinstance(value, bytes) or len(str(value or "")) > MAX_CELL:
                raise ValueError("Unsupported or oversized cell")
            if hasattr(value, "isoformat"):
                value = value.isoformat()
            values[key] = "" if value is None else value
        result.append((values, {**location, "row": number}))
    return result


def spreadsheet_rows(content, table=None, inspect=False):
    import openpyxl
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        members = archive.infolist()
        if len(members) > 256 or sum(member.file_size for member in members) > 20 * 1024 * 1024 or any(member.flag_bits & 1 for member in members):
            raise ValueError("Oversized or encrypted workbook")
    workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=False, keep_links=False)
    try:
        names = workbook.sheetnames
        if inspect:
            return names
        selected = select_table(names, table)
        sheet = workbook[selected]
        if sheet.max_row and sheet.max_row > MAX_ROWS + 1 or sheet.max_column and sheet.max_column > MAX_COLUMNS:
            raise ValueError("Oversized worksheet")
        rows = []
        for number, cells in enumerate(sheet.iter_rows(), 1):
            if number > MAX_ROWS + 1 or len(cells) > MAX_COLUMNS or any(cell.data_type == "f" for cell in cells):
                raise ValueError("Formulas or oversized worksheet")
            rows.append(tuple(cell.value for cell in cells))
        return rows_with_header(rows, {"sheet": selected})
    finally:
        workbook.close()


def select_table(names, table):
    if table is None and len(names) == 1:
        return names[0]
    if table not in names:
        raise IngestionError("Select one table or worksheet from this file before importing.", "hospital_table")
    return table


@contextmanager
def sqlite_source(content):
    if not content.startswith(b"SQLite format 3\x00"):
        raise ValueError("Not a SQLite database")
    with tempfile.TemporaryDirectory(prefix="softgraph-hospital-") as directory:
        path = Path(directory) / "source.sqlite3"
        path.write_bytes(content)
        db = sqlite3.connect(path.as_uri() + "?mode=ro&immutable=1", uri=True, timeout=1)
        try:
            db.execute("PRAGMA trusted_schema=OFF")
            db.execute("PRAGMA query_only=ON")
            db.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, 1_000_000)
            db.setlimit(sqlite3.SQLITE_LIMIT_COLUMN, MAX_COLUMNS)
            db.setlimit(sqlite3.SQLITE_LIMIT_ATTACHED, 0)
            deadline = time.monotonic() + 2
            db.set_progress_handler(lambda: int(time.monotonic() > deadline), 1000)
            yield db
        finally:
            db.close()


def sqlite_rows(content, table=None, inspect=False):
    with sqlite_source(content) as db:
        schema = db.execute("SELECT name,type,sql FROM sqlite_master WHERE substr(name,1,7)!='sqlite_' LIMIT 257").fetchall()
        if len(schema) > 256 or any(kind in {"view", "trigger"} or re.search(r"\bCREATE\s+VIRTUAL\s+TABLE\b", sql or "", re.I) for _, kind, sql in schema):
            raise ValueError("Views, triggers and virtual tables are unsupported")
        names = sorted(name for name, kind, _ in schema if kind == "table")
        if inspect:
            return names
        selected = select_table(names, table)
        quoted = '"' + selected.replace('"', '""') + '"'
        cursor = db.execute(f"SELECT * FROM {quoted} LIMIT {MAX_ROWS + 1}")
        header = tuple(item[0] for item in cursor.description)
        rows = cursor.fetchall()
        # Ordinal is explicitly the imported scan row, not an assumed DB primary key.
        return rows_with_header([header, *rows], {"table": selected, "row_kind": "import_scan_ordinal"})
