"""Admission and retrieval share these single-user corpus ceilings."""

MAX_CORPUS_CHUNKS = 20_000
MAX_CORPUS_CHARACTERS = 20_000_000
# Includes queued, completed, and failed source BLOBs retained for retry.
MAX_STORED_SOURCE_BYTES = 128 * 1024 * 1024
