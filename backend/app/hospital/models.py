from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, field_validator


class Observation(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str = Field(min_length=1, max_length=160)
    value: str | FiniteFloat = Field(union_mode="left_to_right")
    unit: str = Field(default="", max_length=80)

    @field_validator("value")
    @classmethod
    def bounded_value(cls, value):
        if isinstance(value, str) and len(value) > 2000:
            raise ValueError("Observation value is too long")
        return value


class Condition(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str = Field(min_length=1, max_length=160)
    status: Literal["confirmed", "suspected", "negated", "historical"]
    detail: str = Field(default="", max_length=2000)


class EncounterRecord(BaseModel):
    model_config = ConfigDict(extra="allow")
    patient_id: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9][A-Za-z0-9_.:-]*$")
    encounter_id: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9][A-Za-z0-9_.:-]*$")
    recorded_at: datetime
    patient_label: str = Field(default="", max_length=160)
    observations: list[Observation] = Field(default_factory=list, max_length=50)
    conditions: list[Condition] = Field(default_factory=list, max_length=50)
    care_plan: str = Field(default="", max_length=10000)
    prognosis_note: str = Field(default="", max_length=10000)
    notes: str = Field(default="", max_length=10000)

    @field_validator("recorded_at", mode="before")
    @classmethod
    def explicit_date(cls, value):
        if not isinstance(value, str) or len(value) < 10 or value[4:5] != "-" or value[7:8] != "-":
            raise ValueError("Use an ISO date or timestamp")
        return value


class EvidenceQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    patient_id: str = Field(min_length=1, max_length=100)
    question: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=5, ge=1, le=10)
