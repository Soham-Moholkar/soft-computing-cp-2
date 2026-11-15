# API Contracts

Base path: /api. JSON uses snake_case in Python and is mapped to camelCase by the frontend adapter. Error bodies contain code, message, details and request_id.

## GET /health

Outside `/api`, this reads current graph/index and default hybrid configuration versions without tokenizing the corpus. `services.ranking_artifact` is `baseline`, `promoted`, or `baseline_artifact_rejected` in live mode; offline injection may identify a `candidate`. Other retrieval modes retain their own recorded configuration.

## POST /api/ingestion/upload

Implemented JSON request (paste, public HTTPS URL, or bundled sample):

    source_type, domain, name
    text (paste) or source_uri (url)
    chunk_size (words, default 400), chunk_overlap (default 0)

Response 202:

    job_id, document_id, status, progress, created_at

File types submitted to this JSON route without bytes are rejected. Limits and identity policy are documented in `backend/README.md`.

## POST /api/ingestion/upload/file

Implemented multipart fields: `file`, `source_type` (`txt|pdf|csv|json`), `name`, `domain`, `chunk_size` (default 400), `chunk_overlap` (default 64). Maximum file size is 10 MiB; filename extension must match the declared type. Returns the same 202 job envelope.

## Ingestion jobs and stored documents

- `GET /api/ingestion/jobs?limit=20` returns recent jobs (limit 1–100).
- `GET /api/ingestion/jobs/{job_id}` returns status, real stage timestamps, warnings, final counts, nullable `error`, and `attempt`.
- `POST /api/ingestion/jobs/{job_id}/retry` returns 202 for failed jobs; other states return 409. A full queue returns 429.
- `GET /api/ingestion/documents/{document_id}?offset=0&limit=20` returns `document`, `chunks`, `total_chunks`, `next_offset`. Offset is nonnegative; limit 1–100. Each chunk includes text, sequence, content hash, word count (`token_count`), source location and offsets in its normalized segment.

Jobs transition uploaded → parsing → chunking → completed, or failed. Document/source/chunk data is durable in SQLite. Completion indicates parsing and chunking; ingestion counts stay zero for entities/relations. Use the separate graph build result for actual extraction counts. WebSocket `/ws/jobs/{job_id}` is planned; current progress uses REST polling.

Graph and retrieval endpoints below are implemented with persistent lexical baselines. Optimizer endpoints remain planned. `POST /api/fuzzy/evaluate` is an implemented fixed inference slice.

## POST /api/graph/build

Implemented request (strict JSON):

    document_ids
    extraction_configuration_version: course-extractor-1 (default)
    fuzzy_configuration_version: heuristic-confidence-1 (default)
    entity_threshold: 0.8 (default, finite 0–1)
    relation_threshold: 0.75 (default, finite 0–1)
    dry_run: false (default)

Document IDs: 1–20; successfully ingested sources only. Per-request limits: 5,000 chunks and 20,000 candidates. HTTP 200 response: `graph_version`, `added_nodes`, `updated_nodes`, `removed_nodes`, `added_relations`, `updated_relations`, `removed_relations`, `review_count`, `changed`, `dry_run`, `warnings`. Builds atomically replace selected source contributions; unchanged builds retain the graph version, previews roll back all writes. Missing source: 404; unfinished/failed source: 409; unsupported configuration: 422; build limits: 413. Review count covers all unaccepted mentions/assertions from the selected sources, including suppressed negation/co-occurrence.

## GET /api/graph

Query: entity_type, relation_type, source, minimum_confidence, cursor and limit.

Response:

    entities: EntityModel[]
    relations: RelationModel[]
    graph_version, next_cursor

The API graph has no demo seed. Pages are stable ID-sorted induced subgraphs: both relation endpoints appear on the current entity page. `source` matches a stored chunk ID, including any supporting source of a merged fact. `minimum_confidence` applies to both node confidence and edge strength. Graph versions are `graph-sqlite-N`.

