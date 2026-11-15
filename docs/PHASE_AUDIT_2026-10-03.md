# Phase audit and validation review — 2026-10-03

The local ingestion → graph build → retrieval → explanation workflow remains
functional. The audit corrected five implementation issues and inconsistent
phase documentation. It also completed a real-data ranker experiment, which
**does not justify production promotion**. Model choice alone cannot establish
correctness; the failures below were checked against code and measurable behavior.

## Assistant model and effort history

Local metadata for this chat records **GPT-6.1-sol, low effort** for the completed
Milestone 4 turn, the initial Milestone 5 turn and the subsequent interrupted
training turn. The current audit turn records **GPT-6.1-sol, high effort**. This
confirms a setting change, not a model-name change. Metadata for the original
Milestones 1–3 is not established by this chat's four turn-context records. There
is no evidence here of the exact different model/setting the user originally
intended; no app model preference was changed during the audit.

The assistant model is separate from SoftGraph's retrieval components. Active
local retrieval uses BM25, the course ontology and fixed fuzzy rules. OpenRouter
is optional, query-opt-in evidence reranking, and was disabled in all experiments.
The experimental linear ranker is a separate JSON artifact, not an LLM.

## Findings and fixes

| Phase | Finding | Resolution / remaining limit |
|---|---|---|
| 1: ingestion | Word-sized chunks could pass ingestion while exceeding retrieval's character/sentence caps; one such completed source could prevent queries over the entire corpus. | One shared chunk policy now rejects it during ingestion, before storing searchable chunks. A regression verifies existing good sources remain queryable. |
| 2: graph | The 32-concept extractor is narrower than the architecture's general NER/fuzzy-confidence design. It misses unknown concepts/complex predicates and has a generic-word false positive in the authored gold. | Documented as a lexical baseline; negation, exact spans, transactional preview/rebuild, aliases, shared-source removal and persistent paths remain covered by regressions. Gold labels were not rewritten to match predictions. General extraction still requires reviewed data and a measured candidate. |
| 3: retrieval | Health returned static index/configuration identifiers even after corpus/model changes. | Health now reads actual source/graph versions and the default hybrid artifact status without building the index. Saved query results keep their own versions. |
| 3/5: learned ranking | Candidate shortlisting used only lexical/graph weights, ignoring learned term coverage. A coverage-dominant model could drop its best evidence before scoring. | Shortlisting includes the learned coverage weight. A regression caps the shortlist to one and verifies full-coverage evidence survives. Fuzzy contributions still apply at the bounded reranking stage, so candidate recall remains a measured limitation. |
| 3: provider settings | Saved results identified provider status without recording the requested model/settings. | New snapshots and saved explanations record requested model, temperature, token limit and deadline, excluding secrets. Changing current settings does not rewrite an old explanation. Router IDs do not prove the actual routed model. |
| 4: integration/docs | Several documents still called frontend integration pending or presented target embeddings/Neo4j/optimizer flows as current behavior. | Canonical status, API contracts, setup, architecture and algorithm proposals now distinguish active features, rejected experiments and plans. Mock optimizer/benchmark data remains labeled. |
| 5: evaluation | Tiny correlated synthetic fixtures gave optimistic ranking results and query-level bootstrap intervals. | Harder queries, shingle/fact audits, source/query-family checks and 2,000 connected-family cluster resamples. Intervals withheld below five independent clusters; citation provenance is separate from entailment. |
| 5: promotion | Aggregates and family/query coverage could be inconsistent with records while appearing to satisfy gates. | Gates re-derive quality/latency summaries, reject duplicate/omitted IDs and missing samples, match query labels/clusters to the manifest, and require matched frozen reports. Tests exercise invented outcomes, missing samples and artificial families. |

## Refreshed validation results

