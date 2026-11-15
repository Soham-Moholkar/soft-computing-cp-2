# Retrieval Pipeline

## Implemented baseline (2026-10-03)

`POST /api/retrieve` and `/api/hybrid/retrieve` search completed chunks in the same SQLite database as ingestion and graph construction. A read transaction captures source and graph versions together. The in-memory BM25 postings index is reused until the completed source manifest changes. Results, full evidence and explanations are saved as immutable snapshots with a `result_id`.

1. Normalize course aliases (PSO → Particle Swarm Optimization), tokenize, remove function words and normalize a small fixed verb vocabulary.
2. Find BM25 candidates with positive term matches. k1=1.2, b=0.75. Normalize BM25 as `query_term_coverage * bm25 / (bm25 + 1)`.
3. Match built graph entities and traverse undirected neighborhoods within `max_hops`. A chunk's graph proximity is the maximum `1 / (distance + 1)` of its matched entities.
4. Shortlist at most 200 chunks by weighted lexical/graph score, including term coverage when a learned artifact assigns it weight. Evaluate exact fixed Mamdani centroids using cached output curves and repeated input scores; create a full rule/output trace only for the displayed top chunk. Cache source sentence boundaries/terms with the corpus. `semantic_similarity` is a documented lexical proxy; relation strength is the largest accepted source relation confidence, and distance is bounded to the controller's 1–5 universe.
5. Rank, deduplicate identical excerpts within a document, and keep up to `3 * top_k` candidates (at most 30). Optional OpenRouter reranking can reorder these known IDs; invalid output, timeout, quota exhaustion or contention uses the local order.
6. Return at most `top_k` chunks with exact excerpts, document IDs/names and source locations. Paths use only accepted edges backed by these cited chunks. Result relations use an actual quote from a selected supporting source, even when aliases differ across documents. Path display preserves the fact that traversal is undirected; typed relation direction is included separately.
7. Require all informative query terms in selected excerpts. Relationship/path questions with multiple course concepts also require cited paths between their built entities within the hop limit. Missing coverage produces `insufficient_evidence`, with related evidence retained for inspection. These gates are heuristics; term matches do not establish entailment or question-answer correctness.

The output is **cited source excerpts**, not a synthesized factual conclusion. Negation is preserved. The ranking score is not a calibrated probability of correctness. Source reliability is unrated. ACO, embeddings and online adaptation are not active. Default weights remain fixed; an optional promoted course-domain JSON artifact can supply four learned hybrid weights. The real-data candidate is rejected and not enabled live.

| Mode | Lexical | Graph | Fuzzy |
| --- | ---: | ---: | ---: |
| lexical | 1.00 | 0 | 0 |
| graph | 0.50 | 0.50 | 0 |
| fuzzy | 0.60 | 0 | 0.40 |
| hybrid | 0.60 | 0.25 | 0.15 |

Legacy `semantic` requests use lexical mode with a warning. `aco` returns typed HTTP 422 until its implementation phase. Queries are limited to 2,000 characters/50 distinct informative terms, top K to 1–10, hops to 1–5, and the corpus to 20,000 chunks/20 million characters. Each chunk is bounded to 100,000 characters/2,000 sentences, with the same policy enforced before ingestion completion. Excerpts are at most 2,000 characters. Shortlisting can omit relevant evidence in a large corpus; evaluate candidate recall before increasing the cap or adding an embedding index.

## Optional OpenRouter setup

Export `OPENROUTER_API_KEY` in the backend process environment, optionally `SOFTGRAPH_OPENROUTER_MODEL` (default `openrouter/free`, or an available model ending in `:free`) and `SOFTGRAPH_OPENROUTER_DAILY_BUDGET` (default 10, clamped to 0–50). Restart the backend, then check “Use OpenRouter to rerank evidence” for a query. Do not use a `NEXT_PUBLIC_` variable for the key. The backend does not auto-load `.env.example`.

Only the question, candidate IDs and exact excerpts are sent to the fixed HTTPS API endpoint. The model returns an exact permutation of known IDs. OpenRouter's free router may choose different models and availability varies; consult the [official free router documentation](https://openrouter.ai/docs/guides/routing/routers/free-router) and [account limits](https://openrouter.ai/docs/api_reference/limits). The app's budget is independent of the provider's account quota. Failed attempts consume the local budget, cached success does not. UTC budget reservations and cached orders survive restarts; caches keep the latest 1,000 entries. One provider call runs per process, with an eight-second total deadline and no retries. Insufficient term/path coverage skips the provider. A valid reranking can still select an insufficient top K; the final coverage gate then abstains.

Live OpenRouter behavior remains unverified until a server key is configured. Controlled HTTP tests cover parsing, unknown IDs, timeouts and fallback behavior. Pin a specific available model for later reproducible experiments instead of treating free-router results as a stable model baseline.

## Artifacts and saved settings

See `backend/evaluation/README.md` for training, promotion and rollback. `SOFTGRAPH_RANKER_ARTIFACT` loads only a promoted course-domain artifact; rejection activates the baseline with an explicit warning. Unset it and restart to roll back. Health uses the actual index and default hybrid artifact versions. Saved provider results/explanations include the requested model plus temperature, max tokens and deadline; old snapshots remain readable with null/empty settings. The free-router ID does not establish the actual routed model.

## Saved results and feedback

`GET /api/retrieval/results/{result_id}` reads the original snapshot, and `POST /api/explanations` accepts only that ID. `/explainability?result=...` renders the stored trace after restart or graph mutation. The latest 1,000 results are retained; older IDs return 404. Feedback is one label per result, updated on resubmission and removed if that result expires. `POST /api/hybrid/feedback` stores labels for later reviewed training without changing weights.

## Future trained request flow

The following design is planned and has not been promoted into API-mode retrieval.

1. Normalize the user query without losing domain terms.
2. Detect query entities and retain alternate resolutions.
3. Create or retrieve a query embedding.
4. Fetch semantic seed entities and evidence chunks.
5. Expand graph neighborhoods within max_hops.
6. Run ACO over eligible edges with pheromone and heuristic desirability.
7. Assemble candidate subgraphs and paths.
8. Compute fuzzy relevance from semantic, graph, relation, source and distance signals.
9. Apply versioned GA or PSO ranking weights.
10. Return ranked evidence, graph nodes, paths and explanation.

## Hybrid score

    S = 0.26 semantic + 0.18 graph + 0.20 fuzzy
        + 0.09 centrality + 0.10 source + 0.05 temporal + 0.12 ACO_path

These defaults live in the central registry and are starting values only.

## Distance penalty

Path signals use a configurable decay:

    distance_score = exp(−lambda · max(0, hops−1))

The response exposes raw scores, normalized weights and contributions.

## Result contract

- answer and final confidence
- retrieval mode and configuration version
- retrieved nodes and relations
- evidence chunks with source reliability
- ranked paths with pheromone and path score
- fuzzy memberships and rule firing
- score breakdown
- processing timeline
- graph and index versions

## Failure and empty states

No seed entity, disconnected graph, low-confidence result and unavailable embedding service are distinct outcomes. The API returns a structured warning and may fall back to lexical or graph-only retrieval when configured.
