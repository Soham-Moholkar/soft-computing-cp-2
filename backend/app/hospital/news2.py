"""Independent factual NEWS2 Scale 1 calculator; does not reproduce the RCP chart."""
import math
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, StrictBool

from app.core.errors import IngestionError

SOURCE = "https://www.rcp.ac.uk/media/alxev00t/news2-chart-1_the-news-scoring-system_0_0.pdf"
REPORT = "https://www.rcp.ac.uk/media/a4ibkkbf/news2-final-report_0_0.pdf"
NOTICE = "Educational NEWS2 Scale 1 arithmetic only. This is an early-warning score, not a disease diagnosis, mortality probability or long-term prognosis. A zero or small score does not establish safety. Clinical interpretation and any response require qualified professional review."
UNITS = {"age": "years", "respiration_rate": "breaths/min", "spo2": "%", "supplemental_oxygen": "category", "systolic_bp": "mm Hg", "pulse": "beats/min", "consciousness": "category", "temperature": "degrees C"}
INTEGER_RANGES = {"age": (18, 130), "respiration_rate": (0, 100), "spo2": (0, 100), "supplemental_oxygen": (0, 1), "systolic_bp": (0, 300), "pulse": (0, 300)}
CONSCIOUSNESS = {"alert", "new_confusion", "voice", "pain", "unresponsive"}


def news2(values, units, not_pregnant_confirmed, scale_1_confirmed):
    if set(values) != set(UNITS) or units != UNITS:
        raise IngestionError("Supply every NEWS2 input in its displayed unit, without extra values or automatic unit conversion.", "news2_input", 422)
    if not_pregnant_confirmed is not True or scale_1_confirmed is not True:
        raise IngestionError("This calculator requires an adult, confirmation that pregnancy is not applicable, and confirmation that SpO2 Scale 2 is not required. It does not support other populations or Scale 2.", "news2_population", 422)
    for name, (minimum, maximum) in INTEGER_RANGES.items():
        if type(values[name]) is not int or not minimum <= values[name] <= maximum:
            raise IngestionError(f"{name}: provide a whole number from {minimum} to {maximum} in {UNITS[name]}.", "news2_input", 422)
    temperature = values["temperature"]
    if type(temperature) not in (int, float) or not 25 <= temperature <= 45 or not math.isfinite(temperature) or abs(temperature * 10 - round(temperature * 10)) > 1e-8:
        raise IngestionError("temperature: provide a finite value from 25.0 to 45.0 degrees C, with at most one decimal place.", "news2_input", 422)
    if type(values["consciousness"]) is not str or values["consciousness"] not in CONSCIOUSNESS:
        raise IngestionError("Select Alert, new confusion, responds to voice, responds to pain or unresponsive.", "news2_input", 422)
    rr, saturation, bp, pulse = (values[name] for name in ("respiration_rate", "spo2", "systolic_bp", "pulse"))
    scores = {
        "respiration_rate": 3 if rr <= 8 or rr >= 25 else 1 if rr <= 11 else 0 if rr <= 20 else 2,
        "spo2": 3 if saturation <= 91 else 2 if saturation <= 93 else 1 if saturation <= 95 else 0,
        "supplemental_oxygen": 2 if values["supplemental_oxygen"] else 0,
        "systolic_bp": 3 if bp <= 90 or bp >= 220 else 2 if bp <= 100 else 1 if bp <= 110 else 0,
        "pulse": 3 if pulse <= 40 or pulse >= 131 else 1 if pulse <= 50 else 0 if pulse <= 90 else 1 if pulse <= 110 else 2,
        "consciousness": 0 if values["consciousness"] == "alert" else 3,
        "temperature": 3 if temperature <= 35 else 1 if temperature <= 36 else 0 if temperature <= 38 else 1 if temperature <= 39 else 2,
    }
    return {"version": "NEWS2-RCP-2017-Scale1-local-1", "title": "NEWS2 early-warning score — Scale 1", "total": sum(scores.values()), "maximum": 20,
            "single_parameter_three": any(value == 3 for value in scores.values()),
            "components": [{"parameter": name, "value": values[name], "unit": UNITS[name], "score": value} for name, value in scores.items()],
            "inputs": values, "units": units, "eligibility": {"age": values["age"], "not_pregnant_confirmed": True, "scale_1_confirmed": True},
            "source_url": SOURCE, "report_url": REPORT, "attribution": "Royal College of Physicians. National Early Warning Score (NEWS) 2. Updated report of a working party. London: RCP, 2017. © Royal College of Physicians 2017.",
            "notice": NOTICE, "stored": False, "external_calls": False}


class News2Request(BaseModel):
    model_config = ConfigDict(extra="forbid")
    values: dict[str, Any] = Field(max_length=8)
    units: dict[str, str] = Field(max_length=8)
    not_pregnant_confirmed: StrictBool
    scale_1_confirmed: StrictBool


def install_news2_api(app):
    @app.post("/api/hospital/assessment/news2")
    def calculate_news2(request: News2Request):
        return news2(request.values, request.units, request.not_pregnant_confirmed, request.scale_1_confirmed)
