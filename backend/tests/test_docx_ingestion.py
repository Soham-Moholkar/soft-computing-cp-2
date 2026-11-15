import io
import struct
import time
import warnings
import zipfile

import pytest
from fastapi.testclient import TestClient

from app.core.errors import IngestionError
from app.factory import create_app
from app.ingestion import docx_parser
from app.ingestion.parser import MAX_TEXT, parse_content

WORD = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
RELATIONSHIPS = "http://schemas.openxmlformats.org/package/2006/relationships"
CONTENT_TYPES = "http://schemas.openxmlformats.org/package/2006/content-types"


def package(body='<w:p><w:r><w:t>Fuzzy logic supports evidence retrieval.</w:t></w:r></w:p>', *, entries=None, compression=zipfile.ZIP_DEFLATED):
    parts = {
        "[Content_Types].xml": f'<Types xmlns="{CONTENT_TYPES}"><Override PartName="/word/document.xml" ContentType="{docx_parser.MAIN_CONTENT_TYPE}"/></Types>',
        "_rels/.rels": f'<Relationships xmlns="{RELATIONSHIPS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        "word/document.xml": f'<w:document xmlns:w="{WORD}"><w:body>{body}</w:body></w:document>',
        **(entries or {}),
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=compression) as archive:
        for name, content in parts.items():
            archive.writestr(name, content)
    return output.getvalue()


def wait_job(client, job_id):
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        result = client.get(f"/api/ingestion/jobs/{job_id}")
        assert result.status_code == 200
        job = result.json()
        if job["status"] in {"completed", "failed"}:
            return job
        time.sleep(.01)
    pytest.fail("DOCX ingestion did not finish")


