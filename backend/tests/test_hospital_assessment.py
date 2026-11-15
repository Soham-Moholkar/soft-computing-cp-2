import hashlib
import json
import math
import statistics

import pytest
from fastapi.testclient import TestClient

from app.core.errors import IngestionError
from app.factory import create_app
from app.hospital.assessment import MODEL_IDS, ROOT, SCHEMAS, SYNTHETIC, evaluate, get_artifact, install_assessment_api, load_artifact, predict_raw, transform
from app.hospital.train_assessment import fixed_horizon_label, grouped_split, input_group, load_dataset, metrics
from app.hospital.news2 import UNITS as NEWS_UNITS, news2


def units(identifier):
    return {field["name"]: field["unit"] for field in SCHEMAS[identifier]}


def test_fixed_90_day_target_handles_censoring_and_horizon_boundary():
    assert fixed_horizon_label(89, 0) is None
    assert fixed_horizon_label(90, 0) == 0
    assert fixed_horizon_label(90, 1) == 1
    assert fixed_horizon_label(91, 1) == 0
    assert fixed_horizon_label(2, 1) == 1
    rows, labels, cohort = load_dataset(MODEL_IDS[1])
    assert cohort["source_rows"] == 299
    assert len(rows) == len(labels) == 256
    assert cohort["excluded_censored_before_90_days"] == 43
    assert set(cohort["excluded_source_indices"]).isdisjoint(cohort["eligible_source_indices"])
    assert all("time" not in row and "DEATH_EVENT" not in row for row in rows)


@pytest.mark.parametrize("identifier", MODEL_IDS)
def test_grouped_splits_have_no_identical_input_leakage_and_preprocessing_is_train_only(identifier):
    artifact = get_artifact(identifier)
    rows, labels, _ = load_dataset(identifier)
    split, _ = grouped_split(rows, labels)
    assert split == artifact["split_indices"]
    seen = set()
    for indices in split.values():
        groups = {input_group(rows[index]) for index in indices}
        assert seen.isdisjoint(groups)
        seen.update(groups)
    assert sorted(index for indices in split.values() for index in indices) == list(range(len(rows)))
    for field in SCHEMAS[identifier]:
        name = field["name"]
        fitted = artifact["preprocessing"][name]
        observed = [rows[index][name] for index in split["train"] if rows[index][name] is not None]
        if field["kind"] == "number":
            assert fitted["impute"] == statistics.median(observed)
            filled = [rows[index][name] if rows[index][name] is not None else fitted["impute"] for index in split["train"]]
            assert fitted["mean"] == pytest.approx(statistics.mean(filled))
            assert fitted["scale"] == pytest.approx(statistics.pstdev(filled))
        else:
            assert fitted["categories"] == [choice["value"] for choice in field["choices"]]
            assert fitted["impute"] == min(fitted["categories"], key=lambda value: (-observed.count(value), value))
    assert not {"time", "DEATH_EVENT", "num"} & set(artifact["features"])


def test_duplicate_inputs_with_conflicting_targets_are_kept_together():
    rows = [{"age": float(index)} for index in range(30)] + [{"age": 5.0}]
    labels = [index % 2 for index in range(30)] + [0]
    split, info = grouped_split(rows, labels)
    assert info["duplicate_rows"] == 1
    assert info["conflicting_label_groups"] == 1
    assert any(5 in indices and 30 in indices for indices in split.values())


@pytest.mark.parametrize("identifier", MODEL_IDS)
def test_held_out_scores_metrics_and_constant_baseline_recompute_from_source(identifier):
    artifact = get_artifact(identifier)
    rows, labels, _ = load_dataset(identifier)
    test_labels = [labels[index] for index in artifact["split_indices"]["test"]]
    scores = [predict_raw(rows[index], artifact)[0] for index in artifact["split_indices"]["test"]]
    assert scores == pytest.approx(artifact["held_out_audit"]["scores"], abs=1e-12)
    assert test_labels == artifact["held_out_audit"]["labels"]
    actual = metrics(test_labels, scores)
    for key, value in actual.items():
        assert value == pytest.approx(artifact["metrics"][key])
    train_prevalence = statistics.mean(labels[index] for index in artifact["split_indices"]["train"])
    baseline = metrics(test_labels, [train_prevalence] * len(test_labels))
    assert baseline == artifact["baseline_metrics"]


