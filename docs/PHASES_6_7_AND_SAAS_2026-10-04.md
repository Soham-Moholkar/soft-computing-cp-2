# Remaining phases and SaaS verification

The implementation now has genuine optimizer experiments and local release
operations, followed by three switchable product dashboards. This completes the
authorized local implementation. It does not establish a public production release.

## What changed

- GA, PSO, GWO, WOA, Fuzzy-GA and GA→PSO perform recorded objective evaluations,
  obey a bounded evaluation budget and export candidate artifacts. Seeded ACO
  traverses stored graph edges with evolved pheromone and chunk provenance.
- An experimental fixed-membership Sugeno network learns nine consequents from
  train-only preferences. Real-data runs use 775 pairs. It is not a full ANFIS
  implementation or a live-loadable linear ranking artifact.
- API laboratories and benchmark pages read saved backend records. Changing an
  experiment selector does not relabel a prior result: the result explicitly shows
  its recorded algorithm, dataset, seed and budget. Reopening restores those controls.
- Workspace memberships, reader/editor roles, signed sessions, private response
  headers, bounded body/rate checks, readiness and structured request log events
  support a single-instance deployment. Existing course endpoints remain available.
- Online SQLite backups preserve committed WAL data; restore verifies checksums
  and writes only to new destinations. Container dependencies and CI are pinned.
- Personal and engineering profiles extend the fixed ontology, source extraction
  and query canonicalization consistently. Databases remain separate; colliding
  configured paths fail before opening any file.
- Atlas Vault presents notes and connections; Relay Operations presents runbooks
  and document readiness; Soft Computing Studio presents revision trails. They
  share a working source reader, graph, cited search and saved preferences.
- Imports accept real text/PDF/CSV/JSON or Markdown as plain source text. Each
  theoretical pack is explicitly requested and idempotent. Source originals and
  historical query snapshots are preserved.

## Measured evidence

The real SQuAD candidate-bank comparison uses six searches, three seeds and
64 actual fitness calls per seed. All searches tie baseline NDCG 0.94184. The
separate neuro-fuzzy fits perform worse on validation. No model is promoted.

The harder synthetic comparison shows mean NDCG 0.95833 for GA→PSO versus
0.87500 baseline. Its small source-family count and fixed shortlist make this a
diagnostic result. The synthetic train bank lacks sufficient preference pairs
for neuro-fuzzy fitting; the API rejects that configuration before enqueuing.

The concurrency artifact `backend/evaluation/runs/workspace-load-all-queries-v3.json`
covers 60 warm requests with four clients over all nine case questions. It records
zero failures and 60 evidence responses, p50 56.8 ms and p95 81.8 ms. These are
in-process local measurements on four small sources per case, with providers off.
They do not replace the previous diverse-corpus latency audit or a deployed SLA test.

The full backend suite passed 101 tests; later targeted checks also pass, including
the added collision regression. Frontend tests pass 36 cases. Lint, types and
API-mode build pass. Browser checks verified three source packs, cited retrieval,
source reopening, review exclusion, settings persistence, GA, ACO, neuro-fuzzy and
actual benchmark reports. The course database retained its four prior sources and
received four additional theoretical examples. Actual local backups restored these
counts into new files: Atlas 4 sources/7 relations; Relay 4/8; Course 8/10.

## Product scope and release gates

These are production-style local workspaces, not completed vault/Git/LMS connectors.
Atlas borrows the navigation idea from [Obsidian graph view](https://obsidian.md/help/plugins/graph)
and [backlinks](https://obsidian.md/help/plugins/backlinks), while storing concepts
and text-supported assertions rather than a compatible note backlink index.

Public HTTPS hosting/secrets, isolated hostile PDF parsing, deployment-scale load,
scheduled backups/monitoring and reviewed course gold remain required. Distributed
worker coordination is required before scaling beyond one backend instance.
The frozen test partition remains unopened. See OPERATIONS.md and OPTIMIZATION.md.

Snapshots: `docs/screenshots/atlas-vault.jpg` and the compact viewport preview.
The React best-practices skill was applied to loading, derived state, request
cancellation, workspace remounts and accessible controls. No cloud deployment,
paid provider request, external message or production model activation occurred.
