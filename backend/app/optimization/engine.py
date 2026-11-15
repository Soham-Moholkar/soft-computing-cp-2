"""Actual population/swarm searches under an equal objective-evaluation budget."""
from math import cos, exp, isfinite, pi
from random import Random
from statistics import pstdev
from time import perf_counter

from app.evaluation.metrics import retrieval_metrics
from app.retrieval.ranker import FEATURE_VERSION, digest

ALGORITHMS = ("GA", "PSO", "GWO", "WOA", "FUZZY_GA", "GA_PSO")
BASELINE = (.6, .25, .15, 0.)


def simplex(vector):
    """Euclidean projection preserves a bounded nonnegative sum of one."""
    ordered = sorted(vector, reverse=True)
    rho = max(i for i in range(len(vector)) if ordered[i] - (sum(ordered[:i + 1]) - 1) / (i + 1) > 0)
    theta = (sum(ordered[:rho + 1]) - 1) / (rho + 1)
    return [max(value - theta, 0) for value in vector]


class FeatureObjective:
    def __init__(self, report, expected_split="validation"):
        if report.get("split") != expected_split or report.get("test_unlocked") or report.get("ranker_sha256"):
            raise ValueError(f"A default {expected_split}-only feature report is required; test features are forbidden")
        if report.get("feature_version") != FEATURE_VERSION:
            raise ValueError("Incompatible or missing candidate features")
        self.rows = [row for row in report["records"] if row["mode"] == "hybrid" and row["answerable"]]
        if not self.rows or any(row["failed"] for row in report["records"]):
            raise ValueError("Feature reports must have answerable queries and no failed requests")
        for row in self.rows:
            if not row.get("gold_grades"):
                raise ValueError("Full gold grades, including missed candidates, are required")
            candidates = row.get("candidates", [])
            if not candidates or len({item["chunk_id"] for item in candidates}) != len(candidates):
                raise ValueError("Candidate features are missing or duplicated")
            for item in candidates:
                if len(item["features"]) != 4 or any(not isfinite(v) or not 0 <= v <= 1 for v in item["features"]):
                    raise ValueError("Features must be four finite values in [0,1]")
        self.report, self.k = report, report["top_k"]
        self.latency = report["summary"]["hybrid"]["latency_p95_ms"]
        if self.latency is None or not isfinite(self.latency) or self.latency < 0:
            raise ValueError("A measured baseline latency is required")
        relation = (report.get("extraction") or {}).get("relations")
        self.noise = relation["fp"] / max(1, relation["tp"] + relation["fp"]) if relation else None

    def score(self, vector, nonlinear=False):
        ndcg, recall = [], []
        for row in self.rows:
            rank = sorted(row["candidates"], key=lambda item: (-sum(a * b for a, b in zip(vector, fuzzy_features(item["features"]) if nonlinear else item["features"], strict=True)), item["chunk_id"]))
            gold = row["gold_grades"]
            if not gold:
                ndcg.append(0); recall.append(0)
                continue
            metrics = retrieval_metrics([item["chunk_id"] for item in rank], gold, self.k)
            ndcg.append(metrics["ndcg_at_k"]); recall.append(metrics["recall_at_k"])
        ranking, coverage = sum(ndcg) / len(ndcg), sum(recall) / len(recall)
        # Measured baseline cost/noise are fixed constraints, not invented per-vector latency.
        penalty = .02 * min(self.latency / 150, 2) + .02 * (self.noise or 0)
        return {"fitness": .75 * ranking + .25 * coverage - penalty, "ndcg_at_k": ranking,
                "recall_at_k": coverage, "baseline_p95_ms": self.latency, "graph_noise_proxy": self.noise,
                "baseline_latency_constraint_met": self.latency <= 150}

    def provenance(self):
        return {"dataset_sha256": self.report["dataset_sha256"], "dataset_version": self.report["dataset_version"],
                "feature_report_sha256": digest(self.report), "feature_code_sha256": self.report["code_sha256"],
                "feature_version": FEATURE_VERSION, "domain": self.report["domain"],
                "review_status": self.report["review_status"], "split": self.report["split"], "top_k": self.k,
                "queries": len(self.rows), "objective": ".75 NDCG@K + .25 Recall@K - fixed baseline latency/noise penalties",
                "limitations": ["Fixed candidate-bank ranking diagnostics; no live configuration mutation.",
                                "Baseline latency/noise are held constant; candidate end-to-end response/latency needs a separate evaluation.",
                                "Unjudged evidence is treated as irrelevant; reviewed course data and final-test promotion remain required."]}


