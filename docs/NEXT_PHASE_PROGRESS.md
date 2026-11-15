# Remaining phases and SaaS workspaces

User order: complete remaining implementation phases, then create at least two
theoretical SaaS dashboards/use cases including a personal knowledge workspace.

1. Milestone 6: actual bounded GA/PSO/GWO/WOA and hybrid searches on captured
   validation features, ACO over stored graph edges, a train-only small neuro-fuzzy
   experiment, equal-budget multi-seed comparison and real API/UI run records.
2. Milestone 7: authentication and workspace authorization, request limits,
   readiness/logging, database backup/restore, pinned deployment/CI configuration,
   failure/load/persistence verification. Deployment and reviewed-corpus model
   promotion remain external release gates; do not claim either happened.
3. SaaS examples: isolated personal knowledge, engineering operations and course
   workspaces; explicit sample provisioning; switchable dashboards with live
   source/graph/query metrics, evidence search and useful per-case settings.

No existing live sources are overwritten. Synthetic case studies remain labeled.
No unreviewed candidate is enabled for production ranking. Existing laboratory
mock mode remains available as educational reference.

Status: remaining local implementation phases and all three SaaS dashboards are
implemented and verified. Public release and model promotion are not complete.

Verification: the full backend suite passed 101 tests before the final refinements;
targeted graph/ingestion/optimizer/platform checks then passed, including a new
database-path collision test. Frontend tests pass 36 cases, with lint, type checking
and an API-mode production build. Browser checks cover all three example packs,
citations, uncertain-relation inspection, per-workspace settings surviving reload,
GA jobs, ACO over real edges, neuro-fuzzy training and measured benchmark reports.

`workspace-load-all-queries-v3.json` records 60 requests across all nine suggested
questions with four concurrent clients: zero failures, 60 evidence responses,
local warm p95 81.8 ms. This small in-process probe is not a production SLA.

Online backups and verified restores of the actual local workspace databases are
stored under ignored `backend/.local/backups/2026-10-04` and
`backend/.local/restore-check/2026-10-04`. Restored sources, graph counts, settings
and saved queries remain inspectable without replacing the live files.

See OPTIMIZATION.md for negative real-data results, OPERATIONS.md for hosting/parser/
load/monitoring release gates, and SAAS_USE_CASES.md for walkthroughs and integration
boundaries. The earlier PHASE_AUDIT_2026-10-03.md remains a historical audit of
Milestones 1–5; its optimizer/operations status has been superseded by this work.

## Application environment expansion — 4 October 2026

Healthcare operations, agriculture planning and finance controls now join engineering as four primary domain environments. Personal and course environments remain accessible. Three scenario views per application, custom ontologies, versioned retrieval profiles, isolated settings and distinct visual themes are implemented. See SAAS_USE_CASES.md and DOMAIN_ENVIRONMENTS_2026-10-04.md for scope and validation. The earlier three-dashboard status describes the preceding milestone.
