import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { backendPath, GET, POST } from '../app/api/backend/[...path]/route.js';
import type { ApiErrorEnvelope } from '../services/api/client.js';

async function readError(response: Response): Promise<ApiErrorEnvelope> {
  return (await response.json()) as ApiErrorEnvelope;
}

const context = (path = ['workspaces', 'personal', 'ingestion', 'upload']) => ({
  params: Promise.resolve({ path }),
});
const flush = async () => {
  await setImmediate();
};

function setup(t: TestContext) {
  const originalFetch = globalThis.fetch;
  const originalOrigin = process.env.SOFTGRAPH_BACKEND_URL;
  process.env.SOFTGRAPH_BACKEND_URL = 'https://backend.test';
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalOrigin === undefined) delete process.env.SOFTGRAPH_BACKEND_URL;
    else process.env.SOFTGRAPH_BACKEND_URL = originalOrigin;
  });
}

test('proxy preserves backend and workspace path mapping', () => {
  assert.equal(backendPath(['health']), '/health');
  assert.equal(backendPath(['ready']), '/ready');
  assert.equal(backendPath(['auth', 'session']), '/api/auth/session');
  assert.equal(backendPath(['workspaces']), '/api/workspaces');
  assert.equal(
    backendPath(['workspaces', 'finance', 'health']),
    '/workspaces/finance/health',
  );
  assert.equal(
    backendPath(['workspaces', 'course', 'graph']),
    '/workspaces/course/api/graph',
  );
  assert.equal(backendPath(['workspaces', 'unknown', 'graph']), null);
  assert.equal(backendPath(['..', 'health']), null);
});

test('proxy rejects unsafe or malformed configured origins with private structured errors', async (t) => {
  setup(t);
  globalThis.fetch = async () => {
    throw new Error('must not fetch');
  };
  for (const origin of [
    'not a URL',
    'file:///tmp',
    'ftp://backend.test',
    'https://user:secret@backend.test',
    'https://backend.test/api',
    'https://backend.test/?q=secret',
    'https://backend.test/#fragment',
    'https://backend.test/?',
    'https://backend.test/#',
    'https://@backend.test',
    'https://backend.test/path/..',
  ]) {
    process.env.SOFTGRAPH_BACKEND_URL = origin;
    const response = await GET(
      new Request('https://frontend.test/api/backend/health'),
      context(['health']),
    );
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      code: 'backend_configuration',
      message: 'The knowledge service configuration is invalid.',
      details: {},
      request_id: '',
    });
  }
  const invalid = await GET(
    new Request('https://frontend.test/api/backend/unknown'),
    context(['..']),
  );
  assert.equal(invalid.status, 400);
  assert.equal((await readError(invalid)).code, 'invalid_path');
  assert.equal(invalid.headers.get('cache-control'), 'no-store');
});

test('proxy forwards trusted credentials, bytes, queries and retry metadata to one fixed origin', async (t) => {
  setup(t);
  globalThis.fetch = async (url, init) => {
    assert.equal(
      url instanceof Request ? url.url : url instanceof URL ? url.href : url,
      'https://backend.test/workspaces/personal/api/ingestion/upload?offset=2',
    );
    assert.equal(init?.redirect, 'manual');
    assert.equal(init?.method, 'POST');
    assert.equal(new Headers(init.headers).get('cookie'), 'session=private');
    assert.equal(
      new Headers(init.headers).get('authorization'),
      'Bearer private',
    );
    assert.equal(new Headers(init.headers).has('host'), false);
    assert.equal(new TextDecoder().decode(init.body as Uint8Array), 'payload');
    return Response.json(
      {
        code: 'rate_limited',
        message: 'Wait',
        details: {},
        request_id: 'upstream-id',
      },
      {
        status: 429,
        headers: {
          'retry-after': '60',
          'x-request-id': 'upstream-id',
          'set-cookie': 'session=next; HttpOnly',
        },
      },
    );
  };
  const response = await POST(
    new Request('https://frontend.test/api/backend/upload?offset=2', {
      method: 'POST',
      body: 'payload',
      headers: {
        cookie: 'session=private',
        authorization: 'Bearer private',
        host: 'attacker.test',
      },
    }),
    context(),
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal(response.headers.get('x-request-id'), 'upstream-id');
  assert.equal(response.headers.get('set-cookie'), 'session=next; HttpOnly');
  assert.equal((await readError(response)).code, 'rate_limited');
});

test('proxy rejects redirects without forwarding a misleading redirect status or location', async (t) => {
  setup(t);
  let cancelled = false;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init?.redirect, 'manual');
    return new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
      { status: 307, headers: { location: 'https://other.test' } },
    );
  };
  const response = await GET(
    new Request('https://frontend.test/api/backend/health'),
    context(['health']),
  );
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await readError(response)).code, 'backend_redirect');
  assert.equal(cancelled, true);
});

