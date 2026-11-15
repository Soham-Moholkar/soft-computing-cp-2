# Milestone 6: measured optimization

API mode runs actual GA, PSO, GWO, WOA, Fuzzy-GA and GA→PSO. Vectors are projected
onto the nonnegative unit simplex. Every objective call counts toward the bounded
8–256 evaluation budget, including initialization and repeated vectors. Seed,
settings, constraints, trace, candidate checksum and provenance are saved in SQLite.
No run changes live ranking. One optimizer worker and four pending jobs per workspace
bound resource use. Interrupted active runs fail visibly on restart; queued runs resume.

Captured **validation** feature banks contain candidate features plus complete gold
grades, including relevant chunks missed by the shortlist. The objective combines
NDCG and recall. Latency and graph-noise penalties are fixed baseline measurements:
they cannot establish a candidate's serving latency or improved graph extraction.
Source diversity, abstention, shortlist changes and citation output need separate
end-to-end evaluation. Test data is never used by these laboratories.

The separate experimental neuro-fuzzy network learns nine zero-order Sugeno
consequents on train-only preference pairs, with fixed triangular memberships.
It is not a complete ANFIS premise optimizer, and its artifact cannot be loaded
as the four-weight linear serving model. The UI shows its train loss and validation
ranking separately.

ACO traverses actual stored graph edges with seeded ants, confidence heuristics,
evaporation and pheromone deposits. It returns chunk references for discovered
paths. It is stochastic and does not guarantee a shortest path or factual correctness.

From `backend`, prepare feature banks:

```powershell
py -m app.evaluation.run --dataset evaluation/synthetic-course-v2.json --split train --capture-features --output evaluation/runs/optimizer-synthetic-train-v1
py -m app.evaluation.run --dataset evaluation/synthetic-course-v2.json --split validation --capture-features --output evaluation/runs/optimizer-synthetic-validation-v1
py -m app.evaluation.run --dataset evaluation/squad2-retrieval-v1.json --split train --capture-features --output evaluation/runs/optimizer-real-train-v1
py -m app.evaluation.run --dataset evaluation/squad2-retrieval-v1.json --split validation --capture-features --output evaluation/runs/optimizer-real-validation-v1
py -m app.optimization.compare --dataset real --budget 64 --population 8 --seeds 17 29 43 --output evaluation/runs/optimizer-comparison-real-v1.json
```

Existing artifacts are preserved. Choose a new output when rerunning. The checked
real comparison gives all six searches the same mean NDCG **0.94184**, equal to
the baseline, across three seeds and 64 evaluations each. This is a tie, not a
quality improvement. Search execution times are diagnostic local timings measured
alongside other work; they are not serving latency measurements. Three seeds are
descriptive and do not justify a robust confidence interval. The public Wikipedia
corpus remains outside the course domain and its retrieval adaptation is unreviewed.
No candidate has passed production promotion.

Routes: `GET /api/optimization/datasets`, `POST/GET /api/optimization/jobs`,
`GET /api/optimization/jobs/{id}`, `POST /api/aco/search`, `GET /api/benchmark`.
The optimization studio and benchmarks read these records in API mode. Mock
mode remains a clearly labeled educational alternative.

On the harder synthetic bank, GA→PSO reaches mean NDCG 0.95833 versus
0.87500 baseline across the three seeds; other methods average 0.93056.
The small bank contains too few independent source clusters for a reliable interval.
The synthetic training bank lacks twenty preference pairs, so neuro-fuzzy fitting
is unavailable for it. On real training data, all three neuro-fuzzy experiments use
775 preference pairs and produce validation NDCG below the baseline (roughly
0.91–0.93). This is another negative result, not a reason to promote the model.
