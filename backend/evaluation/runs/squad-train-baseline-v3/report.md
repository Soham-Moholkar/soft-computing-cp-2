# SoftGraph offline baseline evaluation

Dataset: `squad2-retrieval-adaptation-v1` · `upstream_human_annotated` · split `train`

Dataset SHA-256: `9270d32c8de9313e8660a4f02d99fcd01b7d3862762d500c7bf2f68da1f7d7ee`
Backend code SHA-256: `4ccb56f62ff372b3fa57d6541267a8f012f29af9ee556089e032c55996154843`

Sources: 84; K: 3; seed: 1729. No provider calls. Ranker: default baseline.

| Mode | P@K | R@K | MRR@K | NDCG@K | Answerability | No-answer abstention | Failures |
|---|---:|---:|---:|---:|---:|---:|---:|
| lexical | 0.317 | 0.952 | 0.911 | 0.921 | 0.345 | n/a | 0.000 |
| graph | 0.317 | 0.952 | 0.911 | 0.921 | 0.345 | n/a | 0.000 |
| fuzzy | 0.317 | 0.952 | 0.911 | 0.921 | 0.345 | n/a | 0.000 |
| hybrid | 0.317 | 0.952 | 0.911 | 0.921 | 0.345 | n/a | 0.000 |

Family-cluster bootstrap (95%, 2,000 draws; fewer than 5 independent clusters suppresses CI):

| Mode | Independent clusters | MRR 95% CI | Warm p50 / p95 ms | Non-abstaining relevant response rate |
|---|---:|---|---:|---:|
| lexical | 14 | [0.839, 0.970] | 11.503 / 15.109 | 0.345 |
| graph | 14 | [0.839, 0.970] | 11.506 / 15.424 | 0.345 |
| fuzzy | 14 | [0.839, 0.970] | 11.759 / 15.103 | 0.345 |
| hybrid | 14 | [0.839, 0.970] | 13.225 / 20.040 | 0.345 |

Cross-split near duplicates: 0; shared-fact pairs requiring review: 0.

Extraction (micro counts across documents; null means no extraction gold annotations):

```json
null
```

Limitations:

- These results measure only this dataset; inspect review_status and provenance before making quality claims.
- Source-separated evaluation uses an isolated corpus for each partition; it is not a mixed-corpus production benchmark.
- Lexical near-duplicate and shared-fact auditing cannot detect all semantic leakage; manual review is required.
- Candidate rankers may be evaluated explicitly; a successful evaluation alone is not production promotion.
- Heuristic ranking scores are not probabilities; calibration/Brier metrics are intentionally omitted.
- Bootstrap resamples connected source-family clusters; fewer than five independent families suppress the interval.
- Latency uses seeded shuffled mode order and repeated warm in-process API requests, not deployed-network latency.
- Citation integrity checks provenance, not whether an excerpt entails an answer.

Full JSON includes per-query failures, rankings, versions, latencies, query counts and bootstrap intervals.
