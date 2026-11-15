"""Local educational fuzzy classifiers; no patient diagnosis or treatment decisions."""
from __future__ import annotations

import hashlib
import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field, StrictBool

from app.core.errors import IngestionError

ROOT = Path(__file__).parent
MODEL_IDS = ("cleveland-presence-v1", "heart-failure-90d-v1")
DATA_FILES = {
    MODEL_IDS[0]: ("processed.cleveland.data", "a74b7efa387bc9d108d7d0115d831fe9b414b29ae7124f331b622b4efa0427c8"),
    MODEL_IDS[1]: ("heart_failure_clinical_records_dataset.csv", "9c73cea7468ff5d517801ec050fe9993da5912fce4b56f296f8df3b38dd75912"),
}
NOTICE = "Educational research only. This unvalidated pattern score is not a calibrated patient probability, diagnosis, survival estimate or treatment recommendation. Do not use it for clinical decisions."


def numeric(name, label, unit, minimum, maximum):
    return {"name": name, "label": label, "kind": "number", "unit": unit, "minimum": minimum, "maximum": maximum}


def category(name, label, choices):
    return {"name": name, "label": label, "kind": "category", "unit": "category", "choices": [{"value": value, "label": text} for value, text in choices]}


YES_NO = [(0, "No"), (1, "Yes")]
SEX = [(0, "Female (source coding)"), (1, "Male (source coding)")]
SCHEMAS = {
    MODEL_IDS[0]: [
        numeric("age", "Age", "years", 29, 77), category("sex", "Sex as encoded by the source", SEX),
        category("cp", "Chest pain category", [(1, "Typical angina"), (2, "Atypical angina"), (3, "Non-anginal pain"), (4, "Asymptomatic")]),
        numeric("trestbps", "Resting blood pressure at admission", "mm Hg", 94, 200),
        numeric("chol", "Serum cholesterol", "mg/dL", 126, 564),
        category("fbs", "Fasting blood sugar greater than 120 mg/dL", YES_NO),
        category("restecg", "Resting ECG category", [(0, "Normal"), (1, "ST-T wave abnormality"), (2, "Probable/definite ventricular hypertrophy")]),
        numeric("thalach", "Maximum heart rate achieved", "beats/min", 71, 202),
        category("exang", "Exercise-induced angina", YES_NO),
        numeric("oldpeak", "Exercise-induced ST depression relative to rest", "UCI recorded ST-depression units", 0, 6.2),
        category("slope", "Peak exercise ST segment slope", [(1, "Upsloping"), (2, "Flat"), (3, "Downsloping")]),
        category("ca", "Major vessels colored by fluoroscopy", [(0, "0 vessels"), (1, "1 vessel"), (2, "2 vessels"), (3, "3 vessels")]),
        category("thal", "Thallium test category", [(3, "Normal"), (6, "Fixed defect"), (7, "Reversible defect")]),
    ],
    MODEL_IDS[1]: [
        numeric("age", "Age", "years", 40, 95), category("anaemia", "Anaemia recorded", YES_NO),
        numeric("creatinine_phosphokinase", "Creatinine phosphokinase", "mcg/L", 23, 7861),
        category("diabetes", "Diabetes recorded", YES_NO),
        numeric("ejection_fraction", "Ejection fraction", "%", 14, 80),
        category("high_blood_pressure", "High blood pressure recorded", YES_NO),
        numeric("platelets", "Platelets (use the source's recorded scale)", "kiloplatelets/mL (UCI recorded)", 25100, 850000),
        numeric("serum_creatinine", "Serum creatinine", "mg/dL", 0.5, 9.4),
        numeric("serum_sodium", "Serum sodium", "mEq/L", 113, 148),
        category("sex", "Sex as encoded by the source", SEX), category("smoking", "Smoking recorded", YES_NO),
    ],
}
SYNTHETIC = {
    MODEL_IDS[0]: dict(age=55, sex=0, cp=2, trestbps=130, chol=220, fbs=0, restecg=0, thalach=160, exang=0, oldpeak=1, slope=1, ca=0, thal=3),
    MODEL_IDS[1]: dict(age=60, anaemia=0, creatinine_phosphokinase=250, diabetes=0, ejection_fraction=40, high_blood_pressure=0, platelets=250000, serum_creatinine=1, serum_sodium=138, sex=1, smoking=0),
}


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def _finite(value):
    try:
        return type(value) in (float, int) and math.isfinite(value)
    except OverflowError:
        return False


