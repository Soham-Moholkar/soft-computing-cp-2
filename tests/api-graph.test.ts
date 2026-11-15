import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClient, ApiError } from '../services/api/client.js';
import { createRestGraphService, mapGraphResponse } from '../services/api/graph-service.js';
import { apiModeMockFallbacks, createServices, resolveServiceMode } from '../services/index.js';

const graphPayload = {
  entities: [
    { entity_id: 'entity-b', canonical_name: 'Beta', entity_type: 'Technology', aliases: [], description: 'b', source_chunks: ['chunk-b'], extraction_confidence: 0.8, fuzzy_confidence: 0.7, centrality_score: 0.6, importance_score: 0.5, embedding_reference: null },
    { entity_id: 'entity-a', canonical_name: 'Alpha', entity_type: 'Concept', aliases: ['A'], description: 'a', source_chunks: ['chunk-a'], extraction_confidence: 0.9, fuzzy_confidence: 0.8, centrality_score: 0.7, importance_score: 0.6, embedding_reference: 'embed-a' },
    { entity_id: 'entity-c', canonical_name: 'Gamma', entity_type: 'Process', aliases: [], description: 'c', source_chunks: ['chunk-c'], extraction_confidence: 0.7, fuzzy_confidence: 0.6, centrality_score: 0.5, importance_score: 0.4, embedding_reference: null },
  ],
  relations: [
    { relation_id: 'relation-ab', source_entity: 'entity-a', target_entity: 'entity-b', relation_type: 'supports', evidence: 'a to b', source_chunk: 'chunk-a', extraction_confidence: 0.9, fuzzy_strength: 0.8, semantic_strength: 0.7, temporal_strength: 1, final_weight: 0.8 },
    { relation_id: 'relation-bc', source_entity: 'entity-b', target_entity: 'entity-c', relation_type: 'supports', evidence: 'b to c', source_chunk: 'chunk-b', extraction_confidence: 0.8, fuzzy_strength: 0.7, semantic_strength: 0.6, temporal_strength: 1, final_weight: 0.7 },
  ],
  next_cursor: null,
};

function jsonFetch(body: unknown, status = 200): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('REST graph mapping converts snake case and assigns stable layout coordinates', () => {
  const first = mapGraphResponse(graphPayload);
  const second = mapGraphResponse(graphPayload);
  assert.deepEqual(first, second);
  assert.deepEqual(first.entities.map((entity) => entity.entityId), ['entity-a', 'entity-b', 'entity-c']);
  assert.equal(first.entities[0].embeddingReference, 'embed-a');
  assert.equal(first.entities[1].embeddingReference, '');
  assert.ok(first.entities.every((entity) => Number.isFinite(entity.x) && Number.isFinite(entity.y)));
  assert.equal(first.relations[0].sourceEntity, 'entity-a');
  assert.equal(first.relations[0].fuzzyStrength, 0.8);
});

test('REST graph service requests bounded paths from the persistent backend', async () => {
  const requests: string[] = [];
  const fetchImplementation: typeof fetch = async (input) => {
    requests.push(input instanceof Request ? input.url : input instanceof URL ? input.href : input);
    return Response.json({ nodes: [graphPayload.entities[1], graphPayload.entities[0], graphPayload.entities[2]] });
  };
  const service = createRestGraphService(new ApiClient({ baseUrl: 'http://backend.test/api/', fetchImplementation }));
  assert.deepEqual(await service.shortestPath('entity-a', 'entity-c'), ['entity-a', 'entity-b', 'entity-c']);
  assert.equal(requests[0], 'http://backend.test/api/graph/path');
});

test('graph adapter retrieves edges connecting entities on separate pages', async () => {
  const requests: string[] = [];
  const service = createRestGraphService(new ApiClient({ fetchImplementation: async (input) => {
    const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
    requests.push(url);
    if (url.includes('/relations')) return Response.json({ graph_version: 'graph-sqlite-2', relations: graphPayload.relations, next_cursor: null });
    return Response.json({ graph_version: 'graph-sqlite-2', entities: url.includes('cursor=') ? [graphPayload.entities[0], graphPayload.entities[2]] : [graphPayload.entities[1]], relations: [], next_cursor: url.includes('cursor=') ? null : 'entity-a' });
  } }));
  const graph = await service.getGraph();
  assert.equal(graph.entities.length, 3);
  assert.equal(graph.relations.length, 2);
  assert.equal(graph.graphVersion, 'graph-sqlite-2');
  assert.ok(requests[2].includes('/graph/relations'));
});

test('graph loading rejects mixed graph versions across pages', async () => {
  let calls = 0;
  const service = createRestGraphService(new ApiClient({ fetchImplementation: async () => Response.json({ ...graphPayload, graph_version: `graph-sqlite-${++calls}`, next_cursor: calls === 1 ? 'entity-a' : null }) }));
  await assert.rejects(service.getGraph(), /changed while loading/);
});

test('graph build maps options and preserves dry-run and mutation counts', async () => {
  let payload: unknown;
  const service = createRestGraphService(new ApiClient({ fetchImplementation: async (_input, init) => {
    assert.equal(typeof init?.body, 'string');
    payload = JSON.parse(init?.body as string);
    return Response.json({ graph_version: 'graph-sqlite-1', added_nodes: 2, updated_nodes: 1, removed_nodes: 0, added_relations: 1, updated_relations: 0, removed_relations: 0, review_count: 3, changed: true, dry_run: true, warnings: ['Heuristic scores'] });
  } }));
  const result = await service.build!(['document-1'], { dryRun: true, entityThreshold: 0.9 });
  assert.deepEqual(payload, { document_ids: ['document-1'], dry_run: true, entity_threshold: 0.9, relation_threshold: 0.75 });
  assert.equal(result.addedNodes, 2);
  assert.equal(result.reviewCount, 3);
  assert.equal(result.dryRun, true);
});

test('API errors preserve the backend error envelope', async () => {
  const client = new ApiClient({
    baseUrl: 'http://backend.test/api',
    fetchImplementation: jsonFetch({ code: 'not_found', message: 'Graph unavailable', details: { resource: 'graph' }, request_id: 'req-1' }, 404),
  });
  await assert.rejects(client.get('/graph'), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 404);
    assert.equal(error.code, 'not_found');
    assert.equal(error.requestId, 'req-1');
    return true;
  });
});

test('API mode composes REST graph with real backend adapters', () => {
  assert.deepEqual(apiModeMockFallbacks, []);
  const apiServices = createServices('api', { baseUrl: 'http://backend.test/api', fetchImplementation: jsonFetch(graphPayload) });
  const mockServices = createServices('mock');
  assert.notEqual(apiServices.graph, mockServices.graph);
  assert.throws(() => resolveServiceMode('unsupported'), /Invalid NEXT_PUBLIC_SERVICE_MODE/);
});
