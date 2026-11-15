import assert from 'node:assert/strict';
import test from 'node:test';
import {
  workspaceClient,
  waitForSource,
} from '../services/api/workspace-service.js';
import {
  ApiClient,
  ApiError,
  parseRetryAfter,
} from '../services/api/client.js';
import { pollJob } from '../services/api/polling.js';
import { setImmediate } from 'node:timers/promises';
import {
  waitForOptimization,
  type OptimizationJob,
} from '../services/api/optimization-service.js';

test('workspace requests use distinct server scopes and cookie credentials', async () => {
  const requests: string[] = [];
  for (const workspace of [
    'personal',
    'engineering',
    'course',
    'healthcare',
    'agriculture',
    'finance',
  ] as const) {
    const client = workspaceClient(workspace, {
      fetchImplementation: async (url, init) => {
        assert.equal(typeof url, 'string');
        requests.push(url as string);
        assert.equal(init?.credentials, 'include');
        return Response.json({});
      },
    });
    await client.get('/workspace/summary');
    await client.put('/workspace/settings', { top_k: 3 });
  }
  assert.equal(
    new Set(requests.map((url) => url.split('/workspace/')[0])).size,
    6,
  );
  assert.ok(requests[0].endsWith('/workspaces/personal/workspace/summary'));
});
test('source polling exposes processing failures and honours cancellation', async () => {
  const accepted = { document_id: 'doc', job_id: 'job', status: 'uploaded' };
  const failed = new ApiClient({
    fetchImplementation: async () =>
      Response.json({ status: 'failed', error: 'Unsupported source' }),
  });
  await assert.rejects(
    waitForSource(failed, accepted, new AbortController().signal),
    /Unsupported source/,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(waitForSource(failed, accepted, controller.signal), {
    name: 'AbortError',
  });
});
test('direct backend configuration uses the mounted workspace path', async () => {
  const client = workspaceClient('engineering', {
    baseUrl: 'https://backend.test/api',
    fetchImplementation: async (url) => {
      assert.equal(
        url,
        'https://backend.test/workspaces/engineering/api/workspace/summary',
      );
      return Response.json({});
    },
  });
  await client.get('/workspace/summary');
});
test('optimizer reopening preserves persisted failures rather than producing fake curves', async () => {
  const job = {
    job_id: 'saved',
    status: 'failed',
    error: 'Run interrupted by restart',
  } as OptimizationJob;
  await assert.rejects(
    waitForOptimization(new ApiClient(), job),
    /Run interrupted/,
  );
  const complete = {
    ...job,
    status: 'completed',
    error: null,
  } as OptimizationJob;
  assert.equal(await waitForOptimization(new ApiClient(), complete), complete);
});

test('polling backs off below the API rate limit and has a fixed two minute deadline', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const requested: number[] = [];
  const client = new ApiClient({
    fetchImplementation: async () => {
      requested.push(Date.now());
      return Response.json({ status: 'running', error: null });
    },
  });
  const pending = waitForSource(
    client,
    { job_id: 'long', document_id: 'doc', status: 'uploaded' },
    new AbortController().signal,
  );
  const rejected = assert.rejects(pending, /still processing/);
  await setImmediate();
  for (let second = 1; second <= 120; second++) {
    t.mock.timers.tick(1000);
    await setImmediate();
  }
  await rejected;
  assert.deepEqual(requested.slice(0, 5), [0, 1000, 3000, 7000, 12000]);
  assert.ok(
    requested.length < 30,
    `Only ${requested.length} polls should occur in two minutes`,
  );
  assert.ok(requested.every((time) => time < 120000));
});

test('job status polling honours Retry-After and resumes after a transient 429', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  let calls = 0;
  const client = new ApiClient({
    fetchImplementation: async () => {
      calls++;
      return calls === 1
        ? Response.json(
            {
              code: 'rate_limited',
              message: 'Wait',
              details: {},
              request_id: '',
            },
            { status: 429, headers: { 'retry-after': '60' } },
          )
        : Response.json({ status: 'completed', error: null });
    },
  });
  const pending = waitForSource(
    client,
    { job_id: 'job', document_id: 'doc', status: 'uploaded' },
    new AbortController().signal,
  );
  await setImmediate();
  t.mock.timers.tick(59999);
  await setImmediate();
  assert.equal(calls, 1);
  t.mock.timers.tick(1);
  assert.equal(await pending, 'doc');
  assert.equal(calls, 2);
});

test('Retry-After metadata is bounded and mutations are never retried', async () => {
  assert.equal(parseRetryAfter('9999999'), 60000);
  assert.equal(
    parseRetryAfter(
      'Wed, 01 Jan 2025 00:00:30 GMT',
      Date.parse('2025-01-01T00:00:00Z'),
    ),
    30000,
  );
  assert.equal(parseRetryAfter('0'), 0);
  assert.equal(parseRetryAfter('invalid'), undefined);
  let calls = 0;
  const client = new ApiClient({
    fetchImplementation: async () => {
      calls++;
      return Response.json(
        {},
        { status: 429, headers: { 'retry-after': '60' } },
      );
    },
  });
  await assert.rejects(
    client.post('/ingestion/jobs/job/retry', {}),
    (error) => error instanceof ApiError && error.retryAfterMs === 60000,
  );
  assert.equal(calls, 1);
});

test('polling cancellation interrupts optimizer backoff without issuing another request', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const controller = new AbortController();
  let calls = 0;
  const client = new ApiClient({
    fetchImplementation: async () => {
      calls++;
      return Response.json({});
    },
  });
  const pending = waitForOptimization(
    client,
    { job_id: 'job', status: 'running' } as OptimizationJob,
    controller.signal,
  );
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  controller.abort();
  await rejected;
  t.mock.timers.tick(10000);
  assert.equal(calls, 0);
});

test('polling stops at its deadline even if a transport stalls and preserves non-rate errors', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = pollJob({
    load: () => new Promise<{ status: string }>(() => {}),
    timeoutMessage: 'Check recent jobs.',
    failureMessage: 'Failed',
  });
  const rejected = assert.rejects(pending, /Check recent jobs/);
  await setImmediate();
  t.mock.timers.tick(120000);
  await rejected;
  const error = new ApiError(403, {
    code: 'forbidden',
    message: 'Forbidden',
    details: {},
    request_id: '',
  });
  await assert.rejects(
    pollJob({
      load: async () => {
        throw error;
      },
      timeoutMessage: 'Timed out',
      failureMessage: 'Failed',
    }),
    (actual) => actual === error,
  );
});

test('protected API 401s notify the browser session gate while auth failures stay local', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const browser = new EventTarget();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: browser,
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  let expired = 0;
  browser.addEventListener('softgraph:session-expired', () => expired++);
  const client = new ApiClient({
    fetchImplementation: async () => Response.json({}, { status: 401 }),
  });
  await assert.rejects(
    client.get('/workspace/summary'),
    (error) => error instanceof ApiError && error.status === 401,
  );
  assert.equal(expired, 1);
  await assert.rejects(client.post('/auth/session', { access_key: 'invalid' }));
  await assert.rejects(client.get('/auth/session'));
  assert.equal(expired, 1);
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(client.get('/workspace/summary', aborted.signal));
  assert.equal(expired, 1);
});