All rows below use hybrid retrieval with K=3. The real diagnostic split contains
96 human-authored questions over 48 paragraphs from 8 held-out article families.
It is a retrieval adaptation of [SQuAD 2.0](https://rajpurkar.github.io/SQuAD-explorer/),
with [data attribution and adaptation limits](../backend/evaluation/ATTRIBUTION.md).
Local train/validation/test families are 14/8/8. The adaptation is general
Wikipedia data, with unreviewed pooled relevance and no corpus-wide no-answer
labels; it is not an independently reviewed course benchmark. Missing extraction
gold produces null extraction scores. Test metric evaluation remains unopened.

| Collection / model | Answerable questions | Connected families | MRR@3 | Family 95% MRR interval | NDCG@3 | Relevant non-abstaining response | Warm p95 ms |
|---|---:|---:|---:|---|---:|---:|---:|
| Hard synthetic / default | 12 | 3 | 0.861 | withheld: <5 families | 0.875 | 58.3% | 7.5 |
| Real validation / default | 96 | 8 | 0.929 | [0.887, 0.969] | 0.942 | 21.9% | 15.1 |
| Real validation / trained candidate | 96 | 8 | 0.929 | [0.887, 0.969] | 0.942 | 21.9% | 13.0 |

Hard synthetic validation also includes six no-answer queries. One cross-split
shared factual sentence requires review; three connected answerable families do
not support an interval. High MRR with low response coverage is a key negative
finding: matching/ranking a passage does not mean the strict excerpt/path gate
can return a usable answer. Simply dropping the gate would not establish safety
or answer correctness. Review representative abstentions and measure a query or
embedding change on training/validation, alongside independent no-answer cases.

The real candidate trained on **775 train-only pairs**,
using projected pairwise logistic loss and four simplex weights. Its lexical,
graph, fuzzy and coverage weights are `[0.8643129510928168, 0.0, 0.0, 0.13568704890718314]`. Wikipedia topics
supply little course-graph signal; zero learned graph/fuzzy weights here do not
prove those components are useless for course retrieval. Unjudged candidates
are provisional negatives, so independent relevance pooling is required.

Paired validation NDCG gain is **0.000**, family-bootstrap 95% interval
**[0.000, 0.000]**. Both runs have zero failures and citation integrity 1, but
only 21/96 answerable questions receive a relevant non-abstaining response.
The model is retained as a candidate and its promotion decision is rejected:

- Candidate training domain does not match the production course domain
- Missing frozen test baseline/candidate comparison
- validation annotations/adaptation have not been independently reviewed
- validation evaluation domain is not the production course domain
- validation gate failed: answerability_accuracy=0.21875, min=0.9
- validation gate failed: false_evidence_rate_on_no_answer=None, max=0.05
- validation gate failed: no_answer_queries=0, min=20
- validation paired family-cluster NDCG gain is not established
- validation relevant non-abstaining response coverage is below target
- Dataset manifest does not provide matching, independently reviewed course-domain evidence

This is a quality-policy rejection, not a tool permission rejection. No candidate
was installed live. Live JSON loading requires a promoted course-domain artifact;
invalid/unpromoted artifacts fall back explicitly. Unset `SOFTGRAPH_RANKER_ARTIFACT`
and restart to roll back. Integrity hashes protect against accidental changes,
not a malicious operator rewriting trusted local evidence.

## Latency

Exact Mamdani centroids now reuse fixed output curves and repeated input scores;
only the displayed top candidate constructs a full fuzzy trace. Source sentence
spans/terms are cached with the versioned corpus. Boundary and randomized tests
confirm score equality with full inference and preserve exact excerpts.

The same 120-document synthetic stress fixture recorded warm p95
**293.0 ms before**, **52.5 ms in the first fully optimized run**,
and **17.1 ms after this audit** (warm p50 15.8 ms,
one cold request 39.0 ms). Runs occur at different times on this
host; contention/cache state varies, so the values are observed local samples,
not a guaranteed speedup or deployed service SLA. The fixture has 20 warm
requests, no provider, no graph builds and no concurrent production workload.
A release still needs repeated load measurements at the intended corpus size.

## Evidence and reproducibility

- [Real train baseline](../backend/evaluation/runs/squad-train-baseline-v3/report.md)
- [Real validation baseline](../backend/evaluation/runs/squad-validation-baseline-v3/report.md)
- [Real validation candidate](../backend/evaluation/runs/squad-validation-candidate-v3/report.md)
- [Hard synthetic validation](../backend/evaluation/runs/synthetic-hard-validation-v3/report.md)
- [Candidate artifact](../backend/evaluation/models/squad-linear-candidate-v3.json)
- [Promotion decision](../backend/evaluation/models/squad-candidate-v3-promotion-decision.json)
- [Latency before](../backend/evaluation/runs/latency-diverse-before.json) / [audited latency](../backend/evaluation/runs/latency-audited-v3.json)
- [Commands, thresholds and rollback](../backend/evaluation/README.md)

Real dataset SHA-256: `9270d32c8de9313e8660a4f02d99fcd01b7d3862762d500c7bf2f68da1f7d7ee`.

Matched backend SHA-256: `4ccb56f62ff372b3fa57d6541267a8f012f29af9ee556089e032c55996154843`.

Candidate checksum: `5a0173e0b1d7de5b1f838b91fdaf1b3164ff20d601f41756c53410720a73ca92`.

Earlier v1/v2 reports are preserved with their original hashes and definitions;
they are not overwritten or relabeled as current. The current model trained and
both validation runs share code/data hashes. Provider use is false and live
application storage is never opened by the evaluator.

## Verification and remaining work

**89 backend tests, 32 frontend tests, lint and TypeScript checking pass.** Tests
cover durable sources/restart, URL guards, exact graph spans and mutation rollback,
source removal, paths, evidence/provenance, provider quotas/timeouts/cache,
score/trace equivalence, artifact rejection/loading/rollback and the audit cases.
This turn used isolated API and contract tests; earlier browser/process-restart
checks are recorded in the roadmap, and were not represented as freshly rerun.

Milestones 1–4 provide the local working baseline. Milestone 5 has real training
and promotion machinery, but still lacks a selected production-quality model.
The next quality work is an independently reviewed course corpus with pooled
relevance, independent no-answer examples and source entailment review, followed
by a justified query/ranker/embedding candidate and frozen final comparison.
Optimizer implementation can use diagnostics, but must not promote configurations
from these synthetic/general-domain scores as production fitness.

Production operations are still separate work: authentication/authorization,
distributed worker leases (the current service runs one process with two threads),
backup/migration/monitoring, full document-parser resource isolation, total URL
fetch deadlines including DNS/slow responses, and deployed load/end-to-end tests.
These are explicit release limits, not silently completed by passing unit tests.