def load_artifact(model_id: str, directory: Path | None = None):
    """Fixed filenames, bounded JSON and checksums; never deserialize executable objects."""
    if model_id not in MODEL_IDS:
        raise ValueError("Unknown educational model")
    directory = directory or ROOT / "artifacts"
    path = directory / f"{model_id}.json"
    manifest_path = directory / "manifest.json"
    if path.stat().st_size > 250_000 or manifest_path.stat().st_size > 4096:
        raise ValueError("Artifact size limit")
    raw, manifest = path.read_bytes(), json.loads(manifest_path.read_bytes())
    if hashlib.sha256(raw).hexdigest() != manifest[model_id]:
        raise ValueError("Artifact checksum mismatch")
    artifact = json.loads(raw)
    schema = SCHEMAS[model_id]
    if artifact["model_id"] != model_id or artifact["schema"] != schema or artifact["format_version"] != 1 or artifact["algorithm"] != "zero-order Gaussian Sugeno with regularized learned consequents":
        raise ValueError("Unsupported model schema")
    filename, expected = DATA_FILES[model_id]
    if artifact["source"]["sha256"] != expected or hashlib.sha256((ROOT / "data" / filename).read_bytes()).hexdigest() != expected:
        raise ValueError("Dataset hash mismatch")
    prep = artifact["preprocessing"]
    if set(prep) != {field["name"] for field in schema}:
        raise ValueError("Invalid preprocessing fields")
    dimension = 0
    for field in schema:
        fitted = prep[field["name"]]
        if field["kind"] == "category":
            categories = [choice["value"] for choice in field["choices"]]
            if fitted["categories"] != categories or fitted["impute"] not in categories:
                raise ValueError("Invalid categorical encoding")
            dimension += len(categories)
        else:
            if any(not _finite(fitted[name]) for name in ("impute", "mean", "scale")) or not 0 < fitted["scale"] <= 1_000_000:
                raise ValueError("Invalid numeric scaling")
            if not field["minimum"] <= fitted["impute"] <= field["maximum"] or not field["minimum"] <= fitted["mean"] <= field["maximum"]:
                raise ValueError("Invalid numeric preprocessing")
            dimension += 1
    centers, consequents = artifact["centers"], artifact["consequents"]
    if not 2 <= len(centers) <= 12 or len(centers) != len(consequents):
        raise ValueError("Invalid rule count")
    for center in centers:
        if len(center) != dimension or any(not _finite(item) or abs(item) > 100 for item in center):
            raise ValueError("Invalid Gaussian center")
    if not _finite(artifact["width"]) or not 0.05 <= artifact["width"] <= 5 or any(not _finite(item) or not 0 <= item <= 1 for item in consequents):
        raise ValueError("Invalid fuzzy parameters")
    if artifact["threshold"] != 0.5 or artifact["features"] != [field["name"] for field in schema]:
        raise ValueError("Invalid decision protocol")
    if artifact["status"] != ("educational_only" if model_id == MODEL_IDS[0] else "rejected"):
        raise ValueError("Invalid model release status")
    return artifact


@lru_cache(maxsize=2)
def get_artifact(model_id):
    return load_artifact(model_id)


def transform(values: dict, artifact: dict):
    encoded = []
    for field in artifact["schema"]:
        name = field["name"]
        fitted = artifact["preprocessing"][name]
        value = values.get(name)
        if value is None:
            value = fitted["impute"]
        if field["kind"] == "category":
            encoded.extend(float(value == item) for item in fitted["categories"])
        else:
            encoded.append((value - fitted["mean"]) / fitted["scale"])
    return encoded


def predict_raw(values: dict, artifact: dict):
    """Training/audit primitive. HTTP inference separately requires every input."""
    encoded = transform(values, artifact)
    logs = [-sum((a - b) ** 2 for a, b in zip(encoded, center)) / (2 * artifact["width"] ** 2 * len(encoded)) for center in artifact["centers"]]
    maximum = max(logs)
    firing = [math.exp(value - maximum) for value in logs]
    total = sum(firing)
    memberships = [value / total for value in firing]
    score = sum(weight * consequent for weight, consequent in zip(memberships, artifact["consequents"]))
    return max(0.0, min(1.0, score)), memberships