def upload(client, content, filename="notes.docx", source_type="docx"):
    return client.post("/api/ingestion/upload/file", data={
        "name": filename, "source_type": source_type, "domain": "course", "chunk_size": 3, "chunk_overlap": 0,
    }, files={"file": (filename, content, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")})


def test_docx_extracts_runs_tables_unicode_and_paragraph_locations_without_images():
    source = package(
        '<w:p><w:r><w:t>Café</w:t><w:tab/><w:t>fuzzy </w:t></w:r><w:r><w:t>evidence</w:t><w:br/><w:t>graph.</w:t></w:r></w:p>'
        '<w:p/>'
        '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Record A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Actual value</w:t></w:r></w:p></w:tc></w:tr></w:tbl>',
        entries={"word/media/image1.png": b"image bytes are never interpreted"},
    )
    segments, notices = parse_content(source, "docx")
    assert [item.text for item in segments] == ["Café fuzzy evidence graph.", "Record A", "Actual value"]
    assert [item.location for item in segments] == [
        {"paragraph": 1},
        {"paragraph": 3, "table": 1, "row": 1, "cell": 1},
        {"paragraph": 4, "table": 1, "row": 1, "cell": 2},
    ]
    assert "Images require OCR" in notices[0]


def test_docx_persists_original_bytes_paginated_chunks_and_restart_state(tmp_path):
    source = package('<w:p><w:r><w:t>Fuzzy logic supports cited evidence retrieval and graph reasoning.</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph keeps its own provenance.</w:t></w:r></w:p>')
    database = str(tmp_path / "documents.sqlite3")
    with TestClient(create_app(database_path=database, enable_optimizers=False)) as client:
        response = upload(client, source)
        assert response.status_code == 202, response.text
        accepted = response.json()
        job = wait_job(client, accepted["job_id"])
        assert job["status"] == "completed", job
        assert client.app.state.ingestion_repository.source(job["job_id"])[1] == source
        first = client.get(f"/api/ingestion/documents/{job['document_id']}?limit=1").json()
        second = client.get(f"/api/ingestion/documents/{job['document_id']}?offset=1&limit=1").json()
        assert first["document"]["source_type"] == "docx"
        assert first["document"]["byte_count"] == len(source)
        assert first["total_chunks"] >= 4 and first["next_offset"] == 1
        assert first["chunks"][0]["source_location"] == {"paragraph": 1}
        assert second["chunks"][0]["text"] == "cited evidence retrieval"
        assert upload(client, source).json()["job_id"] == accepted["job_id"]
    with TestClient(create_app(database_path=database, enable_optimizers=False)) as restarted:
        assert restarted.get(f"/api/ingestion/jobs/{accepted['job_id']}").json() == job
        assert restarted.get(f"/api/ingestion/documents/{job['document_id']}?limit=1").json() == first


@pytest.mark.parametrize("source,match", [
    (b"not a Word document", "valid DOCX"),
    (package(entries={"word/document.xml": "<broken>"}), "could not be parsed"),
    (package(entries={"word/document.xml": "<document><body>plain XML</body></document>"}), "root is invalid"),
    (package(body=""), "no extractable"),
    (package(entries={"word/document.xml": f'<!DOCTYPE w:document [<!ENTITY secret "must never expand">]><w:document xmlns:w="{WORD}"><w:body><w:p><w:r><w:t>&secret;</w:t></w:r></w:p></w:body></w:document>'}), "DTDs or entities"),
    (package(entries={"word/header1.xml": '<!DOCTYPE x SYSTEM "file:///private"><x/>'}), "DTDs or entities"),
    (package(entries={"word/vbaProject.bin": b"macro"}), "macros and embedded"),
    (package(entries={"word/embeddings/oleObject1.bin": b"embedded"}), "macros and embedded"),
    (package(entries={"../outside.xml": "<x/>"}), "unsafe member"),
    (package(body='<w:altChunk/>'), "embedded content"),
    (package(entries={"[Content_Types].xml": f'<Types xmlns="{CONTENT_TYPES}"><Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/></Types>'}), "macros and embedded"),
    (package(entries={"word/_rels/document.xml.rels": f'<Relationships xmlns="{RELATIONSHIPS}"><Relationship Id="link" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://external.test/private" TargetMode="External"/></Relationships>'}), "external content relationships"),
], ids=["not-zip", "malformed-xml", "wrong-root", "empty", "entities", "ignored-part-dtd", "macro", "embedded-object", "path", "alt-chunk", "macro-type", "external-image"])
def test_docx_rejects_malformed_or_active_content(source, match):
    with pytest.raises(IngestionError, match=match):
        parse_content(source, "docx")


def test_docx_hyperlinks_and_cached_fields_keep_visible_text_without_resolving_targets(monkeypatch):
    import socket
    import subprocess
    import urllib.request

    def forbidden(*args, **kwargs):
        pytest.fail("DOCX parsing must not fetch links or execute field instructions")

    monkeypatch.setattr(socket, "create_connection", forbidden)
    monkeypatch.setattr(urllib.request, "urlopen", forbidden)
    monkeypatch.setattr(subprocess, "Popen", forbidden)
    source = package(
        '<w:p><w:hyperlink xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="link"><w:r><w:t>Visible reference</w:t></w:r></w:hyperlink><w:r><w:t> page </w:t></w:r>'
        '<w:fldSimple w:instr="PAGE"><w:r><w:t>7</w:t></w:r></w:fldSimple></w:p>'
        '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>INCLUDETEXT https://private.test/SECRET_INSTRUCTION</w:instrText></w:r>'
        '<w:r><w:t>hidden instruction-phase text</w:t></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>'
        '<w:r><w:t>Cached field result</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>',
        entries={"word/_rels/document.xml.rels": f'<Relationships xmlns="{RELATIONSHIPS}"><Relationship Id="link" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://private.test/SECRET_TARGET" TargetMode="External"/></Relationships>'},
    )
    segments, notices = parse_content(source, "docx")
    assert [item.text for item in segments] == ["Visible reference page 7", "Cached field result"]
    assert [item.location for item in segments] == [{"paragraph": 1}, {"paragraph": 2}]
    assert "External hyperlink targets are not fetched" in notices[1]
    assert "field instructions are ignored" in notices[2]
    assert "SECRET" not in str(segments) + str(notices)


def test_docx_complex_field_result_can_span_paragraphs_and_warnings_are_conditional():
    source = package(
        '<w:p><w:r><w:fldChar w:fldCharType="begin"/><w:instrText>TOC</w:instrText><w:fldChar w:fldCharType="separate"/><w:t>First cached entry</w:t></w:r></w:p>'
        '<w:p><w:r><w:t>Second cached entry</w:t><w:fldChar w:fldCharType="end"/></w:r></w:p>'
    )
    segments, notices = parse_content(source, "docx")
    assert [item.text for item in segments] == ["First cached entry", "Second cached entry"]
    assert any("field instructions" in notice for notice in notices)
    assert not any("hyperlink targets" in notice for notice in notices)
    _, plain_notices = parse_content(package(), "docx")
    assert len(plain_notices) == 1


def test_docx_member_and_directory_limits_apply_before_archive_allocation(monkeypatch):
    source = bytearray(package())
    end = source.rfind(b"PK\x05\x06")
    struct.pack_into("<HH", source, end + 8, 257, 257)
    monkeypatch.setattr(docx_parser.zipfile, "ZipFile", lambda *args, **kwargs: pytest.fail("Unbounded archive metadata was opened"))
    with pytest.raises(IngestionError, match="member or directory"):
        parse_content(bytes(source), "docx")


def test_docx_rejects_missing_document_duplicate_names_and_compression_bombs():
    with pytest.raises(IngestionError, match="compression ratio"):
        parse_content(package(body='<w:p><w:r><w:t>' + ('a' * 100000) + '</w:t></w:r></w:p>'), "docx")
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("other.xml", "<root/>")
    with pytest.raises(IngestionError, match="requires"):
        parse_content(output.getvalue(), "docx")
    output = io.BytesIO(package())
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        with zipfile.ZipFile(output, "a") as archive:
            archive.writestr("word/document.xml", "<other/>")
    with pytest.raises(IngestionError, match="duplicate"):
        parse_content(output.getvalue(), "docx")


def test_docx_expanded_size_text_paragraph_and_xml_depth_caps(monkeypatch):
    source = package(compression=zipfile.ZIP_STORED)
    with monkeypatch.context() as patch:
        patch.setattr(docx_parser, "MAX_EXPANDED_BYTES", 100)
        with pytest.raises(IngestionError, match="expanded size"):
            parse_content(source, "docx")
    with monkeypatch.context() as patch:
        patch.setattr(docx_parser, "MAX_PARAGRAPHS", 1)
        with pytest.raises(IngestionError, match="paragraphs"):
            parse_content(package(body='<w:p/><w:p/>'), "docx")
    with monkeypatch.context() as patch:
        patch.setattr(docx_parser, "MAX_XML_DEPTH", 5)
        with pytest.raises(IngestionError, match="nesting"):
            parse_content(package(body='<w:p><w:r><w:t><nested>deep</nested></w:t></w:r></w:p>'), "docx")
    with pytest.raises(IngestionError, match="2 million"):
        parse_content(package(body='<w:p><w:r><w:t>' + ('x' * (MAX_TEXT + 1)) + '</w:t></w:r></w:p>', compression=zipfile.ZIP_STORED), "docx")


def test_docx_errors_are_durable_and_legacy_word_extensions_are_rejected(tmp_path):
    with TestClient(create_app(database_path=str(tmp_path / "documents.sqlite3"), enable_optimizers=False)) as client:
        accepted = upload(client, package(body="")).json()
        job = wait_job(client, accepted["job_id"])
        assert job["status"] == "failed" and "no extractable" in job["error"]
        assert client.get(f"/api/ingestion/documents/{job['document_id']}").json()["chunks"] == []
        assert upload(client, package(), filename="legacy.doc").status_code == 400
        assert upload(client, package(), filename="macro.docm").status_code == 400
        assert upload(client, package(), source_type="doc").status_code == 422
