"""Reproduce bundled models: python -m app.hospital.train_assessment.

No downloads, patient files or runtime dependencies beyond the pinned training NumPy.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import platform
from collections import defaultdict
from pathlib import Path

from app.hospital.assessment import DATA_FILES, MODEL_IDS, ROOT, SCHEMAS, canonical_json, predict_raw

SEED = 20261114
HORIZON = 90
ALGORITHM = "zero-order Gaussian Sugeno with regularized learned consequents"
FEATURES_CLEVELAND = ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"]


def fixed_horizon_label(follow_up_days, death_event):
    if death_event == 1 and follow_up_days <= HORIZON:
        return 1
    if follow_up_days >= HORIZON:
        return 0
    return None


def load_dataset(model_id):
    filename, expected = DATA_FILES[model_id]
    raw = (ROOT / "data" / filename).read_bytes()
    if len(raw) > 100_000 or hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError("Public dataset checksum/size mismatch")
    rows, labels, source_indices, excluded = [], [], [], []
    names = [field["name"] for field in SCHEMAS[model_id]]
    if model_id == MODEL_IDS[0]:
        records = list(csv.reader(io.StringIO(raw.decode("ascii"))))
        for index, record in enumerate(records):
            if len(record) != 14:
                raise ValueError("Unexpected Cleveland column count")
            values = [None if item == "?" else float(item) for item in record]
            rows.append(dict(zip(FEATURES_CLEVELAND, values[:13])))
            labels.append(int(values[13] > 0))
            source_indices.append(index)
    else:
        records = list(csv.DictReader(io.StringIO(raw.decode("ascii"))))
        for index, record in enumerate(records):
            label = fixed_horizon_label(float(record["time"]), int(record["DEATH_EVENT"]))
            if label is None:
                excluded.append(index)
                continue
            rows.append({name: float(record[name]) for name in names})
            labels.append(label)
            source_indices.append(index)
    if len(records) != (303 if model_id == MODEL_IDS[0] else 299):
        raise ValueError("Unexpected public cohort size")
    return rows, labels, {"source_rows": len(records), "eligible_rows": len(rows), "excluded_censored_before_90_days": len(excluded), "excluded_source_indices": excluded, "eligible_source_indices": source_indices}


def input_group(row):
    return hashlib.sha256(canonical_json(row)).hexdigest()


def grouped_split(rows, labels, seed=SEED):
    groups = defaultdict(list)
    for index, row in enumerate(rows):
        groups[input_group(row)].append(index)
    by_label = defaultdict(list)
    conflicting = 0
    for key, indices in groups.items():
        group_labels = [labels[index] for index in indices]
        conflicting += int(len(set(group_labels)) > 1)
        by_label[int(sum(group_labels) >= len(group_labels) / 2)].append(key)
    split = {"train": [], "validation": [], "test": []}
    for label in sorted(by_label):
        keys = sorted(by_label[label], key=lambda key: hashlib.sha256(f"{seed}:{key}".encode()).hexdigest())
        count = len(keys)
        n_train, n_validation = round(count * .6), round(count * .2)
        for name, selected in (("train", keys[:n_train]), ("validation", keys[n_train:n_train+n_validation]), ("test", keys[n_train+n_validation:])):
            split[name].extend(index for key in selected for index in groups[key])
    for indices in split.values():
        indices.sort()
    return split, {"identical_input_groups": len(groups), "duplicate_rows": len(rows) - len(groups), "conflicting_label_groups": conflicting}


def fit_preprocessing(rows, schema):
    import numpy as np
    result = {}
    for field in schema:
        observed = [row[field["name"]] for row in rows if row[field["name"]] is not None]
        if field["kind"] == "category":
            categories = [choice["value"] for choice in field["choices"]]
            if any(value not in categories for value in observed):
                raise ValueError("Unknown source category")
            impute = min(categories, key=lambda item: (-observed.count(item), item))
            result[field["name"]] = {"categories": categories, "impute": impute, "missing_train": len(rows) - len(observed)}
        else:
            impute = float(np.median(observed))
            filled = np.asarray([row[field["name"]] if row[field["name"]] is not None else impute for row in rows])
            result[field["name"]] = {"impute": impute, "mean": float(filled.mean()), "scale": max(float(filled.std()), 1e-9), "missing_train": len(rows) - len(observed)}
    return result


def encoded_rows(rows, schema, preprocessing):
    from app.hospital.assessment import transform
    import numpy as np
    artifact = {"schema": schema, "preprocessing": preprocessing}
    return np.asarray([transform(row, artifact) for row in rows])


def fit_centers(matrix, count=8, seed=SEED):
    """Seeded train-only k-means++ initialization and Lloyd updates."""
    import numpy as np
    rng = np.random.default_rng(seed)
    centers = [matrix[int(rng.integers(len(matrix)))].copy()]
    for _ in range(1, count):
        distances = np.min(np.sum((matrix[:, None, :] - np.asarray(centers)[None, :, :]) ** 2, axis=2), axis=1)
        index = int(rng.choice(len(matrix), p=distances / distances.sum())) if distances.sum() else 0
        centers.append(matrix[index].copy())
    centers = np.asarray(centers)
    for _ in range(30):
        assignment = np.argmin(np.sum((matrix[:, None, :] - centers[None, :, :]) ** 2, axis=2), axis=1)
        updated = np.asarray([matrix[assignment == index].mean(axis=0) if np.any(assignment == index) else centers[index] for index in range(count)])
        if np.allclose(updated, centers, atol=1e-10, rtol=0):
            break
        centers = updated
    return centers


def memberships(matrix, centers, width):
    import numpy as np
    logs = -np.mean((matrix[:, None, :] - centers[None, :, :]) ** 2, axis=2) / (2 * width ** 2)
    weights = np.exp(logs - logs.max(axis=1, keepdims=True))
    return weights / weights.sum(axis=1, keepdims=True)


def fit_consequents(weights, labels, ridge):
    import numpy as np
    prior = float(labels.mean())
    # Ridge is centered on the train-only prevalence, then constants are bounded.
    return np.clip(np.linalg.solve(weights.T @ weights + ridge * np.eye(weights.shape[1]), weights.T @ labels + ridge * prior), 0, 1)


def ga_select(train_x, train_y, validation_x, validation_y, centers):
    """Small actual genetic search; test data never enter this function."""
    import numpy as np
    rng = np.random.default_rng(SEED + 1)
    low, high = np.log([.08, .0001]), np.log([3., 10.])
    population = rng.uniform(low, high, size=(12, 2))
    population[0] = np.log([.5, .1])
    cache, history = {}, []

    def candidate(genes):
        key = tuple(round(float(value), 10) for value in genes)
        if key not in cache:
            width, ridge = np.exp(genes)
            consequents = fit_consequents(memberships(train_x, centers, width), train_y, ridge)
            prediction = memberships(validation_x, centers, width) @ consequents
            cache[key] = (float(np.mean((prediction - validation_y) ** 2)), float(width), float(ridge), consequents)
        return cache[key]

    for generation in range(8):
        population = sorted(population, key=lambda genes: (candidate(genes)[0], tuple(genes)))
        history.append({"generation": generation + 1, "best_validation_brier": candidate(population[0])[0]})
        elites = population[:4]
        children = [elites[0].copy(), elites[1].copy()]
        while len(children) < 12:
            left, right = (elites[int(rng.integers(4))] for _ in range(2))
            blend = rng.uniform(0, 1, size=2)
            child = blend * left + (1 - blend) * right
            child += rng.normal(0, .35, size=2) * (rng.random(2) < .7)
            children.append(np.clip(child, low, high))
        if generation < 7:
            population = children
    best = candidate(population[0])
    return best, {"seed": SEED + 1, "population": 12, "generations": 8, "unique_candidates": len(cache), "objective": "validation Brier score (lower is better)", "width_search": [.08, 3.], "ridge_search": [.0001, 10.], "history": history}


def metrics(labels, scores):
    n = len(labels)
    predicted = [int(score >= .5) for score in scores]
    tp = sum(label == 1 and pred == 1 for label, pred in zip(labels, predicted))
    tn = sum(label == 0 and pred == 0 for label, pred in zip(labels, predicted))
    fp, fn = sum(label == 0 for label in labels) - tn, sum(label == 1 for label in labels) - tp
    positive, negative = tp + fn, tn + fp
    sensitivity, specificity = tp / positive if positive else None, tn / negative if negative else None
    auc = sum((left > right) + .5 * (left == right) for label, left in zip(labels, scores) if label == 1 for other, right in zip(labels, scores) if other == 0) / (positive * negative) if positive and negative else None
    accuracy = (tp + tn) / n
    z, denominator = 1.959963984540054, 1 + 1.959963984540054 ** 2 / n
    center = (accuracy + z ** 2 / (2 * n)) / denominator
    margin = z * math.sqrt(accuracy * (1 - accuracy) / n + z ** 2 / (4 * n ** 2)) / denominator
    return {"n": n, "positives": positive, "negatives": negative, "true_positive": tp, "true_negative": tn, "false_positive": fp, "false_negative": fn, "accuracy": accuracy, "accuracy_wilson_95": [center - margin, center + margin], "sensitivity": sensitivity, "specificity": specificity, "balanced_accuracy": (sensitivity + specificity) / 2 if sensitivity is not None and specificity is not None else None, "auroc": auc, "brier": sum((score - label) ** 2 for label, score in zip(labels, scores)) / n, "log_loss": -sum(label * math.log(max(1e-9, min(1 - 1e-9, score))) + (1 - label) * math.log(max(1e-9, min(1 - 1e-9, 1 - score))) for label, score in zip(labels, scores)) / n}


def train(model_id):
    import numpy as np
    rows, labels, cohort = load_dataset(model_id)
    split, groups = grouped_split(rows, labels)
    schema = SCHEMAS[model_id]
    train_rows = [rows[index] for index in split["train"]]
    validation_rows = [rows[index] for index in split["validation"]]
    preprocessing = fit_preprocessing(train_rows, schema)
    train_x = encoded_rows(train_rows, schema, preprocessing)
    validation_x = encoded_rows(validation_rows, schema, preprocessing)
    train_y = np.asarray([labels[index] for index in split["train"]], dtype=float)
    validation_y = np.asarray([labels[index] for index in split["validation"]], dtype=float)
    centers = fit_centers(train_x)
    (validation_loss, width, ridge, consequents), ga = ga_select(train_x, train_y, validation_x, validation_y, centers)
    is_cleveland = model_id == MODEL_IDS[0]
    filename, data_hash = DATA_FILES[model_id]
    artifact = {
        "format_version": 1, "model_id": model_id, "version": f"{model_id}-seed-{SEED}",
        "title": "Cleveland angiographic label classification" if is_cleveland else "Heart-failure cohort 90-day outcome classification",
        "target": "Dataset num > 0 versus num = 0; angiographic disease-status label at assessment, not future disease onset." if is_cleveland else "Recorded death by day 90 among people with known heart failure; early alive censoring excluded.",
        "positive_class": "Positive dataset class (num > 0)" if is_cleveland else "Positive dataset class (death recorded by day 90)",
        "negative_class": "Negative dataset class (num = 0)" if is_cleveland else "Negative dataset class (observed at or beyond day 90 without an earlier death)",
        "horizon_days": None if is_cleveland else HORIZON,
        "source": {
            "name": "UCI Heart Disease — processed Cleveland subset" if is_cleveland else "UCI Heart Failure Clinical Records",
            "url": "https://archive.ics.uci.edu/dataset/45/heart+disease" if is_cleveland else "https://archive.ics.uci.edu/dataset/519/heart+failure+clinical+records",
            "download_url": "https://archive.ics.uci.edu/static/public/45/heart+disease.zip" if is_cleveland else "https://archive.ics.uci.edu/static/public/519/heart+failure+clinical+records.zip",
            "doi": "10.24432/C52P4X" if is_cleveland else "10.24432/C5Z89R",
            "attribution": "Janosi, A., Steinbrunn, W., Pfisterer, M., & Detrano, R. (1989). Heart Disease. UCI Machine Learning Repository." if is_cleveland else "Heart Failure Clinical Records (2020), UCI Machine Learning Repository. Dataset described by Davide Chicco and Giuseppe Jurman (2020).",
            "license": "CC BY 4.0", "license_url": "https://creativecommons.org/licenses/by/4.0/", "file": filename, "sha256": data_hash,
        },
        "algorithm": ALGORITHM, "schema": schema, "features": [field["name"] for field in schema],
        "preprocessing": preprocessing, "centers": centers.tolist(), "consequents": consequents.tolist(), "width": width, "ridge": ridge, "threshold": .5,
        "cohort": cohort | groups,
        "training": {
            "seed": SEED, "split_protocol": "Seeded SHA-256 ordering of identical-input groups, stratified by group majority class; approximately 60/20/20 train/validation/test. Every identical full input vector stays in one partition. No person identifiers are available to rule out non-identical repeat patients.",
            "split_rows": {name: len(indices) for name, indices in split.items()},
            "preprocessing_protocol": "Numeric median imputation, mean/standard-deviation scaling and categorical mode imputation fitted to training rows only. All declared categorical values are one-hot encoded. Runtime requires complete inputs; no runtime imputation.",
            "fit_protocol": "Eight train-only Gaussian k-means prototypes; normalized firing strengths; ridge-learned bounded zero-order consequents. Genetic search selects Gaussian width and ridge on validation Brier score. No train+validation refit, calibration or threshold tuning. Held-out test accessed once after selection.",
            "ga": ga, "validation_brier": validation_loss,
            "baseline": "Constant training prevalence with the same fixed 0.5 decision threshold; no test fitting.",
            "reproduce": "From backend: python -m app.hospital.train_assessment", "python": platform.python_version(), "numpy": np.__version__,
            "score_definition": "Weighted mean of learned rule constants, bounded [0,1]. Squared-loss training does not establish clinical calibration.",
        },
        "limitations": [
            "Small historical observational cohort; one fixed split and no prospective, external or clinical validation. Accuracy intervals reflect binomial sampling only, not model-selection, dataset shift or subgroup uncertainty.",
            "A positive dataset class is not a clinical diagnosis. Scores are uncalibrated pattern scores, not individual probabilities. No medication, treatment or care-plan recommendations are generated.",
            "Feature ranges are the published source cohort's observed bounds, used only for input refusal; imputation/scaling/prototypes and rule fitting use training data only. Bounds do not establish applicability within the range.",
            "Source binary sex coding and narrow cohort composition do not represent all people; subgroup performance is not established. Measurements and categories must be supplied in the recorded source units without automatic conversion.",
        ] + (["Cleveland labels are angiographic status, and inputs include diagnostic-test findings (vessels and thallium). This is not screening, prognosis, causal explanation or evidence of general diagnostic performance.", "The source does not specify ST-depression units in its variable table; the interface retains recorded UCI values without interpreting or converting them."] if is_cleveland else [
            "All source patients already had heart failure. This classifier cannot establish heart failure or extrapolate to other conditions.",
            f"Alive observations censored before day 90 are excluded ({cohort['excluded_censored_before_90_days']} of {cohort['source_rows']}); complete-case fixed-horizon selection may bias results. This is not a survival model and does not handle informative censoring.",
            "Follow-up time and death-event fields are used exclusively to construct/exclude targets; neither enters preprocessing, Gaussian rules or runtime inputs. Death after day 90 is negative for this fixed target.",
            "Platelet values retain the source's numerical scale and published kiloplatelets/mL label. Do not substitute differently scaled laboratory values. No unit conversion or clinical interpretation is provided.",
        ]),
        "split_indices": split,
    }
    # This is the first use of held-out labels/features for prediction or metrics.
    held_out_labels = [labels[index] for index in split["test"]]
    held_out_scores = [predict_raw(rows[index], artifact)[0] for index in split["test"]]
    artifact["metrics"] = metrics(held_out_labels, held_out_scores)
    artifact["baseline_metrics"] = metrics(held_out_labels, [float(train_y.mean())] * len(held_out_labels))
    artifact["held_out_audit"] = {"labels": held_out_labels, "scores": held_out_scores}
    artifact["status"] = "educational_only" if is_cleveland else "rejected"
    artifact["rejection_reason"] = None if is_cleveland else f"Rejected: the fixed-threshold classifier detected {artifact['metrics']['true_positive']} of {artifact['metrics']['positives']} held-out positive outcomes (sensitivity {artifact['metrics']['sensitivity']:.3f}). Evaluation is disabled; a negative class must not be used for reassurance."
    return artifact


def main():
    directory = ROOT / "artifacts"
    directory.mkdir(exist_ok=True)
    manifest = {}
    for identifier in MODEL_IDS:
        artifact = train(identifier)
        raw = json.dumps(artifact, sort_keys=True, indent=2, allow_nan=False).encode() + b"\n"
        (directory / f"{identifier}.json").write_bytes(raw)
        manifest[identifier] = hashlib.sha256(raw).hexdigest()
        print(json.dumps({"model": identifier, "cohort": artifact["cohort"]["eligible_rows"], "split": artifact["training"]["split_rows"], "held_out_metrics": artifact["metrics"]}, sort_keys=True))
    (directory / "manifest.json").write_text(json.dumps(manifest, sort_keys=True, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