@pytest.mark.parametrize("identifier", MODEL_IDS)
def test_local_inference_is_deterministic_bounded_and_has_auditable_rule_contributions(identifier):
    if identifier == MODEL_IDS[1]:
        score, firing = predict_raw(SYNTHETIC[identifier], get_artifact(identifier))
        assert (score, firing) == predict_raw(SYNTHETIC[identifier], get_artifact(identifier))
        assert 0 <= score <= 1 and sum(firing) == pytest.approx(1)
        with pytest.raises(IngestionError) as failure:
            evaluate(identifier, SYNTHETIC[identifier], units(identifier), True)
        assert failure.value.code == 'assessment_rejected'
        return
    result = evaluate(identifier, SYNTHETIC[identifier], units(identifier), True)
    assert result == evaluate(identifier, SYNTHETIC[identifier], units(identifier), True)
    assert 0 <= result["pattern_score"] <= 1
    assert sum(rule["membership"] for rule in result["rules"]) == pytest.approx(1)
    assert sum(rule["contribution"] for rule in result["rules"]) == pytest.approx(result["pattern_score"])
    assert not result["external_calls"] and not result["stored"]
    assert "not a calibrated patient probability" in result["notice"]
    assert result["horizon_days"] == (90 if identifier == MODEL_IDS[1] else None)


@pytest.mark.parametrize("mutation", ["missing", "extra_label", "range", "units", "nan", "boolean", "huge_integer", "category"])
def test_missing_extra_nonfinite_wrong_unit_and_out_of_range_inputs_are_refused(mutation):
    identifier = MODEL_IDS[0]
    values, unit_values = SYNTHETIC[identifier].copy(), units(identifier)
    if mutation == "missing": values.pop("chol")
    elif mutation == "extra_label": values["num"] = 4
    elif mutation == "range": values["age"] = 100
    elif mutation == "units": unit_values["chol"] = "mmol/L"
    elif mutation == "nan": values["oldpeak"] = math.nan
    elif mutation == "boolean": values["sex"] = True
    elif mutation == "huge_integer": values["age"] = 10 ** 1000
    elif mutation == "category": values["thal"] = 4
    with pytest.raises(IngestionError) as failure:
        evaluate(identifier, values, unit_values)
    assert failure.value.status == 422


def test_prognosis_refuses_unknown_cohort_and_follow_up_inputs():
    identifier = MODEL_IDS[1]
    with pytest.raises(IngestionError, match="already-confirmed"):
        evaluate(identifier, SYNTHETIC[identifier], units(identifier))
    with pytest.raises(IngestionError, match="Extra inputs"):
        evaluate(identifier, SYNTHETIC[identifier] | {"time": 99}, units(identifier), True)


def test_categories_are_one_hot_not_ordinal():
    artifact = get_artifact(MODEL_IDS[0])
    left = transform(SYNTHETIC[MODEL_IDS[0]] | {"cp": 1}, artifact)
    right = transform(SYNTHETIC[MODEL_IDS[0]] | {"cp": 4}, artifact)
    assert sum(abs(a - b) for a, b in zip(left, right)) == 2
    assert len(left) == sum(len(field["choices"]) if field["kind"] == "category" else 1 for field in SCHEMAS[MODEL_IDS[0]])


