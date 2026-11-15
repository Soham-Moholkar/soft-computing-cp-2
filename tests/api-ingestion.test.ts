import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClient, ApiError } from '../services/api/client.js';
import { createRestIngestionService, mapCompletedIngestion, mapIngestionPayload } from '../services/api/ingestion-service.js';
import { apiModeMockFallbacks, createServices } from '../services/index.js';
import { mockIngestionService } from '../services/mock/ingestion-service.js';
import { mockFuzzyService } from '../services/mock/fuzzy-service.js';

const accepted = {
  schema_version: '1.0', job_id: 'job-demo', document_id: 'document-demo', status: 'completed' as const, progress: 100, created_at: '2026-09-02T05:00:00Z',
};
const job = {
  ...accepted,
  updated_at: accepted.created_at,
  stages: [
    { stage: 'uploaded', progress: 10, recorded_at: accepted.created_at },
    { stage: 'completed', progress: 100, recorded_at: accepted.created_at },
  ],
  warnings: ['Extraction is deferred.'],
  final_counts: { chunks: 2, entities: 0, relations: 0 },
};

test('ingestion payload mapping preserves paste and URL values for the backend discriminator', () => {
  assert.deepEqual(
    mapIngestionPayload({ name: 'note.txt', sourceType: 'paste', domain: 'Soft Computing', text: 'fuzzy graph', chunkSize: 12 }),
    { source_type: 'paste', name: 'note.txt', domain: 'Soft Computing', chunk_size: 12, text: 'fuzzy graph' },
  );
  assert.deepEqual(
    mapIngestionPayload({ name: 'source', sourceType: 'url', domain: 'Soft Computing', sourceUri: 'https://example.test/source' }),
    { source_type: 'url', name: 'source', domain: 'Soft Computing', source_uri: 'https://example.test/source' },
  );
  assert.throws(() => mapIngestionPayload({ name: 'note', sourceType: 'paste', domain: 'Soft Computing', text: '  ' }), /cannot be blank/);
});

test('REST ingestion posts JSON, reads the completed job, and maps existing UI fields', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImplementation: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
    requests.push({ url, init });
    const body = url.endsWith('/ingestion/upload') ? accepted : job;
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  };
  const service = createRestIngestionService(new ApiClient({ baseUrl: 'http://backend.test/api', fetchImplementation }));
  const result = await service.process({ name: 'note.txt', sourceType: 'paste', domain: 'Soft Computing', text: 'fuzzy graph' });
  assert.equal(requests[0].url, 'http://backend.test/api/ingestion/upload');
  assert.equal(requests[0].init?.method, 'POST');
  const postedBody = requests[0].init?.body;
  assert.equal(typeof postedBody, 'string');
  if (typeof postedBody !== 'string') throw new Error('Expected JSON request body.');
  assert.deepEqual(JSON.parse(postedBody), { source_type: 'paste', name: 'note.txt', domain: 'Soft Computing', text: 'fuzzy graph' });
  assert.equal(requests[1].url, 'http://backend.test/api/ingestion/jobs/job-demo');
  assert.equal(result.document.documentId, 'document-demo');
  assert.equal(result.document.metadata.backend, true);
  assert.deepEqual(result.stageDurations, [{ stage: 'Uploaded', durationMs: 0 }, { stage: 'Completed', durationMs: 0 }]);
  assert.deepEqual(result.warnings, ['Extraction is deferred.']);
});

test('completed job mapper keeps metadata-only inputs honest and API errors stay typed', async () => {
  const mapped = mapCompletedIngestion({ name: 'sample', sourceType: 'sample', domain: 'Soft Computing' }, accepted, job);
  assert.equal(mapped.document.sourceType, 'sample');
  const client = new ApiClient({
    baseUrl: 'http://backend.test/api',
    fetchImplementation: async () => new Response(JSON.stringify({ code: 'validation_error', message: 'Invalid input', details: {}, request_id: 'request-1' }), { status: 422 }),
  });
  await assert.rejects(client.post('/ingestion/upload', {}), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 422);
    assert.equal(error.code, 'validation_error');
    return true;
  });
});

test('API mode uses REST ingestion and retains only the explicit remaining mock fallbacks', () => {
  const apiServices = createServices('api', { baseUrl: 'http://backend.test/api', fetchImplementation: async () => new Response('{}') });
  assert.deepEqual(apiModeMockFallbacks, []);
  assert.notEqual(apiServices.ingestion, mockIngestionService);
  assert.notEqual(apiServices.fuzzy, mockFuzzyService);
});

