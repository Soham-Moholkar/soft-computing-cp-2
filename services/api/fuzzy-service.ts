import type { FuzzyEvaluationInput, FuzzyEvaluationResult } from '../../lib/types.js';
import type { FuzzyService } from '../contracts.js';
import { ApiClient } from './client.js';

export interface ApiFuzzyResult {
  score: number;
  label: FuzzyEvaluationResult['label'];
  memberships: Record<string, number>;
  rule_firings: Array<{
    rule_id: string;
    rule: string;
    antecedent_memberships: Record<string, number>;
    strength: number;
    unweighted_firing: number;
    weight: number;
    weighted_firing: number;
    consequent: string;
  }>;
  aggregated_output: Array<{ x: number; membership: number }>;
  controller_decision: FuzzyEvaluationResult['controllerDecision'];
  variable_set_version: string;
  rule_set_version: string;
  inference_method: FuzzyEvaluationInput['inferenceMethod'];
  defuzzification_method: 'centroid' | 'bisector' | 'mean_of_maxima';
  defuzzification_applied: boolean;
}

function toWireDefuzzification(method: FuzzyEvaluationInput['defuzzificationMethod']): ApiFuzzyResult['defuzzification_method'] {
  return method === 'mean-of-maxima' ? 'mean_of_maxima' : method;
}

export function mapFuzzyResult(response: ApiFuzzyResult): FuzzyEvaluationResult {
  return {
    score: response.score,
    label: response.label,
    memberships: response.memberships,
    ruleFirings: response.rule_firings.map((trace) => ({
      ruleId: trace.rule_id,
      rule: trace.rule,
      strength: trace.strength,
      antecedentMemberships: trace.antecedent_memberships,
      unweightedFiring: trace.unweighted_firing,
      weight: trace.weight,
      weightedFiring: trace.weighted_firing,
      consequent: trace.consequent,
    })),
    controllerDecision: response.controller_decision,
    aggregatedOutput: response.aggregated_output,
    variableSetVersion: response.variable_set_version,
    ruleSetVersion: response.rule_set_version,
    defuzzificationApplied: response.defuzzification_applied,
    inferenceMethod: response.inference_method,
    defuzzificationMethod: response.defuzzification_method === 'mean_of_maxima' ? 'mean-of-maxima' : response.defuzzification_method,
  };
}

export function createRestFuzzyService(client = new ApiClient()): FuzzyService {
  return {
    async evaluate(input: FuzzyEvaluationInput): Promise<FuzzyEvaluationResult> {
      const response = await client.post<ApiFuzzyResult>(
        '/fuzzy/evaluate',
        {
          inputs: {
            semantic_similarity: input.semanticSimilarity,
            relation_strength: input.relationStrength,
            graph_distance: input.graphDistance,
          },
          variable_set_version: 'fuzzy-variables-1',
          rule_set_version: 'fuzzy-rules-1',
          inference_method: input.inferenceMethod,
          defuzzification_method: toWireDefuzzification(input.defuzzificationMethod),
        },
        input.signal,
      );
      return mapFuzzyResult(response);
    },
  };
}