def test_artifact_corruption_and_invalid_gaussian_parameters_are_refused(tmp_path):
    identifier = MODEL_IDS[0]
    path = tmp_path / f"{identifier}.json"
    path.write_bytes((ROOT / "artifacts" / path.name).read_bytes() + b" ")
    manifest = json.loads((ROOT / "artifacts" / "manifest.json").read_text())
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="checksum"):
        load_artifact(identifier, tmp_path)
    artifact = get_artifact(identifier).copy()
    artifact["width"] = 0
    raw = json.dumps(artifact).encode()
    path.write_bytes(raw)
    manifest[identifier] = hashlib.sha256(raw).hexdigest()
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="fuzzy parameters"):
        load_artifact(identifier, tmp_path)


def test_api_catalog_exposes_failure_metrics_and_validates_complete_request(tmp_path):
    app = create_app(database_path=str(tmp_path / "assessment.sqlite3"), enable_optimizers=False)
    install_assessment_api(app)
    with TestClient(app) as client:
        catalog = client.get("/api/hospital/assessment/models")
        assert catalog.status_code == 200
        models = catalog.json()["models"]
        assert len(models) == 2
        assert models[1]["metrics"]["sensitivity"] == 0
        assert models[1]["status"] == 'rejected'
        assert models[1]["metrics"]["false_negative"] == 14
        assert "baseline_metrics" in models[1]
        rejected = client.post('/api/hospital/assessment/evaluate', json={'model_id': MODEL_IDS[1], 'values': SYNTHETIC[MODEL_IDS[1]], 'units': units(MODEL_IDS[1]), 'heart_failure_confirmed': True})
        assert rejected.status_code == 422
        assert rejected.json()['code'] == 'assessment_rejected'
        identifier = MODEL_IDS[0]
        request = {"model_id": identifier, "values": SYNTHETIC[identifier], "units": units(identifier)}
        assert client.post("/api/hospital/assessment/evaluate", json=request).status_code == 200
        assert client.post("/api/hospital/assessment/evaluate", json=request | {"automatic_care_plan": True}).status_code == 422
        request["values"] = {"age": 55}
        assert client.post("/api/hospital/assessment/evaluate", json=request).status_code == 422


NEWS_EXAMPLE = dict(age=40, respiration_rate=16, spo2=98, supplemental_oxygen=0, systolic_bp=120, pulse=80, consciousness='alert', temperature=36.8)


@pytest.mark.parametrize(('parameter', 'value', 'expected'), [
    *[('respiration_rate', value, score) for value, score in [(0, 3), (8, 3), (9, 1), (11, 1), (12, 0), (20, 0), (21, 2), (24, 2), (25, 3), (100, 3)]],
    *[('spo2', value, score) for value, score in [(0, 3), (91, 3), (92, 2), (93, 2), (94, 1), (95, 1), (96, 0), (100, 0)]],
    *[('systolic_bp', value, score) for value, score in [(0, 3), (90, 3), (91, 2), (100, 2), (101, 1), (110, 1), (111, 0), (219, 0), (220, 3), (300, 3)]],
    *[('pulse', value, score) for value, score in [(0, 3), (40, 3), (41, 1), (50, 1), (51, 0), (90, 0), (91, 1), (110, 1), (111, 2), (130, 2), (131, 3), (300, 3)]],
    *[('temperature', value, score) for value, score in [(25, 3), (35.0, 3), (35.1, 1), (36.0, 1), (36.1, 0), (38.0, 0), (38.1, 1), (39.0, 1), (39.1, 2), (45, 2)]],
    ('supplemental_oxygen', 0, 0), ('supplemental_oxygen', 1, 2),
    *[('consciousness', value, score) for value, score in [('alert', 0), ('new_confusion', 3), ('voice', 3), ('pain', 3), ('unresponsive', 3)]],
])
def test_news2_all_published_scale1_bin_boundaries(parameter, value, expected):
    result = news2(NEWS_EXAMPLE | {parameter: value}, NEWS_UNITS.copy(), True, True)
    scored = {item['parameter']: item['score'] for item in result['components']}
    assert scored[parameter] == expected
    assert result['total'] == expected
    assert result['single_parameter_three'] is (expected == 3)


