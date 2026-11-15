"""Bounded DOCX body-text extraction. Never extracts files or resolves links."""
import io
from pathlib import PurePosixPath
import re
import struct
import xml.etree.ElementTree as ET
import zipfile

from app.core.errors import IngestionError

MAX_MEMBERS = 256
MAX_DIRECTORY_BYTES = 256 * 1024
MAX_EXPANDED_BYTES = 20 * 1024 * 1024
MAX_XML_BYTES = 10 * 1024 * 1024
MAX_COMPRESSION_RATIO = 200
MAX_PARAGRAPHS = 5_000
MAX_XML_NODES = 100_000
MAX_XML_DEPTH = 64
WORD_NAMESPACES = {
    "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "http://purl.oclc.org/ooxml/wordprocessingml/main",
}
CONTENT_NAMESPACE = "http://schemas.openxmlformats.org/package/2006/content-types"
RELATIONSHIP_NAMESPACE = "http://schemas.openxmlformats.org/package/2006/relationships"
MAIN_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"


def _check_directory(content: bytes) -> None:
    # Bound central-directory allocation before ZipFile creates its ZipInfo list.
    offset = content.rfind(b"PK\x05\x06", max(0, len(content) - 65557))
    if not content.startswith(b"PK\x03\x04") or offset < 0 or len(content) - offset < 22:
        raise IngestionError("The uploaded content is not a valid DOCX package.")
    _, disk, start_disk, disk_entries, entries, size, start, comment = struct.unpack_from("<4s4H2LH", content, offset)
    if disk or start_disk or disk_entries != entries or offset + 22 + comment != len(content):
        raise IngestionError("Multipart or malformed DOCX archives are not supported.")
    if not 1 <= entries <= MAX_MEMBERS or size > MAX_DIRECTORY_BYTES or start + size != offset:
        raise IngestionError("DOCX archive exceeds its member or directory limits.")


def _xml(raw: bytes, budget: list[int]):
    if re.search(br"<!\s*(?:DOCTYPE|ENTITY)\b", raw, re.IGNORECASE):
        raise IngestionError("DOCX XML declarations with DTDs or entities are not supported.")
    # Office writes UTF-8 XML. Strict decoding also rejects UTF-16/32 byte tricks
    # around the declaration check; XML entities are never expanded from a DTD.
    text = raw.decode("utf-8-sig")
    parser = ET.iterparse(io.StringIO(text), events=("start", "end"))
    depth = 0
    for event, _ in parser:
        if event == "start":
            budget[0] += 1
            depth += 1
            if budget[0] > MAX_XML_NODES or depth > MAX_XML_DEPTH:
                raise IngestionError("DOCX XML exceeds its element or nesting limits.")
        else:
            depth -= 1
    return parser.root


def _read_xml(archive: zipfile.ZipFile, member: zipfile.ZipInfo, budget: list[int]):
    if member.file_size > MAX_XML_BYTES:
        raise IngestionError("DOCX XML exceeds the 10 MiB expanded member limit.")
    with archive.open(member) as source:
        raw = source.read(min(member.file_size, MAX_XML_BYTES) + 1)
    if len(raw) != member.file_size or len(raw) > MAX_XML_BYTES:
        raise IngestionError("DOCX archive member size does not match its contents.")
    return _xml(raw, budget)


