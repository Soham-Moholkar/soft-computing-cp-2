# Domain environments and contemporary frontend — 4 October 2026

Four primary application environments now provide working knowledge retrieval:
Care Evidence (healthcare operations), Field Atlas (agriculture planning), Relay
Operations (engineering knowledge) and Ledger Intelligence (finance controls).
Atlas Vault and Soft Computing Studio remain available. Existing sources and
preferences are preserved.

Each environment has its own database, ingestion queue, graph, search history and
persisted settings. Healthcare, agriculture and finance each recognize eight
domain concepts without importing the course vocabulary. Engineering retains its
existing ontology. Workspace memberships apply to all mounted endpoints and
legacy course routes. Course feature-bank optimization runs only in the course
laboratory; those models are not presented as specialist-domain models.

Each primary dashboard offers three selectable scenarios. Scenario views change
the explanation, concept coverage, connection preview and suggested evidence
search. They are views within one domain, not additional tenants. Numbers and
graph edges come from actual stored records; no live business KPIs are invented.

| Environment | Domain profile | Lexical / graph / fuzzy | Default passages / hops |
|---|---|---|---|
| Healthcare | Evidence first | 65 / 20 / 15% | 4 / 2 |
| Agriculture | Context explorer | 45 / 25 / 30% | 6 / 3 |
| Engineering | Dependency tracer | 45 / 40 / 15% | 5 / 4 |
| Finance | Audit precision | 70 / 20 / 10% | 4 / 2 |

Profiles affect actual hybrid ranking and record their version in saved results.
Other retrieval modes keep their existing weights. A promoted course ranker takes
precedence only in the course environment. Editors can select the domain profile
or balanced baseline, restore defaults and independently save passage count, mode,
hops and shelf layout. Older saved settings default to balanced ranking until a
profile is selected. The engineering demonstration now selects Dependency tracer
while preserving its existing three-passage/three-hop/list settings.

The contemporary frontend uses compact product navigation, a narrower dark sidebar,
domain-colored environment selectors, refined typography, rounded section tabs,
smaller count cards, a focused source-entry dialog and a clickable stored-graph preview. Healthcare, agriculture,
engineering and finance have distinct rose, green, cyan and indigo treatments.
Course navigation is separated into the research laboratory. Environment changes
clear transient source/search state and cancel outgoing UI requests.

Validation: 107 backend tests passed for the domain expansion. After the final
frontend refinement, all 36 frontend tests, lint, type checking and the production
build passed. The new domain
tests exercise all fixture questions, applied profile weights, balanced fallback,
profile persistence across restart, source/result isolation and restricted reader
memberships. Browser checks cover example ingestion, scenario switching, cited
answers, original source inspection and saved settings. The final browser check
also verified Escape dismissal/focus return in the source dialog and navigation
from the network preview into the actual stored graph. The final preview is
`docs/screenshots/contemporary-healthcare.png`.

`backend/evaluation/runs/domain-environments-load-v1.json` covers all six
environments and all 18 suggested questions: 60 requests, four concurrent clients,
zero failures and 60 evidence responses; warm in-process p50 22.5 ms and p95
47.2 ms. This small fixture check is not a production SLA or domain-quality study.

All example records are fictional operational documentation. No specialist learned
model has been fine-tuned or promoted; profile weights are versioned heuristics.
Clinical diagnosis, prescribing, pest diagnosis, yield/return forecasting, risk
ratings and investment advice are not implemented. EHR, sensor, market, accounting,
Git and identity-provider integrations are not enabled. Reviewed domain data and
held-out evaluation are required before specialist model promotion. Public hosting,
distributed workers and public-upload parser isolation remain the release gates in
OPERATIONS.md.
