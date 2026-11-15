"""One chunk-size policy shared by ingestion and retrieval."""
import re

from app.core.errors import IngestionError

MAX_CHUNK_CHARACTERS = 100000
MAX_CHUNK_SENTENCES = 2000
SENTENCES = re.compile(r"[^.!?\n]+(?:[.!?]|$)")


def validate_chunk(text):
    if len(text) > MAX_CHUNK_CHARACTERS:
        raise IngestionError("Retrieval chunks must be at most 100,000 characters; reduce chunk size or split long tokens.", "retrieval_limit", 413)
    if sum(1 for _ in SENTENCES.finditer(text)) > MAX_CHUNK_SENTENCES:
        raise IngestionError("Retrieval chunks must contain at most 2,000 sentences; reduce chunk size.", "retrieval_limit", 413)
