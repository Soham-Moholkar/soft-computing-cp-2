# Application environments and SaaS use cases

The root dashboard switches between six isolated local workspaces.
Every number is read from that workspace's SQLite database. The examples describe
possible uses; they are not evidence of production customer outcomes. A fresh
workspace is empty until a user imports a source or loads its example pack.

| Workspace | User and task | Dashboard emphasis | Potential integration |
|---|---|---|---|
| Care Evidence | A coordinator traces fictional care handoffs, referrals and procedure-review records | Rose care desk, three scenario views, short evidence paths and evidence-first ranking | De-identified file/paste imports work; EHR connectivity is not enabled |
| Field Atlas | A planner connects fictional field observations, crop schedules and water records | Green field desk, water/crop/season scenarios and context-weighted ranking | Structured/text imports work; sensor feeds and farm-system sync are future work |
| Ledger Intelligence | An analyst traces fictional exposure files, treasury policies and audit controls | Indigo control desk, three evidence scenarios and lexical-heavy ranking | File/paste imports work; accounting and market-feed connectors are future work |
| Atlas Vault | A researcher connects reading, daily notes and Project Atlas | Source shelf, concept connections, uncertain ideas, cited note search | Markdown import works; vault synchronization is future work |
| Relay Operations | An engineer traces a payments runbook, queue dependency and release checklist | Document processing readiness, runbook list, dependency graph and cited investigation | File/paste ingestion works; Git, incident and ticket connectors are future work |
| Soft Computing Studio | A student revises algorithms and compares retrieval evidence | Revision trails, course library, concept map and measured experiment links | File/paste/PDF ingestion works; LMS synchronization is future work |

Atlas is inspired by [Obsidian graph navigation](https://obsidian.md/help/plugins/graph)
and [backlinks](https://obsidian.md/help/plugins/backlinks). Its implementation is
a concept-and-assertion graph, not a compatible Obsidian plugin or a file backlink
index. Markdown imports preserve text; wiki-link text alone does not become a
verified assertion. Unknown names require ontology/extractor expansion.

## Demonstration walkthrough

1. Start the backend and API-mode frontend following README.md. Open `/`.
2. Choose Atlas Vault and click **Load example pack**. Inspect four stored notes,
   seven accepted relations and one uncertain relation candidate. Ask how Research
   Notes support Project Atlas; open the citation to inspect the source text.
3. Choose Relay Operations. Its collection is separate. Load its examples and ask
   how Payments API is related to Queue Worker. The dashboard shows document
   readiness, not live service telemetry or actual incident counts.
4. Choose Soft Computing Studio. Existing course sources remain present. Example
   sources are appended idempotently. Explore the PSO ranking-weight question and
   follow the source into the course graph. Open measured experiments separately.
5. Change retrieval mode, top K, maximum hops or source shelf layout under Settings.
   Save defaults, reload and verify they survive. Changes are scoped to the workspace
   and do not promote a trained ranking artifact. Individual search mode changes
   are temporary until saved. Search history stores the versions used at the time.

Sources accept Markdown (up to 100 KB through paste ingestion), TXT, PDF, CSV and
JSON. Paste creates an immutable source; editing and resubmitting creates a new
document identity rather than silently replacing original evidence. Connect unbuilt
sources in batches of at most twenty. Source readers show up to one hundred chunks;
full chunk paging remains available through the API. The graph preview shows at
most one hundred concepts and their returned edges. The course laboratory graph
supports full paginated loading. Tentative candidates can be inspected, but there
is no manual edge approval workflow yet.

Readers can search and inspect allowed workspaces. Editors also import, build and
save defaults. Production authentication and memberships are enforced on the
backend, not by hiding buttons. Workspace switches unmount local state and cancel
outstanding UI requests; accepted backend jobs continue in their original workspace.
The old laboratory routes always address the course workspace and are labeled as
course laboratories. They do not silently follow the root dashboard selection.

This is a production-style local product example, not a deployed commercial SaaS:
public hosting, identity-provider integration, billing, dynamic tenant provisioning,
vault/Git/LMS sync and distributed workers are not implemented. See OPERATIONS.md
for the public release gates and OPTIMIZATION.md for measured model limitations.

## Domain profiles added 4 October 2026

Each application environment has three selectable workflows, separate source ingestion, graph, query history and persisted preferences. New healthcare, agriculture and finance ontologies recognize eight domain concepts each and do not inherit the course algorithm vocabulary. Engineering preserves its existing ontology and user data. Switching environments clears transient search/source state and cancels outgoing requests. The fixed workspace registry is checked by the proxy, API client and backend memberships.

| Environment | Profile | Lexical / graph / fuzzy | Default passages / hops |
|---|---|---|---|
| Healthcare | Evidence first | 65 / 20 / 15% | 4 / 2 |
| Agriculture | Context explorer | 45 / 25 / 30% | 6 / 3 |
| Engineering | Dependency tracer | 45 / 40 / 15% | 5 / 4 |
| Finance | Audit precision | 70 / 20 / 10% | 4 / 2 |

Profiles are versioned heuristic configurations, not fine-tuned learned models or calibrated risk/clinical confidence. They apply only to hybrid ranking; other modes retain their documented weights. A promoted course artifact takes precedence in the course environment only. Preferences let editors choose the domain profile or balanced baseline, restore domain defaults, and adjust mode, top K, hops and source layout. Existing saved preferences are preserved with balanced ranking until the user chooses a profile. Saved results retain the configuration used at execution, so changes do not rewrite historical scores. Course optimizer/evaluation jobs run only in the course environment; course feature banks are not presented as evidence of specialist-domain training.

All domain examples are fictional operational documentation. The implementations do not diagnose, prescribe, predict yields or returns, issue investment recommendations or consume live clinical, sensor or market records. There are no real patient or account identities in the example packs. Scenario coverage and supported-connection counts are computed from the stored graph preview, not fabricated business KPIs.
