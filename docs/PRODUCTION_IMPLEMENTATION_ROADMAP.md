# SoftGraph implementation path

Status: 2026-10-04. Milestone 6 and the local operations implementation for Milestone 7 now pass backend verification; three isolated SaaS dashboards are implemented. Public release gates remain open (hosting, parser isolation, reviewed course gold and deployed load checks). See OPTIMIZATION.md, OPERATIONS.md and SAAS_USE_CASES.md. Historical phase audit follows. Milestones 1–4 are implemented and audited. Milestone 5 includes synthetic and real-data diagnostics, cluster bootstrap, candidate training, promotion checks and artifact rollback. No candidate is promoted: the general-Wikipedia experiment does not meet course-domain review, no-answer and quality gates. Locked test metrics remain untouched. This is a local baseline with a trained experimental candidate, not a production release. See `PHASE_AUDIT_2026-10-03.md`.

## Target outcome

A user can submit an allowed document, see a durable ingestion job, inspect the entities and evidence-backed relations created from it, ask a question, and receive an answer supported by specific stored chunks and graph paths. The result records the graph, index, model, and configuration versions used. Training and optimizer claims are backed by held-out evaluation artifacts. The deployed frontend and backend pass the same end-to-end workflow.

The first target domain is the soft-computing course material already represented in the project. A larger, legally usable corpus and labeled judgments are needed before meaningful training or quality claims.

## Operating rules

- Keep the existing TypeScript service boundary and the documented API shapes, updating both together when a contract genuinely needs to change.
- Make each backend slice executable and testable before building the next slice. Connect its frontend adapter when the slice is ready; complete the whole user-facing integration after ingestion, construction, and retrieval all work.
- Fix correctness defects discovered within a slice immediately. Reserve final-stage work for deployment hardening, broad performance tuning, and operational polish.
- Keep AI providers optional behind backend adapters. Retrieval and evidence selection must remain testable without a hosted text-generation model.
- Record source and configuration versions so an answer or experiment can be reproduced. Preserve the simulated labels until measured results replace them.

## Milestone 1 — real ingestion

Implemented using SQLite, actual multipart file bytes, pypdf/structured parsers, public HTTPS fetching, overlap chunking, two background workers, retries, startup recovery and frontend REST polling. See `backend/README.md` for limits, idempotency, local run instructions and current limitations. No OCR or graph extraction is included in this milestone.

Verification (2026-10-01): 39 backend tests, 24 frontend tests, lint, type checking and production build passed. Browser smoke test processed pasted text, inspected stored evidence, navigated home and reopened the chunks after a real backend process restart with no console errors. Browser automation policy blocked localhost file selection; actual multipart uploads for all four formats passed automated endpoint tests, and the frontend adapter test verified file bytes in FormData.

### Build

- Define source limits, allowed file types, document identity, idempotency, status transitions, and error responses.
- Accept actual TXT, PDF, CSV, and JSON file bytes and pasted text. Support URL ingestion only with safe fetching rules and source attribution.
- Parse, normalize, chunk with overlap, hash, and store documents and chunks durably. Preserve page/row/offset references where available.
- Implement background jobs or a bounded worker so uploads return promptly and progress reflects real work. Add retry and failure states.
- Add parser and repository tests with malformed, duplicate, empty, and large-enough sample documents.

### Done when

An uploaded file's contents, chunks, provenance, and job history can be read back after a backend restart. Duplicate submission follows the documented idempotency policy. A failed parse is visible as a failure rather than a completed job with zero entities.

## Milestone 2 — graph construction

Implemented: 32 course concepts with alias normalization; exact mention spans; conservative predicate extraction and review thresholds; SQLite-backed shared facts/evidence; versioned transactional build/preview/rebuild/removal; entity details, filtered node/edge pagination and bounded paths; frontend build controls and source inspection. Eight authored gold fixtures cover alias resolution, predicates, negation and uncertainty. Hosted extraction remains deferred; Milestone 3 uses OpenRouter only for evidence reranking. The current scores are explicitly untrained heuristics; the fixtures are regression examples, not a measured quality benchmark. See `backend/README.md` for limits and replacement semantics.

