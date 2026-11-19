import { createHmac } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { QuotaExceededError, parseWebhookAsync, verifyWebhook, verifyWebhookAsync } from '../src';
import { apiError, json, makeClient, makeRun, mockFetch } from './helpers';

const STANDING = {
  'x-units-limit': '1000',
  'x-units-used': '120',
  'x-units-remaining': '880',
  'x-units-topup': '50',
  'x-units-reset': '2026-12-01T00:00:00Z',
  'x-ratelimit-limit': '2',
  'x-ratelimit-remaining': '1',
};

function page(body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', ...headers } });
}

const text = (chunks: Uint8Array[]): string => chunks.map((chunk) => new TextDecoder().decode(chunk)).join('');

describe('the standing of the account', () => {
  it('is kept from the last answer that carried it, an error included', async () => {
    const { fetch } = mockFetch(
      json({ scrapers: [] }),
      json(makeRun('ok'), 200, STANDING),
      apiError(402, 'quota_exceeded', 'No.', {}, { ...STANDING, 'x-units-remaining': '0', 'x-units-topup': '0' }),
    );
    const client = makeClient(fetch);
    await client.scrapers.list();
    expect(client.standing).toBeNull();
    await client.runs.get('run_1');
    expect(client.standing).toEqual({
      unitsLimit: 1000,
      unitsUsed: 120,
      unitsRemaining: 880,
      unitsTopup: 50,
      unitsReset: '2026-12-01T00:00:00Z',
      runsLimit: 2,
      runsRemaining: 1,
      unmetered: false,
    });
    await expect(client.scrapers.run('ats.board', {})).rejects.toBeInstanceOf(QuotaExceededError);
    expect(client.standing?.unitsRemaining).toBe(0);
  });

  it('is asked for by usage.standing(), and says unmetered', async () => {
    const { fetch, calls } = mockFetch(json({ runs: [], next_cursor: null }, 200, { ...STANDING, 'x-units-unmetered': 'true' }));
    const standing = await makeClient(fetch).usage.standing();
    expect(calls[0]!.url.pathname).toBe('/v1/runs');
    expect(calls[0]!.url.searchParams.get('limit')).toBe('1');
    expect(standing.unmetered).toBe(true);
  });
});

describe('waiting and listing', () => {
  it('holds a get for up to 300 seconds and lists by every filter', async () => {
    const { fetch, calls } = mockFetch(json(makeRun('ok')), json({ runs: [], next_cursor: null }));
    const client = makeClient(fetch);
    await client.runs.get('run_1', { wait: 120 });
    expect(calls[0]!.url.searchParams.get('wait')).toBe('120');
    await client.runs.list({ api_key_id: 'key_1', from: '2026-11-01', to: new Date('2026-11-19T00:00:00Z'), status: 'ok' });
    expect(Object.fromEntries(calls[1]!.url.searchParams)).toEqual({
      api_key_id: 'key_1',
      from: '2026-11-01',
      to: '2026-11-19T00:00:00.000Z',
      status: 'ok',
    });
  });
});

describe('records the API writes', () => {
  it('exports one page with its cursor', async () => {
    const { fetch, calls } = mockFetch(page('a,b\r\n1,2\r\n', { 'x-next-cursor': 'c2' }));
    const got = await makeClient(fetch).runs.export('run_1', { format: 'csv', limit: 1 });
    expect(Object.fromEntries(calls[0]!.url.searchParams)).toEqual({ format: 'csv', limit: '1' });
    expect(calls[0]!.headers.accept).toBe('text/csv');
    expect(got.text).toBe('a,b\r\n1,2\r\n');
    expect(got.nextCursor).toBe('c2');
    expect(got.expired).toBe(false);
  });

  it('exports a whole run with the CSV header once, and NDJSON as it comes', async () => {
    const csv = mockFetch(page('a,b\r\n1,2\r\n', { 'x-next-cursor': 'c2' }), page('a,b\r\n3,4\r\n'));
    const chunks: Uint8Array[] = [];
    for await (const chunk of makeClient(csv.fetch).runs.exportAll('run_1', { format: 'csv' })) chunks.push(chunk);
    expect(text(chunks)).toBe('a,b\r\n1,2\r\n3,4\r\n');
    expect(csv.calls.map((call) => call.url.searchParams.get('cursor'))).toEqual([null, 'c2']);
    expect(csv.calls[0]!.url.searchParams.get('limit')).toBe('1000');

    const nd = mockFetch(page('{"a":1}\n', { 'x-next-cursor': 'c2' }), page('{"a":2}\n'));
    const lines: Uint8Array[] = [];
    for await (const chunk of makeClient(nd.fetch).runs.exportAll('run_1', { format: 'ndjson' })) lines.push(chunk);
    expect(text(lines)).toBe('{"a":1}\n{"a":2}\n');
  });

  it('says when the records are gone, and refuses a format the API does not write', async () => {
    const { fetch } = mockFetch(page('', { 'x-records-expired': 'true' }));
    const client = makeClient(fetch);
    expect((await client.runs.export('run_1', { format: 'ndjson' })).expired).toBe(true);
    // @ts-expect-error: not a format
    await expect(client.runs.export('run_1', { format: 'xml' })).rejects.toThrow(TypeError);
  });

  it('reads a file a run produced', async () => {
    const { fetch, calls } = mockFetch(new Response(new Uint8Array([0x89, 0x50]), { headers: { 'content-type': 'image/png' } }));
    expect([...(await makeClient(fetch).runs.file('run_1', 'screenshot.png'))]).toEqual([0x89, 0x50]);
    expect(calls[0]!.url.pathname).toBe('/v1/runs/run_1/files/screenshot.png');
  });
});

describe('verifying a webhook with Web Crypto', () => {
  const SECRET = 'whsec_parity';
  const body = JSON.stringify({ id: 'evt_1', type: 'run.succeeded', created_at: '2026-11-19T00:00:00Z', data: { run: makeRun('ok') } });
  const now = () => Math.floor(Date.now() / 1000);
  const sign = (timestamp: number, payload: string = body, secret = SECRET) =>
    `v1=${createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')}`;

  afterEach(() => vi.useRealTimers());

  it('agrees with the synchronous verify on what verifies and what does not', async () => {
    const at = now();
    const cases: [string, number, string, string][] = [
      [SECRET, at, body, sign(at)],
      ['whsec_other', at, body, sign(at)],
      [SECRET, at, `${body} `, sign(at)],
      [SECRET, at - 301, body, sign(at - 301)],
      [SECRET, at, body, sign(at).toUpperCase()],
      [SECRET, at, body, 'v1=nothex'],
    ];
    const results = await Promise.all(cases.map(([secret, ts, payload, signature]) => verifyWebhookAsync(secret, ts, payload, signature)));
    expect(results).toEqual([true, false, false, false, false, false]);
    expect(cases.map(([secret, ts, payload, signature]) => verifyWebhook(secret, ts, payload, signature))).toEqual(results);
    expect(await verifyWebhookAsync(SECRET, String(at), new TextEncoder().encode(body).buffer, sign(at))).toBe(true);
  });

  it('parses the event it verified', async () => {
    const at = now();
    const event = await parseWebhookAsync(SECRET, at, body, sign(at));
    expect(event.type).toBe('run.succeeded');
    await expect(parseWebhookAsync(SECRET, at, body, sign(at, body, 'whsec_x'))).rejects.toThrow(/did not verify/);
  });
});
