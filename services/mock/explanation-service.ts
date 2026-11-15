import type { ExplanationService } from '../contracts.js';

export const mockExplanationService: ExplanationService = {
  async explain(result) {
    // TODO(PASS-2): Replace with explainability modules specified in docs/BACKEND_IMPLEMENTATION_PLAN.md.
    return {
      headline: 'Strong semantic alignment and a short reliable graph path produced the final rank.',
      decisionTrace: [
        'Semantic Similarity is HIGH with membership 0.82.',
        'Relation Strength is STRONG with membership 0.80.',
        'Graph Distance is NEAR with membership 0.60.',
        'The very-high relevance rule fired at ' + result.fuzzyExplanation.ruleFirings[0].strength.toFixed(2) + '.',
        'Centroid defuzzification produced ' + result.fuzzyExplanation.score.toFixed(2) + '.',
      ],
      alternatives: result.paths.slice(1).map((path) => ({ path: path.labels.join(' → '), confidence: path.score })),
    };
  },
};
