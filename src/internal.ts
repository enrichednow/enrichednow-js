import { APIUserAbortError } from './errors';
import type { RecordFormat } from './types';

export const DEFAULT_BASE_URL = 'https://api.enrichednow.com';
/** Milliseconds one request may take before it is given up. */
export const DEFAULT_TIMEOUT = 60_000;
export const DEFAULT_MAX_RETRIES = 2;
/** Milliseconds `scrape`, `runFormula` and the `wait` methods wait for a run to end before they give up. */
export const DEFAULT_RUN_TIMEOUT = 600_000;
/** Milliseconds between two looks at a run that is still going. */
export const DEFAULT_POLL_INTERVAL = 2_000;

/** Above `wait`, how much longer the request itself may take, in milliseconds. */
export const WAIT_MARGIN = 30_000;
/** Records or rows a page when a whole run is exported: the API's largest page. */
export const EXPORT_PAGE = 1000;
export const EXPORT_FORMATS: readonly RecordFormat[] = ['csv', 'ndjson'];
export const EXPORT_ACCEPT: Record<RecordFormat, string> = { csv: 'text/csv', ndjson: 'application/x-ndjson' };

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

/** A key of our own for one call: a UUID where the runtime makes one, else random hex of the same length. */
export function newIdempotencyKey(): string {
  const made = globalThis.crypto?.randomUUID?.();
  if (made) return made;
  let hex = '';
  for (let i = 0; i < 32; i++) hex += Math.floor(Math.random() * 16).toString(16);
  return hex;
}

/** The timeout of a request the API is asked to hold open for `wait` seconds: it must outlast the hold. */
export function heldTimeout(clientTimeout: number, wait: number | undefined): number {
  return Math.max(clientTimeout, (wait ?? 0) * 1000 + WAIT_MARGIN);
}

/** A CSV page after the first, without the header row every page starts with (the columns are the same). */
export function withoutHeader(body: Uint8Array): Uint8Array {
  const end = body.indexOf(0x0a);
  return end < 0 ? new Uint8Array(0) : body.subarray(end + 1);
}

/** The object without its `undefined` entries: what is not given is not sent. `null` stays: it means something. */
export function given<T extends Record<string, unknown>>(object: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(object)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}