def optimize(objective, algorithm="GA", budget=64, population=8, seed=17, mutation=.1, crossover=.8, selection="tournament"):
    if algorithm not in ALGORITHMS or not 8 <= budget <= 256 or not 4 <= population <= min(32, budget):
        raise ValueError("Invalid algorithm, evaluation budget or population")
    if not 0 <= mutation <= 1 or not 0 <= crossover <= 1 or selection not in {"tournament", "roulette"}:
        raise ValueError("Invalid genetic settings")
    random, trace, best_vector, best_metrics = Random(seed), [], None, None
    started = perf_counter()
    def evaluate(vector, phase, details=None):
        nonlocal best_vector, best_metrics
        vector = simplex(vector)
        metrics = objective.score(vector)
        if best_metrics is None or metrics["fitness"] > best_metrics["fitness"]:
            best_vector, best_metrics = vector[:], metrics
        trace.append({"evaluation": len(trace) + 1, "phase": phase, "vector": vector[:],
                      "fitness": metrics["fitness"], "best_fitness": best_metrics["fitness"],
                      "constraint_violations": int(any(v < 0 or v > 1 for v in vector) or abs(sum(vector) - 1) > 1e-9),
                      **(details or {})})
        return vector, metrics["fitness"]
    def initial():
        return [list(BASELINE)] + [simplex([random.random() for _ in range(4)]) for _ in range(population - 1)]
    def genetic(limit, adaptive=False):
        members = [evaluate(vector, "GA") for vector in initial()[:min(population, limit - len(trace))]]
        while len(trace) < limit:
            ranked = sorted(members, key=lambda item: -item[1])
            diversity = sum(pstdev([vector[i] for vector, _ in members]) for i in range(4)) / 4
            low = max(0., min(1., (0.12 - diversity) / .12))
            rate = mutation + (1 - mutation) * .5 * low if adaptive else mutation
            def parent():
                if selection == "tournament":
                    return max(random.sample(members, min(3, len(members))), key=lambda item: item[1])[0]
                low_fitness = min(item[1] for item in members)
                return random.choices([item[0] for item in members], weights=[item[1] - low_fitness + .01 for item in members])[0]
            next_members = [ranked[0]]
            while len(next_members) < population and len(trace) < limit:
                a, b = parent(), parent()
                child = [a[i] if random.random() < .5 else b[i] for i in range(4)] if random.random() < crossover else a[:]
                child = [v + random.gauss(0, .15) if random.random() < rate else v for v in child]
                next_members.append(evaluate(child, "FUZZY_GA" if adaptive else "GA", {"diversity": diversity, "low_diversity_membership": low, "mutation_rate": rate} if adaptive else None))
            members = next_members
    def swarm(kind, limit, starting=None):
        vectors = initial(); vectors[0] = starting[:] if starting else vectors[0]
        states = [evaluate(vector, kind) for vector in vectors[:min(population, limit - len(trace))]]
        personal = [(vector[:], value) for vector, value in states]
        velocity = [[0.] * 4 for _ in states]
        while len(trace) < limit:
            leaders = [vector for vector, _ in sorted(states, key=lambda item: -item[1])[:3]]
            a = 2 * (1 - len(trace) / limit)
            next_states = []
            for index, (position, _) in enumerate(states):
                if len(trace) >= limit: break
                if kind == "PSO":
                    velocity[index] = [max(-.3, min(.3, .65 * velocity[index][i] + 1.5 * random.random() * (personal[index][0][i] - position[i]) + 1.5 * random.random() * (best_vector[i] - position[i]))) for i in range(4)]
                    candidate = [position[i] + velocity[index][i] for i in range(4)]
                elif kind == "GWO":
                    candidate = [sum(leader[i] - (2 * a * random.random() - a) * abs(2 * random.random() * leader[i] - position[i]) for leader in leaders) / len(leaders) for i in range(4)]
                else:
                    coefficient, c = 2 * a * random.random() - a, 2 * random.random()
                    if random.random() < .5:
                        reference = best_vector if abs(coefficient) < 1 else random.choice(states)[0]
                        candidate = [reference[i] - coefficient * abs(c * reference[i] - position[i]) for i in range(4)]
                    else:
                        spiral = random.uniform(-1, 1)
                        candidate = [abs(best_vector[i] - position[i]) * exp(spiral) * cos(2 * pi * spiral) + best_vector[i] for i in range(4)]
                state = evaluate(candidate, kind)
                if state[1] > personal[index][1]: personal[index] = state
                next_states.append(state)
            states = next_states
    if algorithm == "GA_PSO":
        genetic(budget // 2); swarm("PSO", budget, best_vector)
    elif algorithm in {"GA", "FUZZY_GA"}:
        genetic(budget, algorithm == "FUZZY_GA")
    else:
        swarm(algorithm, budget)
    return {"algorithm": algorithm, "seed": seed, "evaluation_budget": budget, "evaluations": len(trace),
            "population_size": population, "best_vector": best_vector, "best_metrics": best_metrics,
            "baseline_metrics": objective.score(BASELINE), "trace": trace,
            "execution_time_ms": (perf_counter() - started) * 1000, "provenance": objective.provenance(),
            "settings": {"mutation_rate": mutation, "crossover_rate": crossover, "selection": selection},
            "status": "candidate"}


def fuzzy_features(features):
    # Three fixed linguistic memberships per signal; learned Sugeno consequents.
    memberships = [value for x in features[:3] for value in (max(0, 1 - 2 * x), max(0, 1 - abs(2 * x - 1)), max(0, 2 * x - 1))]
    total = sum(memberships)
    return [value / total for value in memberships]


def train_neuro_fuzzy(training, validation, seed=17, steps=100):
    train_objective = FeatureObjective(training, "train")
    validation_objective = FeatureObjective(validation)
    if training["dataset_sha256"] != validation["dataset_sha256"]:
        raise ValueError("Train/validation dataset mismatch")
    pairs = []
    for row in train_objective.rows:
        positive = [item for item in row["candidates"] if item["grade"] > 0]
        negative = sorted([item for item in row["candidates"] if item["grade"] == 0], key=lambda item: -item["features"][0])[:5]
        for good in positive:
            for bad in negative:
                pairs.append([a - b for a, b in zip(fuzzy_features(good["features"]), fuzzy_features(bad["features"]), strict=True)])
    if len(pairs) < 20:
        raise ValueError("Neuro-fuzzy training needs at least 20 train-only preference pairs")
    random = Random(seed)
    weights = [random.uniform(.2, .8) for _ in range(9)]
    history = []
    from math import log1p
    for step in range(steps):
        gradient = [0.] * 9
        loss = 0.
        for difference in pairs:
            margin = sum(a * b for a, b in zip(weights, difference))
            loss += log1p(exp(-margin)) / len(pairs)
            for i, value in enumerate(difference): gradient[i] -= value / (1 + exp(margin)) / len(pairs)
        weights = [max(0., min(1., value - .5 * gradient[i])) for i, value in enumerate(weights)]
        history.append({"step": step + 1, "train_pairwise_loss": loss})
    return {"algorithm": "NEURO_FUZZY", "status": "candidate", "seed": seed, "training_pairs": len(pairs),
            "training_steps": steps, "best_vector": weights, "best_metrics": validation_objective.score(weights, nonlinear=True),
            "trace": history, "provenance": validation_objective.provenance(),
            "training_report_sha256": digest(training),
            "model": {"kind": "fixed-membership zero-order Sugeno network", "consequents": weights,
                      "inputs": ["lexical", "graph", "fuzzy"], "membership_centers": [0, .5, 1]},
            "limitations": "Experimental learned consequents; memberships are fixed. Not a full ANFIS premise optimizer or a live-loadable linear artifact."}