## GET /api/graph/relations

Implemented independently paginated edges, preserving cross-page connections. Query: `cursor`, `limit` (1–500), `relation_type`, `source`, `minimum_confidence`. Response: `relations`, `graph_version`, `next_cursor`. Each relation retains representative `evidence`/`source_chunk` and all supporting `source_chunks`; individual assertion quotes/spans are available through the source extraction endpoint.

## GET /api/graph/entity/{id}

Implemented response: `entity`, `mentions`, `incoming`, `outgoing`, `evidence`, `graph_version`. Evidence entries include chunk text, document ID/name and source location. Mentions retain surface form, canonical identity, normalized segment span, chunk ID, heuristic score and acceptance state. Missing entity returns 404.

## Graph document contributions

- `GET /api/graph/documents?limit=100` lists the latest completed sources (limit 1–100), with `document_id`, `name`, `built`, `accepted_mentions`, `accepted_relations`, `review_count`.
- `GET /api/graph/documents/{document_id}` returns `configuration`, `mentions`, `relation_candidates`, `graph_version`. An unbuilt source has null configuration and empty candidates. Candidate evidence is an exact stored excerpt; rejected candidates retain their reason and score.
- `DELETE /api/graph/documents/{document_id}` removes that source's graph contributions and prunes unsupported facts, retaining ingested bytes/chunks so rebuilding restores them. Returns `graph_version`; repeat removal is a no-op. Updated source bytes create a new ingestion document; remove the old contribution and build the replacement explicitly.

## POST /api/graph/path

Implemented request: `source_entity`, `target_entity`, `max_hops` (1–10, default 6), `relation_types` (optional list), `minimum_confidence` (finite 0–1, default 0), `directed` (default false). Node confidence and edge strength both honor the threshold. Undirected traversal is explicitly optional and does not reverse the stored predicate.

Response: ordered `nodes`, `relations`, `path_score`, `fuzzy_composed_strength`, `graph_version`. BFS chooses a deterministic shortest path by hops; score/strength is its minimum edge confidence. No route within the bound returns empty nodes/relations and zero scores. Unknown endpoint returns 404. This is a graph path baseline, not the future ACO or hybrid retrieval method.

## POST /api/retrieve

Implemented strict request:

    query: nonblank string, at most 2000 characters / 50 distinct informative terms
    mode: lexical | graph | fuzzy | hybrid (default hybrid)
    top_k: integer 1–10 (default 5)
    max_hops: integer 1–5 (default 4)
    use_provider: boolean (default false)

Legacy `semantic` is accepted as lexical mode with a warning. `aco` returns typed 422 `algorithm_unavailable`. Default configuration is `retrieval-bm25-1`; an explicitly configured promoted artifact changes hybrid weights/version to `ranker-<checksum prefix>`. Clients cannot supply an artifact or configuration version. Corpus limits return 413 `retrieval_limit` rather than silently truncating sources.

Response:

    result_id, query, answer, answer_status, confidence, confidence_label, mode
    nodes, relations, evidence, paths
    score_breakdown, fuzzy_explanation, timeline
    graph_version, index_version, configuration_version
    provider_model_requested (nullable), provider_parameters
    provider_status, warnings

`answer_status`: `evidence` for exact source excerpts or `insufficient_evidence`. `confidence` describes the highest displayed chunk's heuristic local ranking score, even if the answer abstains. Each evidence item contains `citation` (number), `chunk_id`, `document_id`, `document_name`, full `text`, exact `excerpt`, `source_location`, `lexical_score`, `graph_score`, `fuzzy_score`, `rank_score`. Reliability is unrated. Each path contains `labels`, `entity_ids`, `relation_ids`, `citation_ids`, `score` (minimum edge confidence), and `traversal` (undirected BFS). No pheromone is fabricated. Score components record raw scores, weights and contributions; promoted hybrid artifacts may add a fourth term-coverage component. Optional provider snapshots record the requested model and temperature/max_tokens/timeout_seconds, never credentials. A router ID does not identify its actual routed model; old saved snapshots default these new fields to null/empty. Fuzzy traces use the existing evaluation response schema with lexical similarity as an explicit proxy input.

