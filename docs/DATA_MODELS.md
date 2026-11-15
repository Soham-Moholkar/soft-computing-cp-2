# Data Models

Groups below include planned schemas. Implemented strict models live in `backend/app/models`; current wire behavior and retained snapshots are described in `API_CONTRACTS.md`. Ingestion completion and graph construction are separate operations.

## Pydantic model groups

### Ingestion

- IngestionRequest: source type, source metadata, domain and optional text or upload reference
- IngestionJob: job ID, document ID, status, progress, stage and timestamps
- IngestionResult: document, chunks, candidates, warnings and graph build summary

### Graph

- EntityModel and RelationModel mirror docs/KNOWLEDGE_GRAPH_SCHEMA.md
- GraphResponse contains entities, relations, graph_version and pagination
- PathRequest contains source, target, maximum hops and filters
- PathResponse contains ordered nodes, ordered relations and composed strength

### Fuzzy

- MembershipDefinition: type and parameters
- LinguisticVariable: universe and named memberships
- FuzzyRule: antecedent tree, consequent, weight and enabled state
- FuzzyEvaluationRequest: crisp inputs, inference and defuzzification methods
- FuzzyEvaluationResult: score, label, memberships, rule traces and controller decision

### Optimization

- SearchSpaceDefinition: parameter bounds and constraints
- OptimizerRequest: algorithm, seed, budget, objective weights and dataset version
- OptimizerProgress: iteration, best fitness, diversity and elapsed time
- OptimizerResult: best vector, decoded configuration, convergence and Pareto candidates

### Retrieval

- RetrievalRequest: query, mode, top_k, max_hops and optional configuration version
- RetrievalResult: answer, evidence, paths, score breakdown, fuzzy trace and versions
- FeedbackEvent: result ID, label, optional comment and timestamp

## Versioning

All mutable models carry schema_version. Graph mutations produce graph_version. Promoted parameter sets receive configuration_version. Retrieval stores all three so an answer can be reproduced.
