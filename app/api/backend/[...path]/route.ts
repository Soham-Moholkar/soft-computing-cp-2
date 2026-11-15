// Fixed-upstream same-origin proxy; access keys and cookies stay out of public configuration.
const MAX_BODY = 10 * 1024 * 1024 + 65536;
const REQUEST_TIMEOUT_MS = 30000;
type Context = { params: Promise<{ path: string[] }> };

export function backendPath(parts: string[]): string | null {
  if (
    !parts.length ||
    parts.some(
      (part) =>
        !/^[a-zA-Z0-9_.-]+$/.test(part) || part === '.' || part === '..',
    )
  )
    return null;
  if (parts[0] === 'workspaces' && parts.length > 1) {
    if (
      ![
        'ration', 'healthcare',
        'agriculture',
        'engineering',
        'finance',
        'personal',
        'course',
      ].includes(parts[1]) ||
      parts.length < 3
    )
      return null;
    return `/workspaces/${parts[1]}/${parts[2] === 'health' ? parts.slice(2).join('/') : `api/${parts.slice(2).join('/')}`}`;
  }
  return parts[0] === 'health' || parts[0] === 'ready'
    ? `/${parts.join('/')}`
    : `/api/${parts.join('/')}`;
}

function failure(status: number, code: string, message: string) {
  return Response.json(
    { code, message, details: {}, request_id: '' },
    {
      status,
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    },
  );
}

// A stream's cancel algorithm may itself stall. Start cleanup without awaiting it.
function cancel(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  reason?: unknown,
) {
  void reader.cancel(reason).catch(() => {});
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    operation
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

async function proxy(request: Request, context: Context) {
  const path = backendPath((await context.params).path);
  if (!path) return failure(400, 'invalid_path', 'Unknown backend path.');
  let target: URL;
  try {
    const configured =
      process.env.SOFTGRAPH_BACKEND_URL || 'http://127.0.0.1:8001';
    const origin = new URL(configured);
    if (
      !/^https?:\/\/[^/@?#\\]+\/?$/i.test(configured) ||
      !['http:', 'https:'].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash
    )
      throw new Error('Invalid backend origin');
    target = new URL(path, origin.origin);
    target.search = new URL(request.url).search;
  } catch {
    return failure(
      503,
      'backend_configuration',
      'The knowledge service configuration is invalid.',
    );
  }

  const controller = new AbortController();
  const disconnect = () => controller.abort(request.signal.reason);
  request.signal.addEventListener('abort', disconnect, { once: true });
  if (request.signal.aborted) disconnect();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(
      new DOMException('Request deadline exceeded', 'TimeoutError'),
    );
  }, REQUEST_TIMEOUT_MS);
  const cleanup = () => {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', disconnect);
  };
  let readingUpload = true;
  let streaming = false;
  try {
    controller.signal.throwIfAborted();
    const headers = new Headers();
    for (const name of ['content-type', 'cookie', 'origin', 'authorization']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    let body: Uint8Array | undefined;
    if (!['GET', 'HEAD'].includes(request.method) && request.body) {
      const lengthHeader = request.headers.get('content-length');
      if (lengthHeader !== null && !/^\d+$/.test(lengthHeader))
        return failure(400, 'invalid_length', 'Invalid content length.');
      const declared = Number(lengthHeader || 0);
      if (!Number.isFinite(declared))
        return failure(413, 'request_limit', 'Upload exceeds 10 MiB.');
      if (declared > MAX_BODY)
        return failure(413, 'request_limit', 'Upload exceeds 10 MiB.');
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const { value, done } = await abortable(
            reader.read(),
            controller.signal,
          );
          if (done) break;
          length += value.byteLength;
          if (length > MAX_BODY)
            return failure(413, 'request_limit', 'Upload exceeds 10 MiB.');
          chunks.push(value);
        }
      } finally {
        cancel(reader);
        reader.releaseLock();
      }
      body = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
      }
    }
    readingUpload = false;
    const pendingResponse = fetch(target, {
      method: request.method,
      headers,
      body: body as BodyInit | undefined,
      redirect: 'manual',
      signal: controller.signal,
    });
    // Also discard a late response if a transport does not honour its abort signal.
    void pendingResponse.then(
      (response) => {
        if (controller.signal.aborted)
          void response.body?.cancel().catch(() => {});
      },
      () => {},
    );
    const response = await abortable(pendingResponse, controller.signal);
    if (response.status >= 300 && response.status < 400) {
      void response.body?.cancel().catch(() => {});
      return failure(
        502,
        'backend_redirect',
        'The knowledge service returned an unexpected redirect.',
      );
    }
    const forwarded = new Headers({
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    for (const name of [
      'content-type',
      'set-cookie',
      'x-request-id',
      'retry-after',
    ]) {
      const value = response.headers.get(name);
      if (value) forwarded.set(name, value);
    }
    if (!response.body)
      return new Response(null, {
        status: response.status,
        headers: forwarded,
      });
    const reader = response.body.getReader();
    let ended = false;
    const finish = (reason?: unknown) => {
      if (ended) return;
      ended = true;
      controller.signal.removeEventListener('abort', abortStream);
      cancel(reader, reason);
      reader.releaseLock();
      cleanup();
    };
    let output: ReadableStreamDefaultController<Uint8Array>;
    const abortStream = () => {
      output.error(controller.signal.reason);
      finish(controller.signal.reason);
    };
    const stream = new ReadableStream<Uint8Array>({
      start(value) {
        output = value;
        controller.signal.addEventListener('abort', abortStream, {
          once: true,
        });
        if (controller.signal.aborted) abortStream();
      },
      async pull(value) {
        try {
          const chunk = await abortable(reader.read(), controller.signal);
          if (ended) return;
          if (chunk.done) {
            value.close();
            finish();
          } else value.enqueue(chunk.value);
        } catch (error) {
          if (!ended) {
            value.error(error);
            finish(error);
          }
        }
      },
      cancel(reason) {
        finish(reason);
        controller.abort(reason);
      },
    });
    streaming = !ended;
    return new Response(stream, {
      status: response.status,
      headers: forwarded,
    });
  } catch {
    if (request.signal.aborted)
      return failure(499, 'request_cancelled', 'The request was cancelled.');
    if (timedOut)
      return failure(
        readingUpload ? 408 : 504,
        'request_timeout',
        readingUpload
          ? 'Upload did not finish within 30 seconds.'
          : 'The knowledge service did not respond within 30 seconds.',
      );
    return failure(
      503,
      'backend_unavailable',
      'The knowledge service is unavailable. Check that the backend is running.',
    );
  } finally {
    if (readingUpload && request.body && !request.body.locked)
      void request.body.cancel().catch(() => {});
    if (!streaming) cleanup();
  }
}
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