Verification (2026-10-03): 44 backend tests, 27 frontend tests, lint, type checking and production build passed. The browser workflow ingested two authored verification sources, previewed without mutation, built four entities/three relations, then merged the second source into six entities/four relations with one co-occurrence candidate left in review. PSO and its canonical name resolve to one entity with evidence from both documents. After an actual backend process restart, graph version, source inspection and the PSO → Hybrid Retrieval → Knowledge Graph path still worked; no new console errors appeared during that verification. These checks established the graph baseline for Milestone 3.

### Build

- Create a deterministic extraction baseline for the course domain, followed by an optional model-assisted extractor. Keep candidate mentions, scores, and source spans.
- Add relation extraction, alias normalization, entity resolution, review thresholds, and graph schema validation.
- Upsert documents, chunks, entities, relations, and evidence links through a persistent repository. Increment graph version on mutation; implement update/delete semantics.
- Implement graph build, entity detail, path, filtering, and pagination endpoints. Ensure edges connecting entities on different pages are retrievable.
- Create gold examples for extraction and resolution while building this slice.

### Done when

Ingesting two related documents changes the graph predictably; each displayed relation points to a real source chunk; repeated ingestion does not duplicate facts; and graph/path queries work after restart.

## Milestone 3 — grounded retrieval

Implemented: versioned BM25 over completed saved chunks, course alias expansion, bounded graph neighborhoods and cited BFS paths, fixed fuzzy inference using a lexical proxy, per-component ranking traces, exact source excerpts with numbered citations, conservative term/path coverage gates, persisted result snapshots and feedback. API-mode retrieval, hybrid retrieval and explanations now use REST. Feedback records a label for a saved result; it does not train or adapt weights online.

OpenRouter is optional and opt-in per query. It reranks up to 30 candidate excerpts by returning only supplied chunk IDs. It cannot generate answer text or invent citations. A server-only key, free model restriction, atomic UTC daily attempt budget (default 10), eight-second total deadline, zero retries, bounded cache and local fallback are implemented. A busy provider request also falls back immediately. No live provider call was verified because a key was not configured.

Verification (2026-10-03): 67 backend tests, 32 frontend tests, lint, type checking and production build passed. Browser checks confirmed a supported query and cited path, feedback confirmation, unsupported-year abstention, unconfigured-provider fallback, and the same saved explanation after a real backend process restart. Provider HTTP parsing, deadlines, invalid IDs, cache reuse and quotas were tested with controlled transports. A larger candidate-set regression verified the fuzzy shortlist cap. No console warnings or errors appeared during the final browser checks. This establishes functionality, not measured retrieval quality. See `docs/RETRIEVAL_PIPELINE.md` for the baseline's limitations.

### Build

- Create a lexical baseline first, then add a versioned embedding/index adapter if it improves held-out retrieval.
- Resolve query entities, retrieve candidate chunks and graph neighborhoods, score and rank results, and handle ambiguous, disconnected, and no-answer queries.
- Add hybrid scores with component breakdowns and explainers derived from the actual retrieved evidence. Return graph, index, model, and configuration versions.
- Use the optional OpenRouter adapter for evidence reranking first. Pass only candidate excerpts; verify the returned chunk IDs. Evaluate extraction assistance or answer wording separately before promotion. Keep API keys server-side.
- Set a per-day request budget, timeout, bounded retries, cache, and a grounded non-LLM fallback when the provider is unavailable or quota is exhausted.

### Done when

Different questions produce different evidence and answers; answers cite existing chunks; unsupported questions abstain; and the workflow still returns ranked evidence when the hosted model is unavailable.

## Milestone 4 — full frontend integration of the first three slices

