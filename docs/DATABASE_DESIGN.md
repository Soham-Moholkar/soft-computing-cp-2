# Database Design

The current backend uses SQLite for sources, jobs, graph projections, provider quotas/cache and saved retrieval results. The Neo4j/vector design below is a future proposal, not a provisioned dependency.

## Neo4j proposal

Labels:

- Document, Chunk and Entity
- Person, Organization, Location, Technology, Concept, Event, Product, Process and DomainEntity as secondary labels

Relationships:

- HAS_CHUNK from Document to Chunk
- MENTIONS from Chunk to Entity
- typed domain relations between Entity nodes
- EVIDENCED_BY from a relation reification node when multiple evidence records or temporal facts are required

## Indexes and constraints

- Unique constraints on document_id, chunk_id and entity_id
- Index on Entity.canonical_name
- Full-text index over canonical_name, aliases and description
- Index on document domain, timestamp and processing status
- Vector index may live in Neo4j or behind an independent VectorRepository adapter

## Relation evidence

Neo4j relationship properties are adequate for one evidence record. When a fact has multiple sources, time intervals or conflicting claims, use a RelationAssertion node:

    Entity → RelationAssertion → Entity
                    ↓
                  Chunk

This keeps provenance queryable and avoids large relationship-property arrays.

## Vector abstraction

VectorRepository exposes upsert, delete_by_document, query and health. The first implementation may be an in-memory NumPy index for tests. Production choices such as Neo4j vector, pgvector or a dedicated store remain adapters.

## Experiment store

A relational or document store records datasets, query judgments, optimizer runs, seeds, configurations, metrics and artifacts. Do not mix transient optimizer state into the core graph.

## Consistency

Ingestion writes content and graph data through an application transaction boundary. Index updates are idempotent and keyed by content hash. Retrieval reports version skew when graph and vector indexes differ.
