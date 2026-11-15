# SoftGraph offline baseline evaluation

Dataset: `squad2-retrieval-adaptation-v1` · `upstream_human_annotated` · split `validation`

Dataset SHA-256: `9270d32c8de9313e8660a4f02d99fcd01b7d3862762d500c7bf2f68da1f7d7ee`
Backend code SHA-256: `4ccb56f62ff372b3fa57d6541267a8f012f29af9ee556089e032c55996154843`

Sources: 48; K: 3; seed: 1729. No provider calls. Ranker: 5a0173e0b1d7de5b1f838b91fdaf1b3164ff20d601f41756c53410720a73ca92.

| Mode | P@K | R@K | MRR@K | NDCG@K | Answerability | No-answer abstention | Failures |
|---|---:|---:|---:|---:|---:|---:|---:|
| lexical | 0.326 | 0.979 | 0.929 | 0.942 | 0.219 | n/a | 0.000 |
| graph | 0.326 | 0.979 | 0.929 | 0.942 | 0.219 | n/a | 0.000 |
| fuzzy | 0.326 | 0.979 | 0.929 | 0.942 | 0.219 | n/a | 0.000 |
| hybrid | 0.326 | 0.979 | 0.929 | 0.942 | 0.219 | n/a | 0.000 |

Family-cluster bootstrap (95%, 2,000 draws; fewer than 5 independent clusters suppresses CI):

| Mode | Independent clusters | MRR 95% CI | Warm p50 / p95 ms | Non-abstaining relevant response rate |
|---|---:|---|---:|---:|
| lexical | 8 | [0.887, 0.969] | 9.723 / 12.840 | 0.219 |
| graph | 8 | [0.887, 0.969] | 10.117 / 13.073 | 0.219 |
| fuzzy | 8 | [0.887, 0.969] | 10.013 / 13.009 | 0.219 |
| hybrid | 8 | [0.887, 0.969] | 10.085 / 12.970 | 0.219 |

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
