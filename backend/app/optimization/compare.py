"""Offline equal-budget, multi-seed comparisons; never reads test features."""
import argparse
import json
from pathlib import Path
from statistics import mean, pstdev

from app.optimization.engine import ALGORITHMS, FeatureObjective, optimize, train_neuro_fuzzy
from app.optimization.service import load_bank, code_hash


def compare(dataset="real", budget=64, seeds=(17, 29, 43), population=8):
    validation = load_bank(dataset)
    objective = FeatureObjective(validation)
    runs = [optimize(objective, algorithm, budget, population, seed) for algorithm in ALGORITHMS for seed in seeds]
    summaries = []
    for algorithm in ALGORITHMS:
        selected = [run for run in runs if run["algorithm"] == algorithm]
        summaries.append({"algorithm": algorithm, "seeds": list(seeds), "evaluations_per_seed": budget,
                          "mean_fitness": mean(run["best_metrics"]["fitness"] for run in selected),
                          "std_fitness": pstdev(run["best_metrics"]["fitness"] for run in selected),
                          "mean_ndcg": mean(run["best_metrics"]["ndcg_at_k"] for run in selected),
                          "mean_execution_ms": mean(run["execution_time_ms"] for run in selected)})
    neural, unavailable = [], None
    try:
        neural = [train_neuro_fuzzy(load_bank(dataset, "train"), validation, seed, budget) for seed in seeds]
    except ValueError as error:
        unavailable = str(error)
    return {"schema_version": "optimizer-comparison-1", "optimization_code_sha256": code_hash(),
            "dataset": dataset, "baseline_metrics": objective.score((.6, .25, .15, 0)), "summary": summaries,
            "runs": runs, "neuro_fuzzy_experiments": neural, "neuro_fuzzy_unavailable": unavailable, "production_promoted": False,
            "limitations": ["Algorithms use equal actual fitness-call budgets, including initial populations and repeated candidates.",
                            "Three seeds provide descriptive variability, not a robust confidence interval.",
                            "Neuro-fuzzy training uses training gradients and is reported separately from the equal-budget search comparison.",
                            *objective.provenance()["limitations"]]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", choices=("synthetic", "real"), default="real")
    parser.add_argument("--budget", type=int, default=64)
    parser.add_argument("--population", type=int, default=8)
    parser.add_argument("--seeds", type=int, nargs="+", default=[17, 29, 43])
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists(): parser.error("Preserve previous comparisons; choose a new output")
    result = compare(args.dataset, args.budget, args.seeds, args.population)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["summary"], indent=2))
