# Pass 2 Prompt Context

This records the original target design. Current implementation status and phase acceptance are maintained in `PRODUCTION_IMPLEMENTATION_ROADMAP.md`; implemented wire behavior is in `API_CONTRACTS.md`. Future sections below are plans, not active features.

## Current implementation status

API mode (`NEXT_PUBLIC_SERVICE_MODE=api`) implements durable ingestion, a persistent course-domain graph, BM25/graph/fuzzy retrieval, numbered citations, saved explanations and feedback, and the integrated frontend workflow. Sources and results share SQLite at `backend/.local/ingestion.sqlite3`. Optional OpenRouter reranks supplied evidence IDs with a budget, cache and local fallback. Default extraction/ranking scores are untrained heuristics; reliability is unrated. Milestone 5 adds harder synthetic queries, source-family leakage/bootstrap checks, a real SQuAD retrieval ranker experiment and guarded artifact loading/rollback. The candidate has not earned production promotion. Reviewed course data, final-test comparison, real optimizers and release operations remain pending. Optimizer/benchmark services and the hybrid lab remain simulations. See `backend/evaluation/README.md`, `docs/PHASE_AUDIT_2026-10-03.md` and `docs/PRODUCTION_IMPLEMENTATION_ROADMAP.md` for evidence and remaining work.

## Current repository

The repository contains a Vinext/React strict-TypeScript frontend with thirteen routes, deterministic algorithm demonstrations, 42 graph entities, 78 relations, 70+ syllabus registry records, service contracts, mock adapters, numerical tests, documentation, Mermaid presentation sources and a ten-slide PowerPoint.

Important frontend paths:

- services/contracts.ts — frontend service interfaces; graph, ingestion, fuzzy, retrieval, hybrid retrieval and explanations are REST-backed in API mode; evolutionary/swarm/benchmark services remain mocks
- services/index.ts — service-mode composition with graph, ingestion, fuzzy, retrieval, hybrid retrieval and explanation REST wiring plus three explicit mock fallbacks
- services/mock — deterministic Pass-1 adapters with targeted TODO comments
- lib/types.ts — frontend domain models
- lib/parameters.ts — executable parameter registry
- lib/algorithms — tested fuzzy, GA and retrieval reference calculations
- data/graph.ts — 42-node and 78-relation demonstration graph
- data/syllabus.ts — complete syllabus registry
- sample-data — ingestion and evaluation examples

## Contract authority

Implement docs/API_CONTRACTS.md first. Pydantic aliasing may map backend snake_case to frontend camelCase, but the REST adapter must be explicit and tested. Preserve score breakdowns, rule traces, paths, evidence and version fields.

## Required backend models

Document, Chunk, Entity and Relation follow docs/KNOWLEDGE_GRAPH_SCHEMA.md. Add IngestionJob, FuzzyVariable, MembershipDefinition, FuzzyRule, RuleTrace, PipelineConfiguration, OptimizerJob, FitnessVector, RetrievalResult, Explanation and FeedbackEvent from docs/DATA_MODELS.md.

Every mutable schema has schema_version. Every graph mutation has graph_version. Every promoted optimizer result has configuration_version.

## Database proposal

Neo4j stores Document, Chunk and typed Entity nodes. HAS_CHUNK and MENTIONS preserve provenance. Simple facts may be direct typed relationships with confidence properties. Multi-source, temporal or conflicting facts use RelationAssertion nodes. See docs/DATABASE_DESIGN.md.

Start with NetworkX and in-memory repositories, then add Neo4j under the same GraphRepository contract.

## Vector retrieval proposal

VectorRepository must expose upsert, query, delete_by_document and health. Begin with deterministic or in-memory embeddings for tests. Choose Neo4j vector, pgvector or another store only after benchmark and operational review. Store embedding model and index versions on every result.

## Fuzzy engine requirements

- Triangular, trapezoidal and Gaussian membership functions
- Union, intersection and complement
- Linguistic variables and weighted editable rules
- Mamdani and Sugeno inference
- Centroid, bisector and mean-of-maxima defuzzification
- Max-min fuzzy relation composition
- Four-action graph controller
- Complete membership and rule-firing trace

Use docs/FUZZY_ENGINE.md and reproduce lib/algorithms/fuzzy.ts examples.