def validate_inputs(model_id, values, units, heart_failure_confirmed=False):
    if model_id not in MODEL_IDS:
        raise IngestionError("Choose an available educational model.", "assessment_input", 422)
    schema = SCHEMAS[model_id]
    names = {field["name"] for field in schema}
    if set(values) != names or set(units) != names:
        raise IngestionError("Supply every listed input and its exact displayed unit. Extra inputs, labels and follow-up fields are refused.", "assessment_input", 422)
    if model_id == MODEL_IDS[1] and heart_failure_confirmed is not True:
        raise IngestionError("The 90-day model is defined only for a cohort with already-confirmed heart failure. Confirm this assumption explicitly.", "assessment_cohort", 422)
    for field in schema:
        value = values[field["name"]]
        if not _finite(value) or units[field["name"]] != field["unit"]:
            raise IngestionError(f"{field['label']}: provide a finite numeric value in {field['unit']}; missing values and unit conversions are not accepted.", "assessment_input", 422)
        valid = value in [item["value"] for item in field["choices"]] if field["kind"] == "category" else field["minimum"] <= value <= field["maximum"]
        if not valid:
            raise IngestionError(f"{field['label']}: value is outside this model's supported dataset range or categories.", "assessment_range", 422)


def public_model(artifact):
    return {key: artifact[key] for key in ("model_id", "version", "title", "target", "horizon_days", "positive_class", "negative_class", "source", "schema", "algorithm", "training", "metrics", "baseline_metrics", "limitations", "cohort", "threshold", "status", "rejection_reason")} | {
        "notice": NOTICE, "score_label": "Uncalibrated educational pattern score",
        "synthetic_example": SYNTHETIC[artifact["model_id"]],
        "synthetic_example_label": "Manually constructed synthetic demonstration; not a patient record or a held-out result.",
        "rules": [{"rule": index + 1, "consequent": value} for index, value in enumerate(artifact["consequents"])],
    }


def evaluate(model_id, values, units, heart_failure_confirmed=False):
    validate_inputs(model_id, values, units, heart_failure_confirmed)
    artifact = get_artifact(model_id)
    if artifact["status"] == "rejected":
        raise IngestionError(artifact["rejection_reason"], "assessment_rejected", 422)
    score, memberships = predict_raw(values, artifact)
    classification = int(score >= artifact["threshold"])
    return {
        "model_id": model_id, "version": artifact["version"], "pattern_score": score,
        "score_label": "Uncalibrated educational pattern score", "dataset_class": classification,
        "class_label": artifact["positive_class"] if classification else artifact["negative_class"],
        "threshold": artifact["threshold"], "target": artifact["target"], "horizon_days": artifact["horizon_days"],
        "inputs": [{"name": field["name"], "value": values[field["name"]], "unit": units[field["name"]]} for field in artifact["schema"]],
        "rules": [{"rule": index + 1, "membership": weight, "consequent": artifact["consequents"][index], "contribution": weight * artifact["consequents"][index]} for index, weight in enumerate(memberships)],
        "notice": NOTICE, "external_calls": False, "stored": False,
    }


class AssessmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    model_id: str = Field(min_length=1, max_length=64)
    values: dict[str, Any] = Field(max_length=13)
    units: dict[str, str] = Field(max_length=13)
    heart_failure_confirmed: StrictBool = False


def install_assessment_api(app: FastAPI):
    from app.hospital.news2 import install_news2_api
    install_news2_api(app)

    @app.get("/api/hospital/assessment/models")
    def models():
        try:
            return {"models": [public_model(get_artifact(identifier)) for identifier in MODEL_IDS], "notice": NOTICE}
        except (ValueError, KeyError, TypeError, OSError, json.JSONDecodeError):
            raise IngestionError("Educational model artifacts are unavailable or failed integrity checks.", "assessment_unavailable", 503) from None

    @app.post("/api/hospital/assessment/evaluate")
    def assess(request: AssessmentRequest):
        try:
            return evaluate(request.model_id, request.values, request.units, request.heart_failure_confirmed)
        except IngestionError:
            raise
        except (ValueError, KeyError, TypeError, OSError, json.JSONDecodeError, OverflowError):
            raise IngestionError("Educational model artifacts are unavailable or failed integrity checks.", "assessment_unavailable", 503) from None
