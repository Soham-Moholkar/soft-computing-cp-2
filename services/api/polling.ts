import { ApiError } from './client.js';

function pause(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delay);
    signal.addEventListener('abort', abort, { once: true });
  });
}

function loadBeforeDeadline<T>(
  load: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return load(signal);
      })
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

// Shared by status GETs only. Uploads, retries and other mutations are never replayed.
export async function pollJob<
  T extends { status: string; error?: string | null },
>(options: {
  load: (signal: AbortSignal) => Promise<T>;
  signal?: AbortSignal;
  initial?: T;
  onProgress?: (job: T) => void;
  timeoutMessage: string;
  failureMessage: string;
}): Promise<T> {
  const deadline = new AbortController();
  const timer = setTimeout(
    () => deadline.abort(new Error(options.timeoutMessage)),
    120000,
  );
  const signal = options.signal
    ? AbortSignal.any([options.signal, deadline.signal])
    : deadline.signal;
  let delay = 1000;
  let job = options.initial;
  try {
    while (true) {
      signal.throwIfAborted();
      if (!job) {
        try {
          job = await loadBeforeDeadline(options.load, signal);
        } catch (error) {
          signal.throwIfAborted();
          if (!(error instanceof ApiError) || error.status !== 429) throw error;
          await pause(Math.max(delay, error.retryAfterMs ?? 0), signal);
          delay = Math.min(5000, delay * 2);
          continue;
        }
      }
      signal.throwIfAborted();
      options.onProgress?.(job);
      if (job.status === 'failed')
        throw new Error(job.error || options.failureMessage);
      if (job.status === 'completed') return job;
      await pause(delay, signal);
      delay = Math.min(5000, delay * 2);
      job = undefined;
    }
  } finally {
    clearTimeout(timer);
  }
}
