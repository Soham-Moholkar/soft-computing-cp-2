"""Bounded text extraction with source locations for downstream graph evidence."""
import csv
import io
import json
import re
import unicodedata
from dataclasses import dataclass
from html.parser import HTMLParser

from app.core.errors import IngestionError
from app.core.chunk_limits import validate_chunk
from app.models.ingestion import ChunkModel
from hashlib import sha256

MAX_BYTES = 10 * 1024 * 1024
MAX_TEXT = 2_000_000
MAX_CHUNKS = 5_000


@dataclass
class Segment:
    text: str
    location: dict[str, str | int]


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFC", text.replace("\x00", ""))
    return "\n".join(re.sub(r"[^\S\n]+", " ", line).strip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")).strip()


class HTMLText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.hidden = 0

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag in {"script", "style", "noscript"}:
            self.hidden += 1
        if tag in {"p", "div", "br", "li", "h1", "h2", "h3", "tr"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"}:
            self.hidden = max(0, self.hidden - 1)
        if tag in {"p", "div", "li", "h1", "h2", "h3", "tr"}:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            self.parts.append(data)


def parse_content(content: bytes, kind: str) -> tuple[list[Segment], list[str]]:
    if kind == "docx":
        from app.ingestion.docx_parser import parse_docx
        return parse_docx(content)
    if kind == "pdf":
        if not content or len(content) > MAX_BYTES:
            raise IngestionError("Source must contain between 1 byte and 10 MiB.")
        if not content.startswith(b"%PDF-"):
            raise IngestionError("The uploaded content is not a PDF.")
        from app.ingestion.parser_worker import parse_pdf_isolated
        return parse_pdf_isolated(content)
    return _parse_content_local(content, kind)


def _parse_content_local(content: bytes, kind: str) -> tuple[list[Segment], list[str]]:
    """Worker-only PDF entry point; other formats also use this pure parser."""
    if not content or len(content) > MAX_BYTES:
        raise IngestionError("Source must contain between 1 byte and 10 MiB.")
    warnings: list[str] = []
    segments: list[Segment] = []
    try:
        if kind == "pdf":
            from pypdf import PdfReader

            if not content.startswith(b"%PDF-"):
                raise IngestionError("The uploaded content is not a PDF.")
            reader = PdfReader(io.BytesIO(content))
            if reader.is_encrypted:
                raise IngestionError("Encrypted PDFs are not supported. Upload an unlocked copy.")
            if len(reader.pages) > 200:
                raise IngestionError("PDFs are limited to 200 pages.")
            total = 0
            for page_number, page in enumerate(reader.pages, 1):
                text = normalize(page.extract_text() or "")
                total += len(text)
                if total > MAX_TEXT:
                    raise IngestionError("Extracted text exceeds the 2 million character limit.")
                if text:
                    segments.append(Segment(text, {"page": page_number}))
                else:
                    warnings.append(f"Page {page_number} has no extractable text; scanned pages require OCR.")
        else:
            text = content.decode("utf-8-sig")
            if kind == "csv":
                rows = csv.reader(io.StringIO(text), strict=True)
                header = next(rows, [])
                if not header or not any(header):
                    raise IngestionError("CSV requires a nonempty header row.")
                for row_number, row in enumerate(rows, 2):
                    if not row or not any(value.strip() for value in row):
                        continue
                    if len(row) != len(header):
                        raise IngestionError(f"CSV row {row_number} does not match the header columns.")
                    segments.append(Segment("; ".join(f"{key}: {value}" for key, value in zip(header, row)), {"row": row_number}))
            elif kind == "json":
                data = json.loads(text, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))
                if not isinstance(data, (dict, list)):
                    raise IngestionError("JSON must contain an object or array.")
                records = data if isinstance(data, list) else [data]
                for index, record in enumerate(records):
                    segments.append(Segment(json.dumps(record, ensure_ascii=False, indent=2), {"json_path": f"$[{index}]" if isinstance(data, list) else "$"}))
            elif kind == "html":
                parser = HTMLText()
                parser.feed(text)
                segments = [Segment("".join(parser.parts), {"section": 1})]
            elif kind in {"txt", "paste", "sample"}:
                segments = [Segment(text, {"section": 1})]
            else:
                raise IngestionError("Unsupported document type.")
    except IngestionError:
        raise
    except UnicodeDecodeError as error:
        raise IngestionError("Text, CSV and JSON files must use UTF-8 encoding.") from error
    except Exception as error:
        raise IngestionError("The source could not be parsed. Check its format and contents.") from error
    segments = [Segment(normalize(segment.text), segment.location) for segment in segments if normalize(segment.text)]
    if not segments:
        raise IngestionError("The source contains no extractable text. Scanned PDFs require OCR.")
    if sum(len(segment.text) for segment in segments) > MAX_TEXT:
        raise IngestionError("Extracted text exceeds the 2 million character limit.")
    return segments, warnings


def chunk_segments(document_id: str, segments: list[Segment], size: int, overlap: int) -> list[ChunkModel]:
    chunks: list[ChunkModel] = []
    for segment in segments:
        words = list(re.finditer(r"\S+", segment.text))
        for start in range(0, len(words), size - overlap):
            end = min(start + size, len(words))
            first, last = words[start].start(), words[end - 1].end()
            text = segment.text[first:last]
            validate_chunk(text)
            digest = sha256(text.encode()).hexdigest()
            sequence = len(chunks)
            chunks.append(ChunkModel(chunk_id=f"chunk-{document_id.removeprefix('document-')}-{sequence}", document_id=document_id, text=text, sequence=sequence, token_count=end - start, content_hash=digest, source_location=segment.location, start_offset=first, end_offset=last))
            if len(chunks) > MAX_CHUNKS:
                raise IngestionError("Too many chunks. Increase the chunk size or reduce the source.")
            if end == len(words):
                break
    return chunks