`provider_status`: `disabled`, `unconfigured`, `skipped_insufficient_evidence`, `busy`, `reranked`, `cached`, `fallback`, or `budget_exhausted`. Optional OpenRouter reorders only known evidence IDs and cannot generate answer text. Its daily attempt budget and cache persist in SQLite. See `RETRIEVAL_PIPELINE.md` for setup and limitations.

## Saved retrieval results, explanations and feedback

- `GET /api/retrieval/results/{result_id}` returns the original result snapshot, including evidence and versions. Latest 1,000 retained; missing/expired IDs return 404.
- `POST /api/explanations`: strict `{result_id}`. Returns `headline`, `decision_trace`, `alternatives` (`path`, `confidence`) from that stored snapshot.
- `POST /api/hybrid/feedback`: strict `{result_id, feedback}` where feedback is `relevant|partial|irrelevant`. Returns `{accepted: true, message}`. Unknown result is 404; one label per result is updated on resubmission. Feedback does not mutate weights or claim a completed training step.

## POST /api/fuzzy/evaluate

Request:

    inputs: mapping of crisp values (semantic_similarity [0,1], relation_strength [0,1], graph_distance [1,5])
    variable_set_version: fuzzy-variables-1
    rule_set_version: fuzzy-rules-1
    inference_method: mamdani | sugeno
    defuzzification_method: centroid | bisector | mean_of_maxima

The reference slice uses fixed variable and rule versions; custom rule/config persistence is deferred. Membership functions are shoulder-safe for valid equal adjacent points, and rule weights attenuate firings multiplicatively. Mamdani clips and max-aggregates consequents before applying the requested defuzzification method. Sugeno uses fixed constant consequents and a weighted average; `defuzzification_applied` is false for Sugeno. The wire enum for mean of maxima is `mean_of_maxima`. The response includes `schema_version`, `score`, `label`, flattened `memberships`, `rule_firings`, `aggregated_output`, `controller_decision`, `variable_set_version`, `rule_set_version`, `inference_method`, `defuzzification_method` and `defuzzification_applied`. Each `rule_firings` item contains `rule_id`, `rule`, `antecedent_memberships`, `unweighted_firing`, `weight`, `weighted_firing`, `strength` and `consequent`; each `aggregated_output` item contains `x` and `membership`.

## POST /api/ga/optimize (planned)

Request: search_space, population_size, generations, mutation_rate, crossover_rate, elitism, selection_method, encoding, objective weights, seed and dataset_version.

Response 202: job_id and status URL. Final result contains best chromosome, decoded configuration, convergence, Pareto candidates, metrics and reproducibility metadata.

## POST /api/pso/optimize (planned)

Request: search_space, particle_count, inertia_weight, cognitive_coefficient, social_coefficient, iterations, objective, seed and dataset_version.

Response uses the common optimizer job model.

## POST /api/aco/search (planned)

Request: query, seed_entity_ids, ant_count, alpha, beta, evaporation_rate, deposit, iterations, max_hops and graph_version.

Response: ranked paths, best subgraph, pheromone trace, visited count and timing.

## POST /api/gwo/optimize (planned)

Request: search_space, wolf_count, iterations, exploration coefficient, objective, seed and dataset_version.

Response uses the common optimizer job model and includes alpha, beta and delta traces.

## POST /api/woa/optimize (planned)

Request: search_space, whale_count, iterations, spiral_constant, exploration parameters, objective, seed and dataset_version.

Response uses the common optimizer job model and includes phase history.

## POST /api/hybrid/retrieve

Implemented alias of `/api/retrieve` using the same request, configured ranking and response. `mode` controls the baseline weighting. Trained embeddings and promoted optimizer configurations are future work.

## POST /api/feedback (planned)

