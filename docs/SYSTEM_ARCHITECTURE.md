# System Architecture

The flow below is the target design. Active API mode uses SQLite, course lexical extraction, BM25, fixed fuzzy relevance and cited BFS paths. Embeddings, source-reliability inference and real optimizers are pending. The integrated workflow and rejected experimental ranker are tracked in `PRODUCTION_IMPLEMENTATION_ROADMAP.md`.

## Design intent

SoftGraph separates deterministic structure from uncertainty-aware intelligence. Parsing, identifiers, schemas and API validation are hard-computing responsibilities. Confidence fusion, approximate linking, search and optimization are soft-computing responsibilities.

## End-to-end flow

1. Data sources enter a parser adapter.
2. Cleaning and chunking create traceable semantic units.
3. extractor adapters produce candidate entities and relations.
4. The fuzzy engine combines extraction confidence, source reliability, agreement and frequency.
5. Entity resolution returns a canonical entity plus alternate candidates and membership values.
6. Graph construction persists typed nodes, fuzzy edges and evidence.
7. GA, PSO, GWO and WOA tune graph and retrieval configurations.
8. Query understanding produces query entities and an embedding.
9. Semantic search and graph neighborhoods produce seeds.
10. ACO explores multi-hop paths and updates pheromone.
11. Fuzzy relevance combines path, semantic and source signals.
12. Optimized ranking creates a subgraph and evidence list.
13. Explanation services expose memberships, rules, paths and score contributions.

## Frontend boundaries

Pages import services/index.ts and depend on interfaces from services/contracts.ts. No page imports arbitrary transport payloads.

    React page
        → typed service interface
        → Pass-1 deterministic mock
        → Pass-2 REST or WebSocket adapter
        → FastAPI application service

## Future backend layers

- API: request validation, job creation, status and streaming
- Application: orchestration and transactions
- Domain: graph, fuzzy, optimizer and retrieval logic
- Ports: repositories, embeddings, extractors, metrics and clocks
- Adapters: Neo4j, vector store, local NLP, hosted model or file parser

## Runtime and incremental updates

Long-running optimizer work returns a job identifier and streams progress. Ingestion may use synchronous execution for small sources and a job for larger corpora. Every graph mutation increments graph_version. Retrieval responses record the graph version and configuration version used.

## Non-goals in Pass 1

No production extraction model, Neo4j deployment, authentication, large language model, hardware-specific edge runtime or scientific benchmark claim is implemented.