test('proxy bounds a stalled upload and never waits for a stalled cancellation hook', async (t) => {
  setup(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let cancelled = false;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({});
  };
  const body = new ReadableStream<Uint8Array>({
    start(stream) {
      stream.enqueue(new Uint8Array([1]));
    },
    cancel() {
      cancelled = true;
      return new Promise<void>(() => {});
    },
  });
  const request = new Request('https://frontend.test/api/backend/upload', {
    method: 'POST',
    body,
    duplex: 'half',
  } as RequestInit);
  const pending = POST(request, context());
  await flush();
  t.mock.timers.tick(30000);
  const response = await pending;
  assert.equal(response.status, 408);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await readError(response)).code, 'request_timeout');
  assert.equal(cancelled, true);
  assert.equal(calls, 0);
});

test('proxy cancels upload promptly when its client disconnects', async (t) => {
  setup(t);
  const controller = new AbortController();
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
      return new Promise<void>(() => {});
    },
  });
  const request = new Request('https://frontend.test/api/backend/upload', {
    method: 'POST',
    body,
    signal: controller.signal,
    duplex: 'half',
  } as RequestInit);
  const pending = POST(request, context());
  await flush();
  controller.abort();
  const response = await pending;
  assert.equal(response.status, 499);
  assert.equal((await readError(response)).code, 'request_cancelled');
  assert.equal(cancelled, true);
});

test('proxy enforces streamed and declared upload limits with complete error envelopes', async (t) => {
  setup(t);
  let cancelled = false;
  globalThis.fetch = async () => {
    throw new Error('must not fetch');
  };
  const body = new ReadableStream<Uint8Array>({
    start(stream) {
      stream.enqueue(new Uint8Array(10 * 1024 * 1024 + 65537));
    },
    cancel() {
      cancelled = true;
      return new Promise<void>(() => {});
    },
  });
  const streamed = await POST(
    new Request('https://frontend.test/upload', {
      method: 'POST',
      body,
      duplex: 'half',
    } as RequestInit),
    context(),
  );
  assert.equal(streamed.status, 413);
  const envelope = await readError(streamed);
  assert.deepEqual(Object.keys(envelope).sort(), [
    'code',
    'details',
    'message',
    'request_id',
  ]);
  assert.equal(envelope.code, 'request_limit');
  assert.equal(streamed.headers.get('cache-control'), 'no-store');
  assert.equal(cancelled, true);
  const declared = await POST(
    new Request('https://frontend.test/upload', {
      method: 'POST',
      body: 'small',
      headers: { 'content-length': '999999999' },
    }),
    context(),
  );
  assert.equal(declared.status, 413);
  assert.equal((await readError(declared)).code, 'request_limit');
});

test('proxy bounds upstream headers and aborts streams even when the downstream stops reading', async (t) => {
  setup(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let upstreamSignal: AbortSignal | undefined;
  globalThis.fetch = async (_url, init) => {
    upstreamSignal = init?.signal ?? undefined;
    return new Promise<Response>(() => {});
  };
  const pending = GET(
    new Request('https://frontend.test/health'),
    context(['health']),
  );
  await flush();
  t.mock.timers.tick(30000);
  const timedOut = await pending;
  assert.equal(timedOut.status, 504);
  assert.equal((await readError(timedOut)).code, 'request_timeout');
  assert.equal(upstreamSignal?.aborted, true);

  let cancelled = false;
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(stream) {
          stream.enqueue(new Uint8Array([1]));
        },
        cancel() {
          cancelled = true;
          return new Promise<void>(() => {});
        },
      }),
    );
  const streaming = await GET(
    new Request('https://frontend.test/health'),
    context(['health']),
  );
  await flush();
  t.mock.timers.tick(30000);
  await assert.rejects(streaming.arrayBuffer(), { name: 'TimeoutError' });
  assert.equal(cancelled, true);
});

test('downstream cancellation immediately releases the upstream stream', async (t) => {
  setup(t);
  let cancelled = false;
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true;
          return new Promise<void>(() => {});
        },
      }),
    );
  const response = await GET(
    new Request('https://frontend.test/health'),
    context(['health']),
  );
  await response.body!.cancel();
  assert.equal(cancelled, true);
});