def test_news2_maximum_and_zero_do_not_generate_probabilities_or_a_care_plan():
    maximum = NEWS_EXAMPLE | dict(respiration_rate=8, spo2=90, supplemental_oxygen=1, systolic_bp=90, pulse=40, consciousness='new_confusion', temperature=35)
    result = news2(maximum, NEWS_UNITS.copy(), True, True)
    assert result['total'] == result['maximum'] == 20
    assert result['single_parameter_three'] is True
    zero = news2(NEWS_EXAMPLE.copy(), NEWS_UNITS.copy(), True, True)
    assert zero['total'] == 0
    assert 'does not establish safety' in zero['notice']
    assert not {'probability', 'medication', 'care_plan', 'triage_plan'} & set(zero)


@pytest.mark.parametrize('change', ['missing', 'units', 'pregnancy', 'scale2', 'age', 'fraction', 'temperature_precision', 'temperature_nan', 'temperature_overflow', 'boolean', 'consciousness'])
def test_news2_refuses_incomplete_ineligible_and_incompatible_measurements(change):
    values, unit_values = NEWS_EXAMPLE.copy(), NEWS_UNITS.copy()
    not_pregnant = scale1 = True
    if change == 'missing': values.pop('spo2')
    elif change == 'units': unit_values['temperature'] = 'degrees F'
    elif change == 'pregnancy': not_pregnant = False
    elif change == 'scale2': scale1 = False
    elif change == 'age': values['age'] = 17
    elif change == 'fraction': values['pulse'] = 79.5
    elif change == 'temperature_precision': values['temperature'] = 36.01
    elif change == 'temperature_nan': values['temperature'] = math.nan
    elif change == 'temperature_overflow': values['temperature'] = 10 ** 1000
    elif change == 'boolean': values['supplemental_oxygen'] = True
    elif change == 'consciousness': values['consciousness'] = 'unknown'
    with pytest.raises(IngestionError) as failure:
        news2(values, unit_values, not_pregnant, scale1)
    assert failure.value.status == 422


def test_assessment_and_news2_respect_signed_session_workspace_and_reader_permissions(tmp_path):
    from app.platform import create_platform_app
    from app.operations.auth import AuthSettings
    key, other = 'reader-' + 'r' * 40, 'other-' + 'o' * 40
    auth = AuthSettings({'reader': {'key': key, 'role': 'reader', 'workspaces': ['healthcare']}, 'other': {'key': other, 'role': 'editor', 'workspaces': ['course']}}, secret='s' * 40)
    prefix = '/workspaces/healthcare/api/hospital/assessment'
    with TestClient(create_platform_app(str(tmp_path / 'course.sqlite3'), auth, enable_optimizers=False)) as client:
        assert client.get(prefix + '/models').status_code == 401
        login = client.post('/api/auth/session', json={'access_key': key}, headers={'origin': 'http://localhost:3000'})
        assert login.status_code == 200 and 'HttpOnly' in login.headers['set-cookie']
        assert client.get(prefix + '/models').status_code == 200
        request = {'model_id': MODEL_IDS[0], 'values': SYNTHETIC[MODEL_IDS[0]], 'units': units(MODEL_IDS[0])}
        assert client.post(prefix + '/evaluate', json=request).status_code == 403
        assert client.post(prefix + '/evaluate', json=request, headers={'origin': 'http://localhost:3000'}).status_code == 200
        news_request = {'values': NEWS_EXAMPLE, 'units': NEWS_UNITS, 'not_pregnant_confirmed': True, 'scale_1_confirmed': True}
        assert client.post(prefix + '/news2', json=news_request, headers={'origin': 'http://localhost:3000'}).status_code == 200
        assert client.get(prefix + '/models', headers={'authorization': 'Bearer ' + other}).status_code == 403
        assert client.get('/api/hospital/assessment/models').status_code == 403
