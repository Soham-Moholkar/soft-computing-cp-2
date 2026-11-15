# SoftGraph offline baseline evaluation

Dataset: `synthetic-course-v2-hard-queries` · `unreviewed_synthetic` · split `train`

Dataset SHA-256: `4ac9e4b0cd6996c04e7e1a68990c3ff05d6cbe1c9ee063a042d683d4385455c8`
Backend code SHA-256: `03be6b8aa7ba5140faffe42b7cf5a6f8afa5fee0e549d731ab167fd5cf0f4712`

Sources: 5; K: 3; seed: 1729. No provider calls. Ranker: default baseline.

| Mode | P@K | R@K | MRR@K | NDCG@K | Answerability | No-answer abstention | Failures |
|---|---:|---:|---:|---:|---:|---:|---:|
| lexical | 0.333 | 1.000 | 0.938 | 0.954 | 0.727 | 1.000 | 0.000 |
| graph | 0.333 | 1.000 | 0.938 | 0.954 | 0.636 | 1.000 | 0.000 |
| fuzzy | 0.333 | 1.000 | 0.938 | 0.954 | 0.727 | 1.000 | 0.000 |
| hybrid | 0.333 | 1.000 | 0.938 | 0.954 | 0.727 | 1.000 | 0.000 |

Family-cluster bootstrap (95%, 2,000 draws; fewer than 5 independent clusters suppresses CI):

| Mode | Independent clusters | MRR 95% CI | Warm p50 / p95 ms | Non-abstaining relevant response rate |
|---|---:|---|---:|---:|
| lexical | 4 | insufficient_independent_families_minimum_5 | 37.044 / 40.579 | 0.625 |
| graph | 4 | insufficient_independent_families_minimum_5 | 36.768 / 41.169 | 0.500 |
| fuzzy | 4 | insufficient_independent_families_minimum_5 | 36.916 / 41.690 | 0.625 |
| hybrid | 4 | insufficient_independent_families_minimum_5 | 38.462 / 50.692 | 0.625 |

Cross-split near duplicates: 0; shared-fact pairs requiring review: 1.

Extraction (micro counts across documents; null means no extraction gold annotations):

```json
{
  "mentions": {
    "tp": 11,
    "fp": 0,
    "fn": 1,
    "precision": 1.0,
    "recall": 0.9166666666666666,
    "f1": 0.9565217391304348
  },
  "relations": {
    "tp": 4,
    "fp": 0,
    "fn": 0,
    "precision": 1.0,
    "recall": 1.0,
    "f1": 1.0
  },
  "end_to_end_resolution_accuracy": 0.9166666666666666,
  "gold_mentions": 12,
  "missing_mentions": [
    [
      "train-novel",
      0,
      22,
      "Differential Evolution"
    ]
  ],
  "unexpected_mentions": [],
  "missing_relations": [],
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
