import { readFileSync } from 'node:fs';

import { expect } from 'vitest';

import { EnrichedNow } from '../src';
import type { ClientOptions, Run, RunStatus } from '../src';

export interface Call {
  url: URL;
  method: string;
  headers: Record<string, string>;
  /** The body, parsed, when it was sent as JSON. */
  body: unknown;
  /** The body as it was sent, as text. */
  text: string | undefined;
  signal: AbortSignal | undefined;
}

export type Handler = Response | Error | ((call: Call) => Response | Promise<Response>);

/** A `fetch` that answers from a queue, in order, and remembers what it was asked. */
export function mockFetch(...handlers: Handler[]) {
  const calls: Call[] = [];
  const queue = [...handlers];
  const fetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    const text =
      typeof init.body === 'string' ? init.body : init.body instanceof Uint8Array ? new TextDecoder().decode(init.body) : undefined;
    const call: Call = {
      url: new URL(input),
      method: init.method ?? 'GET',
      headers,
      body: text !== undefined && (headers['content-type'] ?? 'application/json').includes('json') ? JSON.parse(text) : undefined,
      text,
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

// --- recorded exchanges --------------------------------------------------------------------------------------------

/** One request to the real API and its answer, as `tests/fixtures/formulas/<name>.json` recorded it. */
export interface Exchange {
  request: {
    method: string;
    path: string;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    body?: unknown;
    text?: string;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body?: unknown;
    text?: string;
  };
}

const FIXTURES = new URL('./fixtures/formulas/', import.meta.url);

/** A recorded exchange, by its name: `fixture('formulas_get')`. */
export function fixture(name: string): Exchange {
  return JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES), 'utf8')) as Exchange;
}

/** The body of a recorded answer, to change for a case the recording does not have. */
export function answerBody<T = Record<string, unknown>>(name: string): T {
  return structuredClone(fixture(name).response.body) as T;
}

/** The answer an exchange recorded, as `fetch` gives it: a new `Response` each time. */
export function answer(exchange: Exchange): Response {
  const { status, headers, body, text } = exchange.response;
  const payload = text ?? (body === undefined ? null : JSON.stringify(body));
  return new Response(status === 204 ? null : payload, { status, headers });
}

/**
 * Check that a call sent the request the exchange recorded: its method, path, query (as a map), the headers the
 * recording names, and its body. `query` replaces the recorded query, for a call that adds to it on purpose.
 */
export function expectRequest(call: Call, exchange: Exchange, override: { query?: Record<string, string> } = {}): void {
  const { method, path, query = {}, headers = {}, body, text } = exchange.request;
  expect(`${call.method} ${call.url.pathname}`).toBe(`${method} ${path}`);
  expect(Object.fromEntries(call.url.searchParams)).toEqual(override.query ?? query);
  for (const [name, value] of Object.entries(headers)) {
    expect(call.headers[name.toLowerCase()], name).toBe(value);
  }
  if (text !== undefined) {
    expect(call.text).toBe(text);
  } else {
    expect(call.body).toEqual(body);
  }
}

/**
 * A `fetch` that answers with these recorded exchanges, in order. `expectRequests()` checks that each call sent the
 * request its exchange recorded.
 */
export function replay(...names: string[]) {
  const exchanges = names.map(fixture);
  const mock = mockFetch(...exchanges.map((exchange) => () => answer(exchange)));
  return {
    ...mock,
    exchanges,
    expectRequests(): void {
      expect(mock.calls).toHaveLength(exchanges.length);
      mock.calls.forEach((call, at) => expectRequest(call, exchanges[at]!));
    },
  };
}
