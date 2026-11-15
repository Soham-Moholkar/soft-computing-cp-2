import type { FuzzyEvaluationInput, FuzzyEvaluationResult } from '../types.js';

export function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function triangularMembership(x: number, a: number, b: number, c: number): number {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  return x < b ? (x - a) / (b - a) : (c - x) / (c - b);
}

export function trapezoidalMembership(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  return x < b ? (x - a) / (b - a) : (d - x) / (d - c);
}

export function gaussianMembership(x: number, center: number, sigma: number): number {
  if (sigma <= 0) return 0;
  return Math.exp(-0.5 * Math.pow((x - center) / sigma, 2));
}

export function fuzzyUnion(a: number, b: number): number {
  return Math.max(clamp(a), clamp(b));
}

export function fuzzyIntersection(a: number, b: number): number {
  return Math.min(clamp(a), clamp(b));
}

export function fuzzyComplement(value: number): number {
  return 1 - clamp(value);
}

export function centroidDefuzzification(points: Array<{ x: number; membership: number }>): number {
  const denominator = points.reduce((sum, point) => sum + point.membership, 0);
  if (denominator === 0) return 0;
  return points.reduce((sum, point) => sum + point.x * point.membership, 0) / denominator;
}

export function evaluateRetrievalFuzzy(input: FuzzyEvaluationInput): FuzzyEvaluationResult {
  const semanticHigh = clamp((input.semanticSimilarity - 0.45) / 0.55);
  const relationStrong = clamp((input.relationStrength - 0.4) / 0.6);
  const graphNear = clamp(1 - input.graphDistance / 5);
  const semanticMedium = triangularMembership(input.semanticSimilarity, 0.25, 0.55, 0.85);
  const relationModerate = triangularMembership(input.relationStrength, 0.2, 0.55, 0.85);

  const strongRule = Math.min(semanticHigh, relationStrong, graphNear);
  const possibleRule = Math.min(Math.max(semanticMedium, semanticHigh * 0.6), Math.max(relationModerate, graphNear * 0.7));
  const weakRule = Math.max(0.08, 1 - Math.max(semanticHigh, relationStrong));

  const mamdaniScore = clamp((strongRule * 0.93 + possibleRule * 0.65 + weakRule * 0.24) / (strongRule + possibleRule + weakRule));
  const sugenoScore = clamp(0.44 * input.semanticSimilarity + 0.36 * input.relationStrength + 0.2 * graphNear);
  let score = input.inferenceMethod === 'mamdani' ? mamdaniScore : sugenoScore;
  if (input.inferenceMethod === 'mamdani' && input.defuzzificationMethod === 'bisector') score = clamp(score * 0.985 + 0.008);
  if (input.inferenceMethod === 'mamdani' && input.defuzzificationMethod === 'mean-of-maxima') score = clamp(Math.round(score * 10) / 10);

  const label = score >= 0.8 ? 'Highly relevant' : score >= 0.62 ? 'Relevant' : score >= 0.4 ? 'Possible' : 'Irrelevant';
  const controllerDecision = score >= 0.82 ? 'Accept strongly' : score >= 0.64 ? 'Accept weakly' : score >= 0.4 ? 'Review' : 'Reject';

  return {
    score,
    label,
    memberships: {
      semanticHigh,
      semanticMedium,
      relationStrong,
      relationModerate,
      graphNear,
    },
    ruleFirings: [
      { ruleId: 'mock-r1', rule: 'High semantic ∧ strong relation ∧ near path → very high relevance', antecedentMemberships: { semanticHigh, relationStrong, graphNear }, unweightedFiring: strongRule, weight: 1, weightedFiring: strongRule, strength: strongRule, consequent: 'highly_relevant' },
      { ruleId: 'mock-r2', rule: 'Medium semantic ∧ moderate evidence → relevant', antecedentMemberships: { semanticMedium, relationModerate }, unweightedFiring: possibleRule, weight: 1, weightedFiring: possibleRule, strength: possibleRule, consequent: 'relevant' },
      { ruleId: 'mock-r3', rule: 'Weak evidence → low relevance', antecedentMemberships: { semanticHigh, relationStrong }, unweightedFiring: weakRule, weight: 1, weightedFiring: weakRule, strength: weakRule, consequent: 'irrelevant' },
    ],
    controllerDecision,
    aggregatedOutput: Array.from({ length: 101 }, (_, index) => {
      const x = index / 100;
      return { x, membership: clamp(1 - Math.abs(x - score) / 0.2) };
    }),
    variableSetVersion: 'mock-fuzzy-variables-1',
    ruleSetVersion: 'mock-fuzzy-rules-1',
    inferenceMethod: input.inferenceMethod,
    defuzzificationMethod: input.defuzzificationMethod,
    defuzzificationApplied: input.inferenceMethod === 'mamdani',
  };
}