Implemented: overview checks backend health and loads saved graph counts, version and recent job status with refresh/30-second checks; recent source/job counts explicitly cover the latest 20 jobs. Document links from ingestion completion and reopened evidence select the matching source in the graph builder. Graph controls guide users onward to retrieval, which links cited results to saved explanations. Architecture lists active REST adapters versus remaining mocks; specialist industry and edge profiles remain conceptual; API optimizer labs and benchmarks now read actual runs.

Verification (2026-10-03): 67 backend tests and 32 frontend tests pass, alongside lint, type checking and API-mode production build. Browser verification processed a fresh pasted course document, inspected its stored chunk, followed the document-specific build link, and built its contributions (one new entity, one accepted relation, two review candidates). A query cited that exact source first. After an actual backend process restart, the same question returned that source and unchanged graph/index versions. Previous multipart endpoint tests cover file bytes; this fresh browser run used pasted text. No trained quality claims are made.
- Replace ingestion, graph, retrieval, hybrid retrieval, and explanation mocks for the working path. Show real job status, errors, graph counts, provenance, citations, and versions.
- Fix the graph page's demo-only default node IDs and reconcile the 42-node demo copy with the active graph.
- Keep demo-only algorithm pages explicitly labeled until their backend modules exist.
- Run a browser end-to-end test: upload a real document, observe graph changes, retrieve an evidence-backed answer, restart the backend, and repeat the query.

## Milestone 5 — training and evaluation

Implemented: original 14-source/23-query synthetic fixtures plus a harder 35-query version; source/query-family and lexical near-duplicate rejection; shared-fact review flags; isolated source-separated evaluations; 2,000 whole connected-family bootstrap draws with intervals withheld below five clusters; seeded query order and repeated warm API timing. Reports separate ranking, evidence coverage, non-abstaining relevant response coverage, no-answer errors and citation provenance. Missing real extraction/no-answer gold is reported as unavailable.

A licensed SQuAD 2.0 adaptation supplies 180 human-authored paragraphs and 359 questions in 30 article families, separated 14/8/8 into train/validation/test. It is general Wikipedia data with provisional pooled paragraph relevance, not a reviewed course benchmark. A four-feature pairwise linear ranker trains only on the training partition. Matched validation found no NDCG gain; relevant response coverage remains 21.9%. A concrete promotion decision rejects the candidate. Final test metrics have not been opened.

Data-only, checksummed model export, strict promotion checks, optional live loading and rollback are implemented. Live configuration refuses candidates or incompatible domains and exposes fallback. Promotion verifies per-query summaries and exact manifest query/family coverage, matching code/data/environment/seed/protocol and independently reviewed course labels, with thresholds set before final testing. Hashes are integrity records, not cryptographic authorization.

Verification after the phase audit: 89 backend tests and 32 frontend tests pass, with lint and type checking. Regression checks cover score/trace equivalence, poisoning chunks, learned-weight shortlisting, health versions, saved provider settings, artifact rejection/rollback, omitted/duplicated queries and dishonest aggregate gates. Same-fixture local latency improvements are documented in the audit; these are not deployed load measurements.

Remaining: a reviewed course corpus with corpus-wide no-answer labels and judgment pooling, a candidate that improves usable response coverage and ranking, final frozen test comparison and release load/operations checks. See `backend/evaluation/README.md` for reproducible commands. The optimizer phase may build against validation diagnostics, but cannot claim a production fitness target from this unreviewed general-domain experiment.

### Dataset first

- Assemble licensed course documents and annotation guidelines. Label entities, relations, aliases, query-to-evidence relevance, and no-answer cases.
- Split by source document into train, validation, and locked test partitions to avoid leakage. Version the data and record annotation disagreements.
- Measure lexical and rules baselines before training. Track extraction precision/recall/F1, entity-resolution accuracy, retrieval Precision@K, Recall@K, MRR, NDCG, evidence coverage, calibration, latency, and failure rate.