## Genetic Algorithm requirements

Support binary teaching mode and real-valued production mode. Chromosomes include entity and relation thresholds plus ranking weights. Implement roulette and tournament selection, single and multi-point crossover, bounded mutation, elitism, constraint repair, configurable fitness and Pareto results. Record seed and evaluation count.

## PSO requirements

Particles encode retrieval weights. Implement inertia, cognitive and social updates, pBest, gBest, bounds and weight normalization. Stream convergence. Evaluate equal-budget GA-only and PSO-only baselines before GA-PSO claims.

## ACO requirements

Run over the knowledge graph. Transition probability combines pheromone and semantic heuristic. Implement evaporation, deposits, cycle prevention, maximum hops, path diversity and explanation trace. ACO returns candidate paths and a subgraph; it does not itself fabricate an answer.

## GWO requirements

Maintain alpha, beta, delta and omega roles. Decrease exploration coefficient across iterations. Use candidate-subgraph selection or bounded parameter tuning and expose leader traces.

## WOA requirements

Implement encircling, global search and spiral exploitation. Use bounded graph pruning or parameter search. Expose phase history and convergence.

## Hybrid requirements

- Neuro-fuzzy five-layer architecture with inspectable centres, widths and rule weights
- Fuzzy-GA for membership and rule optimization
- GA-PSO for broad exploration followed by refinement
- Adaptive feedback queue with offline validation, promotion, rollback and versioning

Never mutate a production configuration from one feedback event.

## Evaluation requirements

Use sample-data/retrieval-evaluation.csv as a format example, not a scientific benchmark. Create versioned document, entity, relation and query judgment datasets. Report Precision@K, Recall@K, F1, MRR, NDCG, extraction precision and recall, entity-resolution accuracy, relation accuracy, latency, nodes, edges, density and noise. Include seeds, confidence intervals, hardware and commit.

Required ablations: hard baseline, fuzzy, GA, PSO, ACO, GWO/WOA alternatives and full hybrid.

## Central parameters

Use docs/PARAMETER_REGISTRY.md and lib/parameters.ts. Backend configuration validates ranges and returns the exact configuration version used.

## Unresolved engineering decisions

1. Extraction adapter: rule and statistical baseline, hosted model, or local transformer.
2. Vector store: in-memory reference, Neo4j vector, pgvector or dedicated service.
3. RelationAssertion policy for direct versus reified edges.
4. Background jobs after the in-memory reference.
5. Feedback batch size and promotion criteria.
6. Authentication, authorization and multi-tenancy remain out of initial Pass 2.

Do not resolve these by adding infrastructure before a contract test or benchmark requires it.

## Exact recommended implementation order

1. Scaffold backend package and CI commands.
2. Implement Pydantic contracts and error envelopes.
3. Add in-memory repositories and job service.
4. Implement and test the fuzzy engine.
5. Implement parsers, chunker and deterministic extraction baselines.
6. Build NetworkX graph repository and provenance-aware builder.
7. Implement semantic, graph and hybrid retrieval plus explainers.
8. Implement GA.
9. Implement PSO.
10. Implement ACO.
11. Implement GWO and WOA.
12. Implement Fuzzy-GA, GA-PSO and neuro-fuzzy modules.
13. Add experiment datasets, ablations and artifact reporting.
14. Add Neo4j and chosen vector adapters.
15. Extend the graph, JSON-ingestion and fuzzy frontend REST integration to the remaining REST/WebSocket adapters and switch them through NEXT_PUBLIC_SERVICE_MODE.
16. Replace simulated benchmark values only after reproducible artifacts exist.

For local API-mode development, install backend dependencies and run it on port 8000 with `py -m uvicorn app.main:app --app-dir . --reload --port 8000` from `backend/`, then start the frontend from the repository root with `NEXT_PUBLIC_SERVICE_MODE=api` (PowerShell: `$env:NEXT_PUBLIC_SERVICE_MODE = "api"; pnpm dev`). Persistent graph builds/queries, durable ingestion/chunk inspection, fixed fuzzy evaluation, retrieval, feedback and explanations use REST. Evolutionary, swarm and benchmark services remain deterministic mocks. Grounded retrieval is implemented; custom fuzzy configuration persistence remains planned. See `backend/README.md` for storage, limits and idempotency.
