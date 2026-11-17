import { EnrichedNow } from '../src';
import type { ClientOptions, Run, RunStatus } from '../src';

export interface Call {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  signal: AbortSignal | undefined;
}

export type Handler = Response | Error | ((call: Call) => Response | Promise<Response>);

/** A `fetch` that answers from a queue, in order, and remembers what it was asked. */
export function mockFetch(...handlers: Handler[]) {
  const calls: Call[] = [];
  const queue = [...handlers];
  const fetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
    const call: Call = {
      url: new URL(input),
      method: init.method ?? 'GET',
      headers: init.headers as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      signal: init.signal ?? undefined,
    };
    calls.push(call);
    const handler = queue.shift();
    if (handler === undefined) throw new Error(`fetch was called more often than expected: ${call.method} ${call.url}`);
    if (handler instanceof Error) throw handler;
    return typeof handler === 'function' ? handler(call) : handler;
  };
  return { fetch, calls, push: (...more: Handler[]) => queue.push(...more) };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

export function apiError(status: number, code: string, message = 'Something.', details: Record<string, unknown> = {}, headers = {}): Response {
  return json({ error: { code, message, details } }, status, headers);
}

/** A request that never answers; it fails when its signal aborts, as `fetch` does. */
export const hang = (call: Call): Promise<Response> =>
  new Promise((_, reject) => {
    call.signal?.addEventListener('abort', () => reject(new DOMException('This operation was aborted', 'AbortError')));
  });

export function makeRun(status: RunStatus = 'ok', overrides: Partial<Run> = {}): Run {
  const ended = status !== 'queued' && status !== 'running';
  return {
    id: 'run_841742f37553189ff9c27ba1',
    scraper_id: 'ats.board',
    scraper_version: 1,
    status,
    reason: status === 'ok' || !ended ? null : status === 'cancelled' ? 'cancelled' : 'fetch_failed',
    input: { board_url: 'https://boards.greenhouse.io/acme' },
    record_count: status === 'ok' ? 2 : 0,
    units: status === 'ok' ? 1 : 0,
    diagnostics: ended ? { requests: 1, bytes: 259214, wall_ms: 885, facts: { ats: 'greenhouse' } } : null,
    created_at: '2026-11-16T22:37:50.170950Z',
    started_at: status === 'queued' ? null : '2026-11-16T22:37:50.178331Z',
    finished_at: ended ? '2026-11-16T22:37:51.066313Z' : null,
    ...overrides,
  };
}

export function makeClient(fetch: ClientOptions['fetch'], options: ClientOptions = {}): EnrichedNow {
  return new EnrichedNow({ apiKey: 'en_live_test', fetch, ...options });
}