def parse_docx(content: bytes):
    from app.ingestion.parser import MAX_BYTES, MAX_TEXT, Segment, normalize

    if not content or len(content) > MAX_BYTES:
        raise IngestionError("Source must contain between 1 byte and 10 MiB.")
    try:
        _check_directory(content)
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            members = archive.infolist()
            if len(members) > MAX_MEMBERS:
                raise IngestionError("DOCX archive exceeds its member limit.")
            names = set()
            expanded = 0
            for member in members:
                name = member.filename
                path = PurePosixPath(name)
                if name in names or name != member.orig_filename or len(name) > 255 or "\\" in name or path.is_absolute() or ".." in path.parts:
                    raise IngestionError("DOCX archive contains duplicate or unsafe member paths.")
                names.add(name)
                lowered = name.lower()
                if "vbaproject" in lowered or lowered.startswith("word/embeddings/") or lowered.endswith((".exe", ".dll", ".docm")):
                    raise IngestionError("DOCX macros and embedded objects are not supported.")
                if member.flag_bits & 1 or member.compress_type not in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}:
                    raise IngestionError("Encrypted or unsupported DOCX compression is not supported.")
                expanded += member.file_size
                if expanded > MAX_EXPANDED_BYTES or member.file_size > MAX_XML_BYTES:
                    raise IngestionError("DOCX archive exceeds its expanded size limit.")
                if member.file_size > max(1, member.compress_size) * MAX_COMPRESSION_RATIO:
                    raise IngestionError("DOCX archive exceeds its compression ratio limit.")
            required = {"[Content_Types].xml", "_rels/.rels", "word/document.xml"}
            if not required.issubset(names):
                raise IngestionError("DOCX requires its content types, relationships and Word document.")
            roots = {}
            budget = [0]
            for member in members:
                # Every XML part is checked, including ignored headers and metadata.
                if member.filename.lower().endswith((".xml", ".rels")):
                    roots[member.filename] = _read_xml(archive, member, budget)
            types = roots["[Content_Types].xml"]
            if types.tag != f"{{{CONTENT_NAMESPACE}}}Types":
                raise IngestionError("The DOCX content types are invalid.")
            main_type = None
            for item in types:
                content_type = item.get("ContentType", "")
                if "macroenabled" in content_type.lower() or "vbaproject" in content_type.lower():
                    raise IngestionError("DOCX macros and embedded objects are not supported.")
                if item.tag == f"{{{CONTENT_NAMESPACE}}}Override" and item.get("PartName") == "/word/document.xml":
                    if main_type is not None:
                        raise IngestionError("The DOCX main document content type is duplicated.")
                    main_type = content_type
            if main_type != MAIN_CONTENT_TYPE:
                raise IngestionError("Only non-macro DOCX Word documents are supported.")
            office_document = False
            external_hyperlinks = False
            for name, relationships in roots.items():
                if not name.lower().endswith(".rels"):
                    continue
                if relationships.tag != f"{{{RELATIONSHIP_NAMESPACE}}}Relationships":
                    raise IngestionError("The DOCX relationships are invalid.")
                identifiers = set()
                for relationship in relationships:
                    identifier = relationship.get("Id")
                    if relationship.tag != f"{{{RELATIONSHIP_NAMESPACE}}}Relationship" or not identifier or identifier in identifiers:
                        raise IngestionError("The DOCX relationship entries are invalid or duplicated.")
                    identifiers.add(identifier)
                    target = relationship.get("Target", "")
                    relationship_type = relationship.get("Type", "")
                    if relationship_type.endswith(("/oleObject", "/package", "/vbaProject", "/aFChunk")):
                        raise IngestionError("DOCX macros and embedded objects are not supported.")
                    target_mode = relationship.get("TargetMode", "Internal").lower()
                    if target_mode not in {"internal", "external"}:
                        raise IngestionError("The DOCX relationship target mode is invalid.")
                    if target_mode == "external" or re.match(r"^[a-z][a-z0-9+.-]*:", target, re.IGNORECASE) or target.startswith(("//", "\\")):
                        if relationship_type.endswith("/hyperlink"):
                            external_hyperlinks = True
                            continue
                        raise IngestionError("DOCX external content relationships are not supported. Remove linked content before importing.")
                    if name == "_rels/.rels" and relationship_type.endswith("/officeDocument") and target.lstrip("/") == "word/document.xml":
                        office_document = True
            if not office_document:
                raise IngestionError("The DOCX package does not identify its Word document.")

            document = roots["word/document.xml"]
            namespace = document.tag.removeprefix("{").split("}")[0]
            if namespace not in WORD_NAMESPACES or document.tag != f"{{{namespace}}}document":
                raise IngestionError("The DOCX Word document root is invalid.")
            def word(tag: str) -> str:
                return f"{{{namespace}}}{tag}"
            body = document.find(word("body"))
            if body is None:
                raise IngestionError("The DOCX Word document has no body.")
            unsupported = {word(tag) for tag in ("altChunk", "object")}
            if any(node.tag in unsupported for node in body.iter()):
                raise IngestionError("DOCX embedded content is not supported. Convert it to plain text first.")
            fields_present = any(node.tag in {word("fldSimple"), word("instrText"), word("fldChar")} for node in body.iter())
            segments = []
            total, paragraphs, tables = 0, 0, 0
            # Complex fields can span paragraphs (for example a table of contents).
            # False means instruction phase; True means cached display-result phase.
            field_results: list[bool] = []

            def paragraph(node, location):
                nonlocal total, paragraphs
                paragraphs += 1
                if paragraphs > MAX_PARAGRAPHS:
                    raise IngestionError("DOCX is limited to 5,000 paragraphs, including table cells.")
                parts = []
                for item in node.iter():
                    if item.tag == word("fldChar"):
                        field_kind = item.get(word("fldCharType"))
                        if field_kind == "begin":
                            field_results.append(False)
                        elif field_kind == "separate" and field_results:
                            field_results[-1] = True
                        elif field_kind == "end" and field_results:
                            field_results.pop()
                        continue
                    if not all(field_results):
                        continue
                    if item.tag == word("t") and item.text:
                        total += len(item.text)
                        if total > MAX_TEXT:
                            raise IngestionError("Extracted text exceeds the 2 million character limit.")
                        parts.append(item.text)
                    elif item.tag in {word("tab"), word("br"), word("cr")}:
                        total += 1
                        if total > MAX_TEXT:
                            raise IngestionError("Extracted text exceeds the 2 million character limit.")
                        parts.append(" ")
                text = normalize("".join(parts))
                if text:
                    segments.append(Segment(text, {"paragraph": paragraphs, **location}))

            def blocks(parent, location):
                nonlocal tables
                for node in parent:
                    if node.tag == word("p"):
                        paragraph(node, location)
                    elif node.tag == word("tbl"):
                        tables += 1
                        table_number = tables
                        for row_number, row in enumerate(node.findall(word("tr")), 1):
                            for cell_number, cell in enumerate(row.findall(word("tc")), 1):
                                blocks(cell, {"table": table_number, "row": row_number, "cell": cell_number})
                    elif node.tag in {word("sdt"), word("sdtContent")}:
                        blocks(node, location)

            blocks(body, {})
            if not segments:
                raise IngestionError("The DOCX contains no extractable paragraph or table text. Images require OCR.")
            notices = ["DOCX imports body paragraph and table text only. Images require OCR; headers, footers, comments and layout are not imported."]
            if external_hyperlinks:
                notices.append("External hyperlink targets are not fetched. Only their visible document text is imported.")
            if fields_present:
                notices.append("Cached Word field display text is imported; field instructions are ignored and never executed or refreshed.")
            return segments, notices
    except IngestionError:
        raise
    except (ValueError, OSError, UnicodeError, ET.ParseError, zipfile.BadZipFile, NotImplementedError, RuntimeError) as error:
        raise IngestionError("The DOCX could not be parsed. Check its format and contents.") from error