test('file ingestion sends bytes as multipart and emits real job progress', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  let polls = 0;
  const client = new ApiClient({ baseUrl: 'http://backend.test/api', fetchImplementation: async (input, init) => {
    const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
    requests.push({ url, init });
    const body = url.endsWith('/upload/file') ? { ...accepted, status: 'uploaded', progress: 5 }
      : ++polls === 1 ? { ...job, status: 'parsing', progress: 25 } : job;
    return Response.json(body);
  } });
  const progress: string[] = [];
  const result = await createRestIngestionService(client).process({
    name: 'real.txt', sourceType: 'txt', domain: 'course', chunkSize: 8, chunkOverlap: 2,
    file: new File(['Actual fuzzy evidence'], 'real.txt', { type: 'text/plain' }),
    onProgress: (value) => progress.push(value.status),
  });
  assert.equal(requests[0].url, 'http://backend.test/api/ingestion/upload/file');
  const form = requests[0].init?.body;
  assert.ok(form instanceof FormData);
  const file = form.get('file');
  assert.ok(file instanceof File);
  assert.equal(await file.text(), 'Actual fuzzy evidence');
  assert.equal(form.get('chunk_overlap'), '2');
  assert.equal(new Headers(requests[0].init?.headers).has('content-type'), false);
  assert.deepEqual(progress, ['parsing', 'completed']);
  assert.equal(result.chunkCount, 2);
});

test('failed jobs surface backend errors and polling can be cancelled', async () => {
  const failure = createRestIngestionService(new ApiClient({ fetchImplementation: async (input) =>
    Response.json((input instanceof Request ? input.url : input instanceof URL ? input.href : input).endsWith('/upload') ? accepted : { ...job, status: 'failed', error: 'PDF has no extractable text.' }),
  }));
  await assert.rejects(failure.process({ name: 'paste', sourceType: 'paste', domain: 'course', text: 'content' }), /no extractable text/);
  const controller = new AbortController();
  let polls = 0;
  const pending = createRestIngestionService(new ApiClient({ fetchImplementation: async () => {
    polls++;
    return Response.json({ ...job, status: 'parsing', progress: 25 });
  } }));
  await assert.rejects(pending.resume!('job-demo', () => controller.abort(new Error('Cancelled')), controller.signal), /Cancelled/);
  assert.equal(polls, 1);
});

test('saved chunks and retries map backend provenance and job identity', async () => {
  const requests: string[] = [];
  const service = createRestIngestionService(new ApiClient({ fetchImplementation: async (input) => {
    const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input; requests.push(url);
    return Response.json(url.includes('/documents/') ? {
      document: { document_id: 'document-demo', name: 'notes.pdf' }, total_chunks: 2, next_offset: null,
      chunks: [{ chunk_id: 'chunk-1', text: 'Real evidence', token_count: 2, source_location: { page: 1 } }],
    } : url.endsWith('/retry') ? accepted : job);
  } }));
  const detail = await service.getDocument!('document-demo', 1);
  assert.equal(detail.name, 'notes.pdf');
  assert.deepEqual(detail.chunks[0].sourceLocation, { page: 1 });
  assert.ok(requests[0].endsWith('/documents/document-demo?offset=1&limit=20'));
  const retried = await service.retry!('job-demo');
  assert.equal(retried.jobId, 'job-demo');
  assert.ok(requests[1].endsWith('/jobs/job-demo/retry'));
});

test('default API transport calls native fetch without an ApiClient receiver', async () => {
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = function (this: unknown) {
    assert.ok(!(this instanceof ApiClient), 'Native browser fetch must not receive the client as this.');
    return Promise.resolve(Response.json({ status: 'healthy' }));
  };
  try { assert.deepEqual(await new ApiClient().get('/health'), { status: 'healthy' }); }
  finally { globalThis.fetch = nativeFetch; }
});

test('DOCX ingestion sends the original file and source type without decoding its bytes', async () => {
  const docxBytes = new Uint8Array([80, 75, 3, 4, 255, 0, 128]);
  const source = new File([docxBytes], 'evidence.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const requests: string[] = [];
  const client = new ApiClient({ fetchImplementation: async (input, init) => {
    const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
    requests.push(url);
    if (url.endsWith('/ingestion/upload/file')) {
      assert.ok(init?.body instanceof FormData);
      assert.equal(init.body.get('source_type'), 'docx');
      const sent = init.body.get('file');
      assert.ok(sent instanceof File);
      assert.equal(sent.name, 'evidence.docx');
      assert.deepEqual(new Uint8Array(await sent.arrayBuffer()), docxBytes);
      assert.equal(new Headers(init.headers).has('content-type'), false);
      return Response.json(accepted);
    }
    return Response.json({ ...job, warnings: ['DOCX imports body paragraph and table text only.'] });
  } });
  const result = await createRestIngestionService(client).process({
    name: source.name, sourceType: 'docx', domain: 'course', file: source,
  });
  assert.equal(requests.length, 2);
  assert.ok(requests[0].endsWith('/ingestion/upload/file'));
  assert.equal(result.document.sourceType, 'docx');
  assert.match(result.warnings[0], /DOCX/);
});
