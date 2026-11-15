# Evaluation Plan

## Scientific rule

Pass-1 values are simulated interface data. Replace them only with results from versioned datasets and reproducible scripts.

## Implemented evaluation and candidate training (2026-10-03)

See [evaluation instructions](../backend/evaluation/README.md), [annotation guidelines](../backend/evaluation/ANNOTATION_GUIDELINES.md) and [phase audit](PHASE_AUDIT_2026-10-03.md). There are original and harder synthetic collections and a real SQuAD retrieval adaptation. Evaluations isolate source partitions in temporary SQLite, disable providers and preserve data/code/environment hashes and per-query outcomes. Training uses only captured training-partition features. No candidate has passed production promotion; final test metrics remain locked.

Ranking averages answerable queries even when the response abstains. Relevant non-abstaining response coverage and no-answer errors are separate gates. Precision uses K; undefined denominators and absent extraction gold are unavailable. Scores are not calibrated probabilities. Citation integrity checks provenance rather than entailment.

Confidence intervals use 2,000 whole connected source-family cluster resamples with a fixed seed, withheld below five independent clusters. Model gain uses paired family-cluster differences. Shared factual sentences require review; lexical near-duplicate auditing cannot exclude semantic leakage. Latency uses seeded shuffled query/mode order, repeated warm API requests and separate cold build timing; no deployed latency claim follows.

Promotion checks independently reviewed course-domain data, matching validation/frozen test reports, minimum positive/negative counts, quality gain, abstention/citation/failure and latency thresholds. It re-derives aggregate outcomes, rejects missing/duplicate queries and checks family labels against the manifest. The general-Wikipedia candidate is rejected, preserving the negative result. Review, corpus-wide no-answer cases, course-domain selection, final test and deployment evaluation remain pending. Frontend simulated benchmarks stay labeled.

## Dataset splits

- Split by source family before development, with variants/paraphrases together and query/source near-duplicate review.
- Entity and relation gold sets annotated with guidelines.
- Retrieval queries include single-hop, multi-hop, ambiguous and no-answer cases.
- Use fixed train, validation and test partitions plus recorded random seeds.

## Metrics

Retrieval:

- Precision@K, Recall@K, F1, MRR and NDCG
- answer support and evidence coverage
- p50, p95 latency and failure rate

Graph construction:

- entity extraction precision and recall
- relation extraction precision and recall
- entity-resolution accuracy
- graph density, coherence and noise ratio
- provenance completeness

Optimization:

- best fitness, area under convergence curve and iterations to target
- execution time and evaluation count
- population or swarm diversity
- constraint violations
- Pareto hypervolume and spread

Fuzzy system:

- calibration error and Brier score
- rule coverage and average rule count per decision
- score stability under small input changes

## Ablations

Compare hard baseline, fuzzy-only, GA-optimized, PSO-optimized, ACO traversal, GWO/WOA alternatives and full hybrid. Use equal search budgets where algorithms are compared.

## Reporting

Report mean, standard deviation, confidence intervals, seed count, hardware, software version and dataset version. Include negative results. Never relabel demo values as experimental.
