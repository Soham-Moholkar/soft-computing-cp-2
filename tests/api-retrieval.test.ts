import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ApiClient, ApiError } from '../services/api/client.js';
import { createRestExplanationService, createRestRetrievalService, mapRetrievalResult, type ApiRetrievalResult } from '../services/api/retrieval-service.js';
import { createServices, apiModeMockFallbacks } from '../services/index.js';
import { mockRetrievalService } from '../services/mock/retrieval-service.js';
import { mockHybridService } from '../services/mock/hybrid-service.js';
import { mockExplanationService } from '../services/mock/explanation-service.js';

// Recorded from the persistent backend over authored regression sources.
// No benchmark-quality claim is made for this fixture.
const fixture: ApiRetrievalResult = JSON.parse(readFileSync(new URL('../../sample-data/retrieval-response.json', import.meta.url), 'utf8'));

test('retrieval maps a backend snapshot without inventing source trust or pheromone', () => {
  const mapped = mapRetrievalResult(fixture);
  assert.equal(mapped.answerStatus, 'evidence');
  assert.equal(mapped.graphVersion, fixture.graph_version);
  assert.equal(mapped.resultId, fixture.result_id);
  assert.equal(mapped.evidence[0].chunkId, fixture.evidence[0].chunk_id);
  assert.equal(mapped.evidence[0].excerpt, fixture.evidence[0].excerpt);
  assert.equal(mapped.evidence[0].reliability, null);
  assert.equal(mapped.paths[0].pheromone, undefined);
  assert.deepEqual(mapped.paths[0].citationIds, fixture.paths[0].citation_ids);
  assert.deepEqual(mapped.fuzzyExplanation.ruleFirings[0].antecedentMemberships, fixture.fuzzy_explanation.rule_firings[0].antecedent_memberships);
});

test('retrieval sends query controls and explicit provider opt-in to REST, then reloads the saved result', async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const client = new ApiClient({ baseUrl: 'http://backend.test/api', fetchImplementation: async (input, init) => {
    assert.equal(typeof input, 'string');
    if (init?.body !== undefined && typeof init.body !== 'string') throw new Error('Expected JSON request body');
    requests.push({ url: input as string, body: init?.body ? JSON.parse(init.body) : undefined });
    return Response.json(fixture);
  } });
  const service = createRestRetrievalService(client);
  await service.retrieve({ query: 'PSO', mode: 'hybrid', topK: 3, maxHops: 2, useProvider: true });
  assert.deepEqual(requests[0], { url: 'http://backend.test/api/retrieve', body: { query: 'PSO', mode: 'hybrid', top_k: 3, max_hops: 2, use_provider: true } });
  await service.retrieve({ query: 'ACO', mode: 'lexical', topK: 5, maxHops: 4 });
  assert.equal((requests[1].body as { use_provider: boolean }).use_provider, false);
  await service.getResult!('retrieval-saved');
  assert.equal(requests[2].url, 'http://backend.test/api/retrieval/results/retrieval-saved');
});

test('feedback and explanation use the persisted result ID and reject unsaved results', async () => {
  const requests: unknown[] = [];
  const client = new ApiClient({ fetchImplementation: async (input, init) => {
    if (typeof input !== 'string' || typeof init?.body !== 'string') throw new Error('Expected URL and JSON request body');
    requests.push(JSON.parse(init.body));
    return Response.json(input.endsWith('/explanations') ? { headline: 'Recorded trace', decision_trace: ['BM25 contribution'], alternatives: [] } : { accepted: true, message: 'Saved' });
  } });
  const retrieval = createRestRetrievalService(client);
  await retrieval.submitFeedback('partial', fixture.result_id);
  const explanation = await createRestExplanationService(client).explain(mapRetrievalResult(fixture));
  assert.deepEqual(requests, [{ result_id: fixture.result_id, feedback: 'partial' }, { result_id: fixture.result_id }]);
  assert.deepEqual(explanation.decisionTrace, ['BM25 contribution']);
  await assert.rejects(retrieval.submitFeedback('relevant'), /saved result/);
});

test('insufficient evidence is displayed faithfully and typed API failures propagate', async () => {
  const insufficient = mapRetrievalResult({ ...fixture, answer_status: 'insufficient_evidence', answer: 'Insufficient evidence', evidence: [], paths: [] });
  assert.equal(insufficient.answerStatus, 'insufficient_evidence');
  assert.deepEqual(insufficient.paths, []);
  const client = new ApiClient({ fetchImplementation: async () => Response.json({ code: 'algorithm_unavailable', message: 'ACO is pending', details: {}, request_id: 'request-test' }, { status: 422 }) });
  await assert.rejects(createRestRetrievalService(client).retrieve({ query: 'PSO', mode: 'aco', topK: 5, maxHops: 4 }), (error: unknown) => error instanceof ApiError && error.code === 'algorithm_unavailable');
});

test('API mode replaces retrieval, hybrid retrieval and explanation mocks', () => {
  const api = createServices('api');
  assert.notEqual(api.retrieval, mockRetrievalService);
  assert.notEqual(api.hybrid, mockHybridService);
  assert.notEqual(api.explanation, mockExplanationService);
  assert.deepEqual(apiModeMockFallbacks, []);
});
