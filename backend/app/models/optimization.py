from typing import Literal

from pydantic import Field, FiniteFloat, model_validator

from app.models.common import SchemaModel


class OptimizationRequest(SchemaModel):
    algorithm: Literal["GA", "PSO", "GWO", "WOA", "FUZZY_GA", "GA_PSO", "NEURO_FUZZY"] = "GA"
    dataset: Literal["synthetic", "real"] = "synthetic"
    evaluation_budget: int = Field(default=64, ge=8, le=256)
    population_size: int = Field(default=8, ge=4, le=32)
    seed: int = Field(default=17, ge=0, le=2147483647)
    mutation_rate: FiniteFloat = Field(default=.1, ge=0, le=1)
    crossover_rate: FiniteFloat = Field(default=.8, ge=0, le=1)
    selection: Literal["tournament", "roulette"] = "tournament"

    @model_validator(mode="after")
    def population_budget(self):
        if self.population_size > self.evaluation_budget:
            raise ValueError("Population must fit in the evaluation budget")
        return self


class AntSearchRequest(SchemaModel):
    source_entity: str = Field(min_length=1, max_length=100)
    target_entity: str = Field(min_length=1, max_length=100)
    ants: int = Field(default=12, ge=1, le=32)
    iterations: int = Field(default=12, ge=1, le=32)
    max_hops: int = Field(default=5, ge=1, le=10)
    seed: int = Field(default=17, ge=0, le=2147483647)
    directed: bool = False
