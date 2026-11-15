# Offline evaluation and candidate training

Milestone 5 includes leakage auditing, family bootstrap intervals, harder
synthetic queries, real-data ranker training, promotion gates and artifact
loading/rollback. **No model has passed production promotion.** Test metrics
remain unevaluated. See [phase audit](../../docs/PHASE_AUDIT_2026-10-03.md).

## Collections

| Collection | Sources / queries | Purpose and limits |
|---|---:|---|
| `synthetic-course-v1.json` | 14 / 23 | Original unreviewed extraction/retrieval fixtures. Historical reports retain their earlier schema/code hash. |
| `synthetic-course-v2.json` | 14 / 35 | Adds paraphrases and unsupported guarantee/cost/latency questions. One cross-split shared fact requires review. |
| `squad2-retrieval-v1.json` | 180 / 359 | Human-authored SQuAD 2.0 passages/questions in 30 article families; general Wikipedia retrieval diagnostics. |

See [attribution and adaptation](ATTRIBUTION.md). The real collection uses 14
train, 8 validation and 8 test article families. Human answer spans identify the
gold paragraph. Other relevant paragraphs may be unjudged; pooled relevance has
not been independently reviewed. Upstream passage-scoped unanswerable questions
are excluded because they cannot establish corpus-wide unanswerability. This is
not course-domain or extraction gold. Real extraction scores and no-answer rates
are unavailable, not artificially zero or perfect. Local partitions are not
an official SQuAD evaluation.

## Reproduce a baseline and candidate

Run from `backend/` with Python 3.12 and the backend dependencies. Use new output
names; existing artifacts are preserved.

```powershell
py -m app.evaluation.run --dataset evaluation/synthetic-course-v2.json --split validation --output evaluation/runs/my-hard-validation
py -m app.evaluation.run --dataset evaluation/squad2-retrieval-v1.json --split train --capture-features --output evaluation/runs/my-real-train
py -m app.evaluation.train_ranker --report evaluation/runs/my-real-train/report.json --output evaluation/models/my-candidate.json
py -m app.evaluation.run --dataset evaluation/squad2-retrieval-v1.json --split validation --output evaluation/runs/my-real-validation-baseline
py -m app.evaluation.run --dataset evaluation/squad2-retrieval-v1.json --split validation --ranker evaluation/models/my-candidate.json --output evaluation/runs/my-real-validation-candidate
py -m app.evaluation.promote --dataset evaluation/squad2-retrieval-v1.json --artifact evaluation/models/my-candidate.json --validation-baseline evaluation/runs/my-real-validation-baseline/report.json --validation-candidate evaluation/runs/my-real-validation-candidate/report.json --decision evaluation/models/my-decision.json
```

The last command writes a rejection for this diagnostic corpus: domain,
adaptation review, global no-answer labels, improvement and final-test evidence
do not satisfy the production course policy. Rejection is an experiment result.
Do not unlock test metrics for an already ineligible candidate.

If regenerating the deterministic real-data adaptation, save official raw input
at `evaluation/raw/squad-dev-v2.0.json` (URL/hash in attribution), then run:

```powershell
py -m app.evaluation.prepare_squad --raw evaluation/raw/squad-dev-v2.0.json --output evaluation/my-squad-adaptation.json
```

The pairwise logistic ranker fits four nonnegative weights summing to one:
lexical, graph, fuzzy and term coverage. It uses train-only positive versus
unjudged hard-negative features, a fixed seed, 300 projected-gradient steps and
L2 regularization toward default weights. This is a small linear model; it does
not train embeddings or an extractor. Unjudged negatives remain provisional.

## Isolation and reproducibility

Each run creates a temporary SQLite database and ingests only its selected
partition. It never opens the live database, calls providers or requires a
server/key. Sources use 400-word chunks with no overlap; default K is 3, graph
hops 4 and extraction thresholds unchanged. Modes/queries use a seeded shuffled
schedule. Three repeated warm requests per query are timed separately from metric
analysis; initial requests and cold index building are recorded separately.
Percentiles include in-process API overhead and snapshot writes. They are not
deployed network or concurrent-load guarantees.

Reports save canonical dataset and full backend-code hashes, seed, Python/platform,
per-query records, versions and dependency snapshots. `requirements.txt` pins six
direct dependencies; `environment-requirements.txt` pins the installed environment
excluding this local package, including potentially unrelated/platform-specific
packages. Recreate the same Python/platform or curate a minimal reviewed evaluation
environment. Data/code changes invalidate comparisons with old hashes; historical
reports retain their recorded implementation. Timing, result IDs and temp paths
are not deterministic reproducibility targets.

## Leakage and statistics

Split by source family before writing queries. Variants, translations and
paraphrases stay together. Validation rejects duplicate IDs/text across splits,
reused source/query families, cross-split judgments, invalid spans and lexical
near duplicates using 5-word shingles. Shared factual sentences are flagged for
review. Lexical auditing cannot exclude semantic leakage; manual review remains
necessary. Review flags and license strings are not proof of review/rights.

Bootstrap uses **2,000 whole connected source-family cluster resamples**, seed
1729, with a query-weighted mean. Questions sharing any source family, including
multi-source questions, stay correlated. Fewer than five independent clusters
withholds the interval. Even eight clusters have limited inferential strength.
Paired promotion comparisons bootstrap per-query NDCG differences with the same
families, not separate independent intervals for the two models.

## Metrics and promotion

Extraction matches exact accepted mention spans/canonical names and directed
source-level relation triples; resolution includes missed gold mentions.
Retrieval uses chunk IDs matched by exact gold excerpts, maximum grade for
overlaps, K as precision denominator and answerable queries only. Evidence is
ranked even during abstention. Report response coverage and no-answer errors
separately: ranking accuracy does not establish usable answer coverage or
entailment. Citation integrity verifies stored text/provenance/numbering.
Scores remain uncalibrated; no Brier score is fabricated.

Promotion requires an independently reviewed matching course-domain manifest,
exact validation and explicitly unlocked frozen test baseline/candidate reports,
at least 30 answerable and 20 no-answer queries per split, five independent
families, NDCG gain >= .01 with a strictly positive paired 95% lower bound,
answerability and relevant response coverage >= .9, false evidence rate <= .05,
zero failures, citation integrity 1, and warm p95 <= 150 ms. Gates live in
`app/evaluation/promote.py`. Reports must match hashes, seed, K, environment and
latency protocol. Duplicate/omitted queries, invented family clusters, missing
samples and inconsistent aggregate outcomes reject promotion.

For an eligible final comparison only, evaluate both frozen models using
`--split test --unlock-test`, and provide `--test-baseline`, `--test-candidate`
and `--promoted-output` to promotion. This is a procedural local gate, not
cryptographic access control. After inspecting test metrics, new tuning needs a
new locked test collection.

Live loading requires a checksummed, promoted course-domain JSON artifact via
`SOFTGRAPH_RANKER_ARTIFACT`. Candidates load only explicitly in offline evaluation.
Invalid/unpromoted artifacts fall back to default ranking with warnings and a
health status. Loading never changes abstention rules. Roll back by unsetting
that variable and restarting. Saved results retain their original configuration
versions. Hashes detect accidental changes, not a malicious trusted operator
rewriting an artifact and its evidence.

`py -m app.evaluation.latency --output evaluation/runs/my-latency.json` runs a
separate stress fixture of 120 varied synthetic sources, one cold query and 20
warm queries. Compare matching fixtures on the same machine; this is not
production load. Frontend benchmark and optimizer demonstrations remain simulated.
