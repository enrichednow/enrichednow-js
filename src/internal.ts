import { APIUserAbortError } from './errors';

export const DEFAULT_BASE_URL = 'https://api.enrichednow.com';
/** Milliseconds one request may take before it is given up. */
export const DEFAULT_TIMEOUT = 60_000;
export const DEFAULT_MAX_RETRIES = 2;
/** Milliseconds `scrape` and `runs.wait` wait for a run to end before they give up. */
export const DEFAULT_RUN_TIMEOUT = 600_000;
/** Milliseconds between two looks at a run that is still going. */
export const DEFAULT_POLL_INTERVAL = 2_000;

/** Wait, or throw {@link APIUserAbortError} as soon as the signal aborts. */
export function sleep(ms: number, signal?: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new APIUserAbortError());
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new APIUserAbortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
