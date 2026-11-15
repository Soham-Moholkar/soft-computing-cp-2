export interface ApiErrorEnvelope {
  code: string;
  message: string;
  details: Record<string, unknown>;
  request_id: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly requestId: string | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(
    status: number,
    envelope: ApiErrorEnvelope,
    retryAfterMs?: number,
  ) {
    super(envelope.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = envelope.code;
    this.details = envelope.details;
    this.requestId = envelope.request_id;
    this.retryAfterMs = retryAfterMs;
  }
}

// Retry-After applies to polling only; clamp untrusted values to one minute.
export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  const milliseconds = /^\d+(?:\.\d+)?$/.test(trimmed)
    ? Number(trimmed) * 1000
    : Date.parse(trimmed) - now;
  return Number.isFinite(milliseconds)
    ? Math.max(0, Math.min(60000, milliseconds))
    : undefined;
}

export type FetchImplementation = typeof fetch;

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImplementation?: FetchImplementation;
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'code' in value &&
    'message' in value &&
    'details' in value &&
    'request_id' in value,
  );
}

export function resolveApiBaseUrl(
  value = process.env.NEXT_PUBLIC_API_BASE_URL,
): string {
  return (value || '/api/backend').replace(/\/+$/, '');
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImplementation: FetchImplementation;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = resolveApiBaseUrl(options.baseUrl);
    this.fetchImplementation =
      options.fetchImplementation ?? ((input, init) => fetch(input, init));
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include',
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
    if (
      response.status === 401 &&
      path !== '/auth/session' &&
      !init.signal?.aborted &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new CustomEvent('softgraph:session-expired'));
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const envelope: ApiErrorEnvelope = isErrorEnvelope(body)
        ? body
        : {
            code: 'http_error',
            message: `API request failed (${response.status})`,
            details: {},
            request_id: '',
          };
      throw new ApiError(
        response.status,
        envelope,
        parseRetryAfter(response.headers.get('retry-after')),
      );
    }
    return body as T;
  }

  get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { signal });
  }

  post<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  }

  postForm<T>(path: string, body: FormData, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { method: 'POST', body, signal });
  }

  put<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}