Request: result_id, label relevant | partial | irrelevant, optional comment and timestamp.

Response: accepted, queue_id and current adaptive policy. Feedback never mutates production weights synchronously.

## GET /api/benchmark (implemented)

Returns checked-in validation report metadata/summary/extraction/limitations and
the workspace's latest optimizer jobs. These are historical versioned artifacts,
not measurements of the currently loaded workspace corpus.

Response: `reports`, `optimizer_runs`, `production_promoted` (false until a reviewed
candidate satisfies promotion). Unknown real-data extraction/no-answer metrics
remain null. Mock mode has separate educational benchmark data.

## Workspace and operations API (implemented)

All existing endpoints remain available for the course workspace. The same routes
are mounted at `/workspaces/{healthcare|agriculture|engineering|finance|personal|course}/api/...`. Workspace IDs
are fixed; each database and its documents/results/jobs are isolated. Authentication
checks membership and reader/editor roles before dispatch, including legacy paths.
Mounted app startup/shutdown is explicitly managed by the parent lifespan.

- `GET /api/workspaces`: account-visible profile descriptors and example questions.
- `GET/POST/DELETE /api/auth/session`: inspect, sign in with an administrator-issued
  `access_key`, or sign out. The session uses an HttpOnly cookie. See OPERATIONS.md.
- `GET /ready`: availability and authentication/deployment mode. Public health and
  readiness do not expose document content or credentials.
- `GET /workspaces/{id}/api/workspace/summary`: actual counts, latest 100 source
  records, latest six retained query snapshots, graph version and serving ranker.
- `GET/PUT .../workspace/settings`: `mode` (`lexical|hybrid|fuzzy|graph`), `top_k`
  (1–10), `max_hops` (1–5), `view` (`cards|list`). Editor-only writes persist defaults;
  each retrieval request still supplies its own controls.
- `POST .../workspace/examples`: explicitly enqueue four idempotent theoretical
  sources; returns accepted jobs and the workspace extractor configuration version.
  Processing and graph build remain separate operations.
- `POST .../optimization/jobs`: `algorithm` (`GA|PSO|GWO|WOA|FUZZY_GA|GA_PSO|NEURO_FUZZY`),
  `dataset` (`synthetic|real`), seed, population, budget and GA controls. Returns a
  persistent queued job. `GET .../optimization/jobs` and `GET .../{job_id}` reopen
  status, measured trace and data-only candidate artifact. No endpoint promotes
  a candidate. Feature banks are diagnostics separate from live workspace sources.
- `POST .../aco/search`: existing source/target entity IDs, ant count, iterations,
  hops, seed and directed flag. Returns actual successful paths, source chunk IDs,
  evolved pheromone and iteration trace over the workspace graph.

The frontend's fixed-upstream proxy `/api/backend/...` maps these paths to the
backend; it is not a second authorization boundary. API errors propagate visibly;
adapters never replace failures with mock scores.

## GET /api/syllabus (planned)

Returns the registry schema used by the frontend: unit, topic, concept, where_used, why_used, input, output, parameters, equation, frontend_demo, future_backend and evaluation_metric.

### Domain environments (4 October 2026)

`GET /api/workspaces` descriptors also return a `policy` (name, lexical/graph/fuzzy weights, version, focus) and `default_preferences`. Settings accept optional `ranking_profile: "domain" | "balanced"`; new workspace defaults are domain configured. Older saved preferences retain balanced ranking. Retrieval requests accept the same field; absent means balanced for backward compatibility. In hybrid mode, domain profiles apply the configured weights unless a promoted course artifact is active. Saved results record the applied `configuration_version` and actual `score_breakdown` weights. Other modes retain mode-specific weights.

All six mounted environments enforce account membership and reader/editor permissions. Healthcare, agriculture and finance have separate domain-only ontologies. Their sources and results cannot be retrieved through another workspace route. Example packs remain explicit, fictional and idempotent. The optimizer and evaluation laboratories belong only to the course workspace; they are not domain-trained models.