### Train only what earns its place

- Start with pretrained embeddings and a small trainable ranker or calibrated fuzzy/ranking weights. Train or fine-tune an extractor only if the deterministic baseline has a measured gap.
- Use Google Colab or Kaggle notebooks for offline experiments. Use CPU for parsing, classical baselines, and many optimizer runs; request GPU when the chosen embedding or neural model actually uses it.
- Make runs restartable: fixed seeds, pinned dependencies, small checkpoints, dataset hashes, metric logs, and exported model/configuration artifacts. Never use a notebook runtime as the production API server.
- Evaluate on validation data during development; open the test set only for final comparisons. Record negative results and compare against the untrained baseline.

### Done when

A fresh environment can reproduce the selected artifact and evaluation report from a documented dataset version, seed, command/notebook, and dependency set. The production backend can load and roll back the exported artifact.

## Milestone 6 — project optimizers and hybrid methods

Implemented: bounded actual searches, stored-edge ACO, train-only fixed-membership Sugeno consequents, equal-budget three-seed comparisons, durable API jobs and recorded UI traces. Real-data searches tie baseline NDCG; synthetic gains remain diagnostic. See OPTIMIZATION.md.

- Define one bounded search space and a real fitness function from validation metrics, latency, and graph quality. Record every evaluation count and seed.
- Implement GA and PSO first for configuration tuning, then ACO for graph path search, then GWO/WOA as comparison methods.
- Implement Fuzzy-GA, GA-PSO, and a small neuro-fuzzy model only after single-method baselines exist. Add feedback storage and offline promotion/rollback rather than changing live weights from one click.
- Compare algorithms under equal evaluation budgets and report convergence, best fitness, variance across seeds, latency, and constraint violations.

### Done when

Each algorithm performs genuine objective evaluations, satisfies constraints, produces reproducible traces, and has a measured comparison with the baseline. The UI displays actual run data rather than generated curves.

## Milestone 7 — production release

Local implementation complete: scoped accounts/sessions, request limits, isolated databases, readiness/log metadata, online backup/verified new-location restore, pinned container and CI configuration, restart/auth/isolation tests and a 60-request concurrency probe. The public release gate below is **not passed**; see OPERATIONS.md for explicit remaining requirements.

- Choose and provision the production database/index and backend host from measured capacity needs; configure frontend and backend origins, secrets, and migrations.
- Add authentication/authorization where write access is public, upload and request limits, URL-fetch protections, structured logs, health/readiness checks, backups, CI, and rollback.
- Run contract, end-to-end, accessibility, load, failure, and live deployment smoke tests. Profile retrieval/indexing and graph rendering against the intended corpus size.
- Replace hard-coded home metrics and simulated benchmark values only with versioned measured artifacts. Update README, API docs, and syllabus status to distinguish implemented features from conceptual demonstrations.

### Release gate

The complete deployed workflow passes with real data; evidence and versions are inspectable; quality meets thresholds set before final testing; provider quota exhaustion has a usable fallback; data survives restart; and the deployment has monitoring and rollback.

## Decisions to settle as implementation reaches them

1. Initial document corpus and permission to use/share it.
2. Annotation budget and who will review gold labels.
3. Whether the deployed system is public, private, or single-user.
4. Persistent graph and vector storage after the reference implementation is measured.
5. OpenRouter model choice and daily query budget based on current account limits and our quality tests.

## Current external-service notes

- Free Colab compute is suitable for offline notebooks but availability and runtime limits change: https://research.google.com/colaboratory/faq.html
- Kaggle notebooks offer limited free accelerator use; check the current account quota before a run: https://www.kaggle.com/docs/notebooks
- OpenRouter lists a limited free allowance and warns that free models have low rate limits. Treat it as a development or low-volume provider, with a fallback: https://openrouter.ai/pricing and https://openrouter.ai/support/
