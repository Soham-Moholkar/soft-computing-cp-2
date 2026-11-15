from dataclasses import dataclass
from functools import lru_cache

from app.fuzzy.membership import trapezoidal, triangular
from app.models.fuzzy import (
    DefuzzificationMethod,
    FuzzyEvaluationRequest,
    FuzzyEvaluationResult,
    InferenceMethod,
    OutputSample,
    RuleTrace,
)


UNIVERSE = tuple(index / 100 for index in range(101))


@dataclass(frozen=True, slots=True)
class Rule:
    identifier: str
    text: str
    consequent: str
    sugeno_value: float
    weight: float
    operator: str
    antecedents: tuple[tuple[str, str], ...]


class FuzzyEngine:
    variable_set_version = "fuzzy-variables-1"
    rule_set_version = "fuzzy-rules-1"

    _rules = (
        Rule("R1", "High semantic AND strong relation AND near path → highly relevant", "highly_relevant", 0.93, 1.0, "and", (("semantic_similarity", "high"), ("relation_strength", "strong"), ("graph_distance", "near"))),
        Rule("R2", "Medium semantic AND moderate relation → relevant", "relevant", 0.70, 0.9, "and", (("semantic_similarity", "medium"), ("relation_strength", "moderate"))),
        Rule("R3", "Low semantic OR weak relation OR far path → irrelevant", "irrelevant", 0.16, 1.0, "or", (("semantic_similarity", "low"), ("relation_strength", "weak"), ("graph_distance", "far"))),
    )

    def _memberships(self, inputs: dict[str, float]) -> dict[str, dict[str, float]]:
        semantic = inputs["semantic_similarity"]
        relation = inputs["relation_strength"]
        distance = inputs["graph_distance"]
        return {
            "semantic_similarity": {"low": trapezoidal(semantic, 0, 0, 0.25, 0.5), "medium": triangular(semantic, 0.25, 0.5, 0.75), "high": trapezoidal(semantic, 0.5, 0.75, 1, 1)},
            "relation_strength": {"weak": trapezoidal(relation, 0, 0, 0.25, 0.5), "moderate": triangular(relation, 0.25, 0.5, 0.75), "strong": trapezoidal(relation, 0.5, 0.75, 1, 1)},
            "graph_distance": {"near": trapezoidal(distance, 1, 1, 1.5, 3), "medium": triangular(distance, 1.5, 3, 4.5), "far": trapezoidal(distance, 3, 4.5, 5, 5)},
        }

    @staticmethod
    def _output_membership(label: str, x: float) -> float:
        definitions = {
            "irrelevant": lambda: trapezoidal(x, 0, 0, 0.15, 0.35),
            "possible": lambda: triangular(x, 0.2, 0.45, 0.65),
            "relevant": lambda: triangular(x, 0.5, 0.7, 0.9),
            "highly_relevant": lambda: trapezoidal(x, 0.75, 0.9, 1, 1),
        }
        return definitions[label]()

    @staticmethod
    @lru_cache(maxsize=4)
    def _output_curve(label: str) -> tuple[float, ...]:
        return tuple(FuzzyEngine._output_membership(label, x) for x in UNIVERSE)

    def centroid_score(self, inputs: dict[str, float]) -> float:
        """Exact fixed-rule centroid for trusted internal ranking signals.

        Avoid constructing 101 output models and full traces for every candidate.
        Public inference still validates inputs and returns the complete trace.
        """
        memberships = self._memberships(inputs)
        strengths = [((min if rule.operator == "and" else max)(memberships[variable][label] for variable, label in rule.antecedents)) * rule.weight for rule in self._rules]
        curves = [self._output_curve(rule.consequent) for rule in self._rules]
        output = [max(min(strength, curve[index]) for strength, curve in zip(strengths, curves)) for index in range(len(UNIVERSE))]
        denominator = sum(output)
        return round(sum(x * membership for x, membership in zip(UNIVERSE, output)) / denominator if denominator else 0, 6)

    def _traces(self, memberships: dict[str, dict[str, float]]) -> list[RuleTrace]:
        traces: list[RuleTrace] = []
        for rule in self._rules:
            antecedents = {f"{variable}.{label}": memberships[variable][label] for variable, label in rule.antecedents}
            values = tuple(antecedents.values())
            unweighted = min(values) if rule.operator == "and" else max(values)
            # Rule weights are a multiplicative attenuation policy. Both terms
            # are in [0, 1], so the weighted firing remains bounded.
            weighted = unweighted * rule.weight
            traces.append(RuleTrace(rule_id=rule.identifier, rule=rule.text, antecedent_memberships=antecedents, unweighted_firing=unweighted, weight=rule.weight, weighted_firing=weighted, strength=weighted, consequent=rule.consequent))
        return traces

    @staticmethod
    def _centroid(output: list[OutputSample]) -> float:
        denominator = sum(point.membership for point in output)
        return sum(point.x * point.membership for point in output) / denominator if denominator else 0.0

    @staticmethod
    def _bisector(output: list[OutputSample]) -> float:
        total = sum(point.membership for point in output)
        if not total:
            return 0.0
        cumulative = 0.0
        for point in output:
            cumulative += point.membership
            if cumulative >= total / 2:
                return point.x
        return output[-1].x

    @staticmethod
    def _mean_of_maxima(output: list[OutputSample]) -> float:
        maximum = max((point.membership for point in output), default=0.0)
        maxima = [point.x for point in output if point.membership == maximum]
        return sum(maxima) / len(maxima) if maximum and maxima else 0.0

    def _mamdani_output(self, traces: list[RuleTrace]) -> list[OutputSample]:
        by_rule = dict(zip(self._rules, traces))
        curves = {rule.consequent: self._output_curve(rule.consequent) for rule in self._rules}
        return [OutputSample(x=x, membership=max(min(by_rule[rule].strength, curves[rule.consequent][index]) for rule in self._rules)) for index, x in enumerate(UNIVERSE)]

    def _sugeno_output(self, traces: list[RuleTrace]) -> tuple[float, list[OutputSample]]:
        weighted = [trace.strength * rule.sugeno_value for rule, trace in zip(self._rules, traces)]
        denominator = sum(trace.strength for trace in traces)
        score = sum(weighted) / denominator if denominator else 0.0
        output = []
        for x in UNIVERSE:
            membership = max((trace.strength for rule, trace in zip(self._rules, traces) if abs(x - rule.sugeno_value) < 0.005), default=0.0)
            output.append(OutputSample(x=x, membership=membership))
        return score, output

    @staticmethod
    def _label(score: float) -> str:
        return "Highly relevant" if score >= 0.8 else "Relevant" if score >= 0.62 else "Possible" if score >= 0.4 else "Irrelevant"

    @staticmethod
    def _decision(score: float) -> str:
        return "Accept strongly" if score >= 0.82 else "Accept weakly" if score >= 0.64 else "Review" if score >= 0.4 else "Reject"

    def evaluate(self, request: FuzzyEvaluationRequest) -> FuzzyEvaluationResult:
        memberships = self._memberships(request.inputs)
        traces = self._traces(memberships)
        flattened = {f"{variable}_{label}": value for variable, labels in memberships.items() for label, value in labels.items()}
        defuzzification_applied = request.inference_method == InferenceMethod.MAMDANI
        if defuzzification_applied:
            output = self._mamdani_output(traces)
            score = {
                DefuzzificationMethod.CENTROID: self._centroid,
                DefuzzificationMethod.BISECTOR: self._bisector,
                DefuzzificationMethod.MEAN_OF_MAXIMA: self._mean_of_maxima,
            }[request.defuzzification_method](output)
        else:
            score, output = self._sugeno_output(traces)
        return FuzzyEvaluationResult(
            score=round(score, 6), label=self._label(score), memberships=flattened, rule_firings=traces,
            aggregated_output=output, controller_decision=self._decision(score),
            variable_set_version=self.variable_set_version, rule_set_version=self.rule_set_version,
            inference_method=request.inference_method, defuzzification_method=request.defuzzification_method,
            defuzzification_applied=defuzzification_applied,
        )
