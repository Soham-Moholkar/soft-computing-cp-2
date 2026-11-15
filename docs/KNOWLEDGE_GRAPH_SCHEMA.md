# Knowledge Graph Schema

## Node labels

Core labels are Person, Organization, Location, Technology, Concept, Event, Document, Product, Process and DomainEntity. Every entity also carries the generic Entity label.

## Document

- document_id: stable source/configuration hash ID in the current SQLite implementation
- name, source_type, source_uri and domain
- timestamp and metadata
- processing_status and graph_version

## Chunk

- chunk_id and document_id
- text, sequence and token_count
- embedding_reference and importance_score
- content_hash for idempotency

## Entity

- entity_id and canonical_name
- entity_type, aliases and description
- source_chunks
- extraction_confidence and fuzzy_confidence
- centrality_score and importance_score
- embedding_reference

## Relation

- relation_id, source_entity and target_entity
- relation_type and evidence
- source_chunk
- source_chunks: all chunks supporting a merged relation; source_chunk/evidence identify its representative assertion
- extraction_confidence, fuzzy_strength, semantic_strength and temporal_strength
- final_weight

Current graph construction uses course-extractor-1 and heuristic-confidence-1. Confidence/semantic/weight values are untrained lexical scores, and temporal strength is neutral. Mention/candidate records preserve normalized segment offsets and review reasons. The graph is a persistent projection over accepted source assertions; review candidates remain stored separately. Learned calibration and embedding similarity belong to later milestones.

## Crisp and fuzzy representations

A relation remains typed and deterministic at the schema level. Its acceptance state is crisp when a consumer requires it, while fuzzy_strength preserves evidence gradation. A rejected edge may remain in a review store rather than vanish.

## Constraints

- IDs are immutable and unique.
- Confidence and strength fields lie in [0,1].
- Every relation refers to existing entities and a valid evidence chunk.
- Aliases are normalized but original surface forms remain in evidence.
- Document and chunk deletion uses provenance-aware cascading or tombstones.
- final_weight is versioned with the configuration that produced it.

## Multi-hop strength

Default fuzzy relation composition uses max-min composition:

    μ(A→C) = max over B of min(μ(A→B), μ(B→C))

Alternate product composition may be evaluated in Pass 2 but must be named in the retrieval response.
