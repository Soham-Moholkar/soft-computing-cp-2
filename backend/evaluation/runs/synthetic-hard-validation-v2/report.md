# SoftGraph offline baseline evaluation

Dataset: `synthetic-course-v2-hard-queries` · `unreviewed_synthetic` · split `validation`

Dataset SHA-256: `4ac9e4b0cd6996c04e7e1a68990c3ff05d6cbe1c9ee063a042d683d4385455c8`
Backend code SHA-256: `29123d93fbb1e88acaedb44a10c7b2669019ce1c6b3f43365e2b09180f673315`

Sources: 5; K: 3; seed: 1729. No provider calls. Ranker: default baseline.

| Mode | P@K | R@K | MRR@K | NDCG@K | Answerability | No-answer abstention | Failures |
|---|---:|---:|---:|---:|---:|---:|---:|
| lexical | 0.361 | 0.917 | 0.861 | 0.875 | 0.722 | 1.000 | 0.000 |
| graph | 0.361 | 0.917 | 0.861 | 0.875 | 0.667 | 1.000 | 0.000 |
| fuzzy | 0.361 | 0.917 | 0.861 | 0.875 | 0.722 | 1.000 | 0.000 |
| hybrid | 0.361 | 0.917 | 0.861 | 0.875 | 0.722 | 1.000 | 0.000 |

Family-cluster bootstrap (95%, 2,000 draws; fewer than 5 independent clusters suppresses CI):

| Mode | Independent clusters | MRR 95% CI | Warm p50 / p95 ms | Non-abstaining relevant response rate |
|---|---:|---|---:|---:|
| lexical | 3 | insufficient_independent_families_minimum_5 | 7.668 / 19.001 | 0.583 |
| graph | 3 | insufficient_independent_families_minimum_5 | 7.734 / 15.283 | 0.500 |
| fuzzy | 3 | insufficient_independent_families_minimum_5 | 7.448 / 15.272 | 0.583 |
| hybrid | 3 | insufficient_independent_families_minimum_5 | 7.384 / 16.815 | 0.583 |

Cross-split near duplicates: 0; shared-fact pairs requiring review: 1.

Extraction (micro counts across documents; null means no extraction gold annotations):

```json
{
  "mentions": {
    "tp": 14,
    "fp": 1,
    "fn": 1,
    "precision": 0.9333333333333333,
    "recall": 0.9333333333333333,
    "f1": 0.9333333333333333
  },
  "relations": {
    "tp": 5,
    "fp": 0,
    "fn": 1,
    "precision": 1.0,
    "recall": 0.8333333333333334,
    "f1": 0.9090909090909091
  },
  "end_to_end_resolution_accuracy": 0.9333333333333333,
  "gold_mentions": 15,
  "missing_mentions": [
    [
      "val-missing-concept",
      0,
      19,
      "Simulated Annealing"
    ]
  ],
  "unexpected_mentions": [
    [
      "val-missing-concept",
      99,
      109,
      "Entity Extraction"
    ]
  ],
  "missing_relations": [
    [
      "val-missing-concept",
      "Simulated Annealing",
      "supports",
      "Hybrid Retrieval"
    ]
  ],
  "unexpected_relations": []
}
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
