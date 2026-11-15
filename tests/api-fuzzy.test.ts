import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClient, ApiError } from '../services/api/client.js';
import { createRestFuzzyService, mapFuzzyResult } from '../services/api/fuzzy-service.js';
import { apiModeMockFallbacks, createServices } from '../services/index.js';
import { mockFuzzyService } from '../services/mock/fuzzy-service.js';

const fuzzyResponse = {
  score: 0.82,
  label: 'Highly relevant' as const,
  memberships: { semantic_similarity_high: 0.9 },
  rule_firings: [{ rule_id: 'R1', rule: 'High semantic → highly relevant', antecedent_memberships: { semantic_similarity_high: 0.8 }, strength: 0.8, unweighted_firing: 0.8, weight: 1, weighted_firing: 0.8, consequent: 'highly_relevant' }],
  aggregated_output: [{ x: 0, membership: 0 }, { x: 1, membership: 0.8 }],
  controller_decision: 'Accept strongly' as const,
  variable_set_version: 'fuzzy-variables-1',
  rule_set_version: 'fuzzy-rules-1',
  inference_method: 'mamdani' as const,
  defuzzification_method: 'bisector' as const,
  defuzzification_applied: true,
};

test('REST fuzzy adapter maps control values to canonical snake_case payloads and maps traces back', async () => {
  let request: RequestInit | undefined;
  const fetchImplementation: typeof fetch = async (_input, init) => {
    request = init;
    return new Response(JSON.stringify(fuzzyResponse), { headers: { 'content-type': 'application/json' } });
  };
  const service = createRestFuzzyService(new ApiClient({ baseUrl: 'http://backend.test/api', fetchImplementation }));
  const result = await service.evaluate({ semanticSimilarity: 0.91, relationStrength: 0.83, graphDistance: 1.6, inferenceMethod: 'mamdani', defuzzificationMethod: 'bisector' });
  const body = request?.body;
  assert.equal(typeof body, 'string');
  if (typeof body !== 'string') throw new Error('Expected a JSON payload.');
  assert.deepEqual(JSON.parse(body), {
    inputs: { semantic_similarity: 0.91, relation_strength: 0.83, graph_distance: 1.6 },
    variable_set_version: 'fuzzy-variables-1', rule_set_version: 'fuzzy-rules-1',
    inference_method: 'mamdani', defuzzification_method: 'bisector',
  });
  assert.equal(result.ruleFirings[0].weightedFiring, 0.8);
  assert.equal(result.ruleFirings[0].ruleId, 'R1');
  assert.deepEqual(result.ruleFirings[0].antecedentMemberships, { semantic_similarity_high: 0.8 });
  assert.equal(result.controllerDecision, 'Accept strongly');
  assert.equal(result.defuzzificationApplied, true);
  assert.equal(result.defuzzificationMethod, 'bisector');
});

test('mean-of-maxima maps to the backend underscore wire enum', async () => {
  let request: RequestInit | undefined;
  const service = createRestFuzzyService(new ApiClient({
    baseUrl: 'http://backend.test/api',
    fetchImplementation: async (_input, init) => {
      request = init;
      return new Response(JSON.stringify(fuzzyResponse));
    },
  }));
  await service.evaluate({ semanticSimilarity: 0.5, relationStrength: 0.5, graphDistance: 3, inferenceMethod: 'mamdani', defuzzificationMethod: 'mean-of-maxima' });
  const body = request?.body;
  assert.equal(typeof body, 'string');
  if (typeof body !== 'string') throw new Error('Expected a JSON payload.');
  assert.equal(JSON.parse(body).defuzzification_method, 'mean_of_maxima');
});

test('fuzzy adapter preserves typed API errors and maps canonical display values', async () => {
  const client = new ApiClient({
    baseUrl: 'http://backend.test/api',
    fetchImplementation: async () => new Response(JSON.stringify({ code: 'validation_error', message: 'Invalid fuzzy inputs', details: {}, request_id: 'req-fuzzy' }), { status: 422 }),
  });
  await assert.rejects(createRestFuzzyService(client).evaluate({ semanticSimilarity: 2, relationStrength: 0.8, graphDistance: 1, inferenceMethod: 'mamdani', defuzzificationMethod: 'centroid' }), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'validation_error');
    return true;
  });
  assert.equal(mapFuzzyResult(fuzzyResponse).label, 'Highly relevant');
});

test('API mode uses REST fuzzy evaluation and has no API-mode mock fallbacks', () => {
  const apiServices = createServices('api', { baseUrl: 'http://backend.test/api', fetchImplementation: async () => new Response('{}') });
  assert.deepEqual(apiModeMockFallbacks, []);
  assert.notEqual(apiServices.fuzzy, mockFuzzyService);
});
