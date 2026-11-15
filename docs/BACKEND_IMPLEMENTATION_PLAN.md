# Backend Implementation Plan

API mode (`NEXT_PUBLIC_SERVICE_MODE=api`) implements durable ingestion, a persistent course-domain graph, BM25/graph/fuzzy retrieval, numbered citations, saved explanations and feedback, and the integrated frontend workflow. Sources and results share SQLite at `backend/.local/ingestion.sqlite3`. Optional OpenRouter reranks supplied evidence IDs with a budget, cache and local fallback. Default extraction/ranking scores are untrained heuristics; reliability is unrated. Milestone 5 adds harder synthetic queries, source-family leakage/bootstrap checks, a real SQuAD retrieval ranker experiment and guarded artifact loading/rollback. The candidate has not earned production promotion. Reviewed course data, final-test comparison, real optimizers and release operations remain pending. Optimizer/benchmark services and the hybrid lab remain simulations. See `backend/evaluation/README.md`, `docs/PHASE_AUDIT_2026-10-03.md` and `docs/PRODUCTION_IMPLEMENTATION_ROADMAP.md` for evidence and remaining work.

## Objective

Replace deterministic Pass-1 service adapters with a tested Python backend while preserving every request and response shape in services/contracts.ts and docs/API_CONTRACTS.md.

## Recommended stack

- Python 3.12
- FastAPI and Pydantic v2
- NetworkX for reference graph algorithms and in-memory tests
- Neo4j behind GraphRepository
- VectorRepository abstraction with an in-memory reference adapter
- NumPy and Pandas for numerical work
- scikit-learn for metrics and small baseline models
- Optional parser, NLP, transformer and hosted-model adapters selected later

Do not make a large model a startup dependency.

## Module structure

    backend/
      pyproject.toml
      app/
        main.py
        api/
          ingestion.py
          graph.py
          retrieval.py
          fuzzy.py
          evolutionary.py
          swarm.py
          hybrid.py
          benchmark.py
          feedback.py
        core/
          config.py
          errors.py
          logging.py
          versions.py
        models/
          ingestion.py
          graph.py
          fuzzy.py
          optimization.py
          retrieval.py
          evaluation.py
        ingestion/
          parser.py
          cleaner.py
          chunker.py
          incremental.py
        extraction/
          entity_extractor.py
          relation_extractor.py
          entity_resolver.py
          adapters/
        graph/
          schema.py
          builder.py
          repository.py
          networkx_repository.py
          neo4j_repository.py
          traversal.py
        fuzzy/
          membership.py
          variables.py
          rules.py
          mamdani.py
          sugeno.py
          defuzzification.py
          controller.py
        evolutionary/
          chromosome.py
          fitness.py
          selection.py
          crossover.py
          mutation.py
          genetic_algorithm.py
        swarm/
          common.py
          pso.py
          aco.py
          gwo.py
          woa.py
        hybrid/
          neuro_fuzzy.py
          fuzzy_ga.py
          ga_pso.py
          adaptive.py
        retrieval/
          semantic.py
          graph_search.py
          ranking.py
          hybrid.py
        explainability/
          fuzzy_explainer.py
          path_explainer.py
          score_explainer.py
        evaluation/
          metrics.py
          experiments.py
          datasets.py
        jobs/
          service.py
          in_memory.py
        ports/
          embeddings.py
          vector_repository.py
          extractors.py
          clock.py
      tests/

## Core interfaces

Parser:

    parse(source: SourceDescriptor) -> ParsedDocument

Extractor:

    extract_entities(chunks) -> list[EntityCandidate]
    extract_relations(chunks, entities) -> list[RelationCandidate]

GraphRepository:

    upsert_document(document, chunks)
    upsert_entities(entities)
    upsert_relations(relations)
    get_subgraph(filters)
    neighbors(entity_id, filters)
    shortest_path(source, target, filters)

VectorRepository:

    upsert(records)
    query(vector, top_k, filters)
    delete_by_document(document_id)

OptimizationObjective:

    evaluate(configuration, dataset_version) -> FitnessVector

## Implementation order

### Phase 1 — contracts and deterministic reference

1. Create Pydantic models that match docs/API_CONTRACTS.md.
2. Add contract snapshot tests against frontend TypeScript examples.
3. Implement configuration loading and version identifiers.
4. Build in-memory document, graph, vector and job repositories.

Exit: all endpoints respond with typed placeholder data and OpenAPI is stable.

### Phase 2 — fuzzy engine

The deterministic REST-backed fuzzy vertical slice is implemented. The broader configurable engine remains planned.

1. Membership functions and validation
2. Set operations and linguistic variables
3. Rule parser and rule traces
4. Mamdani and Sugeno engines
5. Centroid, bisector and mean-of-maxima defuzzification
6. Fuzzy graph controller

Exit: numerical tests cover boundary conditions and frontend examples.

### Phase 3 — graph and ingestion

1. TXT, JSON and CSV parsers
2. PDF parser adapter
3. Cleaner and deterministic chunker
4. Baseline entity and relation extractor adapters
5. Approximate entity resolver
6. Graph builder with provenance and review state
7. NetworkX reference repository

Exit: sample-data files build the expected 42-node teaching graph.

### Phase 4 — retrieval

1. In-memory embedding adapter and VectorRepository
2. Seed entity detection
3. Semantic and graph search
4. Hybrid scoring with score breakdown
5. Path and fuzzy explainers
6. Empty, fallback and degraded modes

Exit: fixed query judgments produce reproducible retrieval metrics.

### Phase 5 — optimizers

1. Common bounded search space and objective interface
2. GA operators and experiment runner
3. PSO with position repair
4. ACO traversal with pheromone trace
5. GWO and WOA reference implementations
6. Equal-budget comparison and Pareto support

Exit: seeded runs are deterministic and satisfy constraints.

### Phase 6 — hybrid and persistence

1. Fuzzy-GA
2. GA-PSO
3. Neuro-fuzzy architecture
4. Feedback event store and offline adaptation
5. Neo4j repository
6. Selected production vector adapter

Exit: promoted configurations are versioned and reversible.

### Phase 7 — evaluation and frontend switch

1. Dataset manifests and gold annotations
2. Ablation runner
3. confidence intervals and artifact export
4. Rest service adapters in the frontend
5. WebSocket progress for ingestion and optimizer jobs
6. End-to-end and performance tests

Exit: all simulated UI labels remain until actual experiment artifacts are attached.

## Testing requirements

- Property tests for membership bounds and optimizer constraints
- Golden tests for rule traces and score breakdowns
- Repository contract tests for NetworkX and Neo4j
- Seeded optimizer snapshots
- Retrieval tests for no seed, disconnected graph and conflicting evidence
- API schema snapshots
- Load tests for graph fetch, retrieval and progress streams

## Operational decisions deferred

- Neo4j vector index versus separate vector store
- local NLP baseline versus hosted extraction provider
- relation reification threshold
- background job engine after the in-memory reference
- authentication and multi-tenancy
- exact feedback promotion policy

Each choice remains behind a port and requires a measured benchmark.
