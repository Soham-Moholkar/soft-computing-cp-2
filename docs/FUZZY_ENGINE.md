# Fuzzy Engine Specification

## Membership functions

Triangular:

    μ(x;a,b,c) = max(min((x-a)/(b-a), (c-x)/(c-b)), 0)

Trapezoidal:

    μ(x;a,b,c,d) = max(min((x-a)/(b-a), 1, (d-x)/(d-c)), 0)

Gaussian:

    μ(x;c,σ) = exp(-(x-c)² / (2σ²))

Functions validate ordered parameters. The allowed shoulder cases below avoid zero-width division; fully degenerate support is rejected.

## Set operations

- Union: max(μA, μB)
- Intersection: min(μA, μB)
- Complement: 1 − μA

## Implemented reference variable and rule sets

The REST-backed reference slice accepts exactly three inputs: `semantic_similarity` and `relation_strength` in [0, 1], and `graph_distance` in [1, 5]. It uses the fixed versions `variable_set_version: fuzzy-variables-1` and `rule_set_version: fuzzy-rules-1`; other version identifiers are rejected. Input memberships are low/medium/high for semantic similarity, weak/moderate/strong for relation strength, and near/medium/far for graph distance. Output labels are irrelevant, possible, relevant and highly relevant.

The fixed rules are:

- R1: high semantic AND strong relation AND near path → highly relevant (weight 1.0; Sugeno consequent 0.93)
- R2: medium semantic AND moderate relation → relevant (weight 0.9; Sugeno consequent 0.70)
- R3: low semantic OR weak relation OR far path → irrelevant (weight 1.0; Sugeno consequent 0.16)

Custom variable/rule definitions and configuration persistence are deferred.

## Membership functions and shoulder policy

The reference implementation supports triangular, trapezoidal and Gaussian definitions. Ordered parameters and finite values are required; Gaussian sigma must be positive. Shoulders are valid when the appropriate adjacent points are equal (`b=a` for a triangular left shoulder, `b=c` for a triangular right shoulder, `a=b` for a trapezoidal left shoulder, or `c=d` for a trapezoidal right shoulder), and are evaluated without zero-width division. Fully degenerate support (`a=c` for a triangle or `a=d` for a trapezoid) is rejected.

## Rule evaluation

AND uses minimum by default, OR uses maximum and NOT uses complement. In the implemented reference rules, rule weight is a multiplicative attenuation: `weighted_firing = unweighted_firing × weight`. The trace records antecedent memberships, unweighted firing, rule weight, weighted firing, strength and consequent.

Example:

    IF SemanticSimilarity IS High
    AND RelationStrength IS Strong
    AND GraphDistance IS Near
    THEN QueryRelevance IS VeryHigh

## Mamdani

Fuzzify inputs, evaluate rules, clip or scale output sets, aggregate by maximum and defuzzify. Centroid is the default, with bisector and mean of maxima selectable. The wire enum for mean of maxima is `mean_of_maxima`.

Centroid:

    z* = integral(z·μ(z)) / integral(μ(z))

## Sugeno

The implemented reference uses fixed constant consequents (0.93, 0.70 and 0.16). Defuzzification is not applied for Sugeno; the score is the weighted average:

    z* = Σ wi·zi / Σ wi

## Fuzzy graph controller

Inputs are extraction confidence, source quality, semantic consistency and evidence frequency. Output actions are Reject, Review, AcceptWeakly and AcceptStrongly. Thresholds are presentation labels over the fuzzy output, not replacements for it.

## Python interfaces

- MembershipFunction.evaluate(x) → float
- FuzzyVariable.memberships(x) → mapping
- Rule.evaluate(inputs) → RuleTrace
- MamdaniEngine.evaluate(request) → FuzzyResult
- SugenoEngine.evaluate(request) → FuzzyResult
- FuzzyController.decide(signals) → ControllerDecision

The REST response includes `schema_version`, `score`, `label`, flattened `memberships`, `rule_firings`, `aggregated_output`, `controller_decision`, both version fields, `inference_method`, `defuzzification_method` and `defuzzification_applied`. The aggregated output is sampled at 101 points from 0 through 1. Implementation belongs in backend/app/fuzzy and follows docs/API_CONTRACTS.md.
