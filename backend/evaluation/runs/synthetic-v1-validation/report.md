# SoftGraph offline baseline evaluation

Dataset: `synthetic-course-v1` · `unreviewed_synthetic` · split `validation`

Dataset SHA-256: `4c232e32e3fa22f5488bb1c1ade40ce378db4d0a70a90a0fac454aa8fb0f24e1`
Backend code SHA-256: `e3649c22e815125498405f7be4d659ced8834bcfad0a63f0dee6bc56d9bcb571`

Sources: 5; K: 3; seed: 1729. No provider calls or training.

| Mode | P@K | R@K | MRR@K | NDCG@K | Answerability | No-answer abstention | Failures |
|---|---:|---:|---:|---:|---:|---:|---:|
| lexical | 0.429 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 | 0.000 |
| graph | 0.429 | 1.000 | 1.000 | 1.000 | 0.900 | 1.000 | 0.000 |
| fuzzy | 0.429 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 | 0.000 |
| hybrid | 0.429 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 | 0.000 |

Extraction (micro counts across documents):

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
- Exact/family leakage checks cannot detect all semantic duplicates; manual review is required.
- No trained model, embedding evaluation, optimizer run or model promotion is performed.
- Heuristic ranking scores are not probabilities; calibration/Brier metrics are intentionally omitted.
- Bootstrap intervals resample queries, not source families; tiny correlated fixtures cannot establish generalization.
- Latency is in-process API latency including snapshot writes, not deployed network latency; runs use a fixed mode order.
- Citation integrity checks provenance, not whether an excerpt entails an answer.

Full JSON includes per-query failures, rankings, versions, latencies, query counts and bootstrap intervals.
