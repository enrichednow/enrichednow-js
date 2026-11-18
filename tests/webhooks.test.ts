import { createHmac, randomBytes } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EnrichedNowError,
  NotFoundError,
  ServerError,
  ValidationError,
  WEBHOOK_EVENTS,
  WebhookVerificationError,
  parseWebhook,
  verifyWebhook,
} from '../src';
import type { WebhookDelivery, WebhookEndpoint, WebhookEvent } from '../src';
import { hmacSha256Hex } from '../src/webhooks';
import { apiError, json, makeClient, makeRun, mockFetch } from './helpers';

const HOOK = 'https://example.com/hooks/enrichednow';

const endpoint: WebhookEndpoint = {
  id: 'whk_1',
  url: HOOK,
  description: 'production',
  events: ['run.succeeded', 'run.failed'],
  enabled: true,
  disabled_reason: null,
  disabled_at: null,
  last_success_at: '2026-11-18T10:00:02Z',
  last_failure_at: null,
  created_at: '2026-11-18T09:00:00Z',
};

const delivery: WebhookDelivery = {
  id: 'whd_1',
  endpoint_id: 'whk_1',
  run_id: 'run_1',
  event_id: 'evt_1',
  event: 'run.succeeded',
  url: HOOK,
  status: 'failed',
  attempts: 10,
  max_attempts: 10,
  next_attempt_at: null,
  response_status: 500,
  error: 'http_error',
  duration_ms: 120,
  last_attempt_at: '2026-11-18T10:00:02Z',
  created_at: '2026-11-17T10:00:00Z',
  finished_at: '2026-11-18T10:00:02Z',
  resend_of: null,
};

const noContent = (): Response => new Response(null, { status: 204 });

/** The one request a call made: `METHOD /path?query`. */
function request(mock: ReturnType<typeof mockFetch>, index = 0): string {
  const call = mock.calls[index]!;
  return `${call.method} ${call.url.pathname}${call.url.search}`;
}

describe('webhookUrl on a run', () => {
  it('scrapers.run() sends webhook_url beside the input, only when given', async () => {
    const mock = mockFetch(json(makeRun('queued'), 202), json(makeRun('queued'), 202));
    const client = makeClient(mock.fetch);
    await client.scrapers.run('ats.board', { board_url: 'x' });
    await client.scrapers.run('ats.board', { board_url: 'x' }, { webhookUrl: HOOK });
    expect(mock.calls[0]!.body).toEqual({ input: { board_url: 'x' } });
    expect(mock.calls[1]!.body).toEqual({ input: { board_url: 'x' }, webhook_url: HOOK });
    expect(request(mock, 1)).toBe('POST /v1/scrapers/ats.board/runs');
  });

  it('scrape() passes it to the run it starts, and to nothing else', async () => {
    const mock = mockFetch(json(makeRun('running'), 202), json(makeRun('ok')), json({ records: [], next_cursor: null }), json(makeRun('ok')));
    const client = makeClient(mock.fetch);
    const { records } = await client.scrape('ats.board', { board_url: 'x' }, { webhookUrl: HOOK, pollInterval: 0 });
    await records.toArray();
    expect(mock.calls[0]!.body).toEqual({ input: { board_url: 'x' }, webhook_url: HOOK });
    expect(mock.calls.slice(1).map((call) => call.body)).toEqual([undefined, undefined]);
    expect(mock.calls.slice(1).every((call) => !call.url.search.includes('webhook'))).toBe(true);

    await client.scrape('ats.board', { board_url: 'x' });
    expect(mock.calls[3]!.body).toEqual({ input: { board_url: 'x' } });
  });
});

describe('webhooks', () => {
  it('list() returns the endpoints and whether the run secret is set', async () => {
    const mock = mockFetch(json({ endpoints: [endpoint], run_secret_set: true }));
    await expect(makeClient(mock.fetch).webhooks.list()).resolves.toEqual({ endpoints: [endpoint], run_secret_set: true });
    expect(request(mock)).toBe('GET /v1/webhooks');
  });

  it('create() posts the endpoint and returns it with its secret', async () => {
    const mock = mockFetch(json({ ...endpoint, secret: 'whsec_abc' }, 201));
    const made = await makeClient(mock.fetch).webhooks.create({ url: HOOK, events: ['run.succeeded', 'run.failed'], description: 'production' });
    expect(made.secret).toBe('whsec_abc');
    expect(made.id).toBe('whk_1');
    expect(request(mock)).toBe('POST /v1/webhooks');
    expect(mock.calls[0]!.body).toEqual({ url: HOOK, events: ['run.succeeded', 'run.failed'], description: 'production' });
  });

  it('create() is not sent again after a 5xx: the endpoint may exist', async () => {
    const mock = mockFetch(apiError(500, 'internal'));
    await expect(makeClient(mock.fetch).webhooks.create({ url: HOOK, events: ['run.failed'] })).rejects.toBeInstanceOf(ServerError);
    expect(mock.calls).toHaveLength(1);
  });

  it('create() refused is a ValidationError', async () => {
    const mock = mockFetch(apiError(422, 'invalid_input', 'The request is not valid.', { fields: [{ path: 'url', message: 'https only' }] }));
    const error = await makeClient(mock.fetch).webhooks.create({ url: 'http://example.com', events: ['run.failed'] }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe('invalid_input');
  });

  it('get() reads one endpoint', async () => {
    const mock = mockFetch(json(endpoint));
    await expect(makeClient(mock.fetch).webhooks.get('whk_1')).resolves.toEqual(endpoint);
    expect(request(mock)).toBe('GET /v1/webhooks/whk_1');
  });

  it('update() patches only what is given', async () => {
    const mock = mockFetch(json({ ...endpoint, enabled: false, description: '' }));
    const changed = await makeClient(mock.fetch).webhooks.update('whk_1', { enabled: false, description: '' });
    expect(changed.enabled).toBe(false);
    expect(request(mock)).toBe('PATCH /v1/webhooks/whk_1');
    expect(mock.calls[0]!.body).toEqual({ enabled: false, description: '' });
    expect(mock.calls[0]!.headers['content-type']).toBe('application/json');
  });

  it('delete() resolves to nothing on a 204', async () => {
    const mock = mockFetch(noContent());
    await expect(makeClient(mock.fetch).webhooks.delete('whk_1')).resolves.toBeUndefined();
    expect(request(mock)).toBe('DELETE /v1/webhooks/whk_1');
    expect(mock.calls[0]!.body).toBeUndefined();
  });

  it('delete() of an endpoint that is not there is a NotFoundError', async () => {
    const mock = mockFetch(apiError(404, 'not_found'));
    await expect(makeClient(mock.fetch).webhooks.delete('whk_9')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rotateSecret() returns the endpoint with its new secret', async () => {
    const mock = mockFetch(json({ ...endpoint, secret: 'whsec_new' }));
    const rotated = await makeClient(mock.fetch).webhooks.rotateSecret('whk_1');
    expect(rotated.secret).toBe('whsec_new');
    expect(request(mock)).toBe('POST /v1/webhooks/whk_1/rotate-secret');
    expect(mock.calls[0]!.body).toBeUndefined();
  });

  it('rotateSecret() is sent again after a 5xx: the secret that comes back is the one in use', async () => {
    vi.useFakeTimers();
    try {
      const mock = mockFetch(apiError(503, 'internal'), json({ ...endpoint, secret: 'whsec_new' }));
      const pending = makeClient(mock.fetch).webhooks.rotateSecret('whk_1');
      await vi.advanceTimersByTimeAsync(1000);
      await expect(pending).resolves.toMatchObject({ secret: 'whsec_new' });
      expect(mock.calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('createRunSecret() returns the secret', async () => {
    const mock = mockFetch(json({ secret: 'whsec_run' }));
    await expect(makeClient(mock.fetch).webhooks.createRunSecret()).resolves.toEqual({ secret: 'whsec_run' });
    expect(request(mock)).toBe('POST /v1/webhooks/run-secret');
  });

  it('escapes an id in the path', async () => {
    const mock = mockFetch(json(endpoint), json(delivery, 201));
    const client = makeClient(mock.fetch);
    await client.webhooks.get('../keys?x=1');
    await client.webhooks.deliveries.resend('a/b');
    expect(mock.calls[0]!.url.pathname).toBe('/v1/webhooks/..%2Fkeys%3Fx%3D1');
    expect(mock.calls[1]!.url.pathname).toBe('/v1/webhooks/deliveries/a%2Fb/resend');
  });

  it('passes request options through', async () => {
    const mock = mockFetch(json({ endpoints: [], run_secret_set: false }));
    await makeClient(mock.fetch).webhooks.list({ headers: { 'x-trace': 'abc' } });
    expect(mock.calls[0]!.headers['x-trace']).toBe('abc');
  });
});

describe('webhooks.deliveries', () => {
  it('list() sends its filters and walks every page', async () => {
    const mock = mockFetch(
      json({ deliveries: [{ ...delivery, id: 'whd_3' }, { ...delivery, id: 'whd_2', endpoint_id: null }], next_cursor: 'abc' }),
      json({ deliveries: [delivery], next_cursor: null }),
    );
    const ids: string[] = [];
    const list = makeClient(mock.fetch).webhooks.deliveries.list({ endpoint_id: 'whk_1', run_id: 'run_1', status: 'failed', limit: 2 });
    for await (const each of list) ids.push(each.id);
    expect(ids).toEqual(['whd_3', 'whd_2', 'whd_1']);
    expect(request(mock, 0)).toBe('GET /v1/webhooks/deliveries?endpoint_id=whk_1&run_id=run_1&status=failed&limit=2');
    expect(request(mock, 1)).toBe('GET /v1/webhooks/deliveries?endpoint_id=whk_1&run_id=run_1&status=failed&limit=2&cursor=abc');
  });

  it('list() awaited is one page', async () => {
    const mock = mockFetch(json({ deliveries: [delivery], next_cursor: 'abc' }));
    const page = await makeClient(mock.fetch).webhooks.deliveries.list();
    expect(page.data).toEqual([delivery]);
    expect(page.nextCursor).toBe('abc');
    expect(page.hasNextPage()).toBe(true);
    expect(request(mock)).toBe('GET /v1/webhooks/deliveries');
    expect(mock.calls).toHaveLength(1);
  });

  it('list() starts from a cursor', async () => {
    const mock = mockFetch(json({ deliveries: [], next_cursor: null }));
    await makeClient(mock.fetch).webhooks.deliveries.list({ cursor: 'abc' });
    expect(request(mock)).toBe('GET /v1/webhooks/deliveries?cursor=abc');
  });

  it('resend() posts to the delivery and returns the new one', async () => {
    const mock = mockFetch(json({ ...delivery, id: 'whd_9', status: 'pending', attempts: 0, resend_of: 'whd_1' }, 201));
    await expect(makeClient(mock.fetch).webhooks.deliveries.resend('whd_1')).resolves.toMatchObject({ id: 'whd_9', resend_of: 'whd_1' });
    expect(request(mock)).toBe('POST /v1/webhooks/deliveries/whd_1/resend');
    expect(mock.calls[0]!.body).toBeUndefined();
  });

  it('resend() is not sent again after a 5xx: the delivery may be queued', async () => {
    const mock = mockFetch(apiError(503, 'internal'));
    await expect(makeClient(mock.fetch).webhooks.deliveries.resend('whd_1')).rejects.toBeInstanceOf(ServerError);
    expect(mock.calls).toHaveLength(1);
  });
});

// --- verifying what arrives --------------------------------------------------------------------------------------------

const SECRET = 'whsec_test_4f1c2d3e';
const NOW = 1_700_000_000; // seconds
const EVENT: WebhookEvent = { id: 'evt_1', type: 'run.succeeded', created_at: '2026-11-18T10:00:02Z', data: { run: makeRun('ok') } };
const BODY = Buffer.from(JSON.stringify(EVENT), 'utf8');

/** The signature, made here with Node's own crypto and nothing of the library's. */
function sign(secret: string, timestamp: string | number, body: Uint8Array | string): string {
  return `v1=${createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex')}`;
}

describe('verifyWebhook()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW * 1000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a signature made independently with HMAC-SHA256', () => {
    expect(verifyWebhook(SECRET, String(NOW), BODY, sign(SECRET, NOW, BODY))).toBe(true);
  });

  it('accepts a signature worked out outside JavaScript', () => {
    // printf '1700000000.{"id":"evt_1"}' | openssl dgst -sha256 -hmac whsec_known
    const signature = 'v1=68a37d422c7a8b96c533eaf81281025cd110ae84fcf96e4f0307b1bad5f2a1cd';
    expect(verifyWebhook('whsec_known', '1700000000', '{"id":"evt_1"}', signature)).toBe(true);
    expect(verifyWebhook('whsec_known', '1700000000', '{"id":"evt_2"}', signature)).toBe(false);
  });

  it('takes the body as a Buffer, a Uint8Array, an ArrayBuffer or a string (UTF-8)', () => {
    const text = '{"note":"café ☕ 𝄞"}';
    const bytes = Buffer.from(text, 'utf8');
    const signature = sign(SECRET, NOW, bytes);
    expect(verifyWebhook(SECRET, String(NOW), bytes, signature)).toBe(true);
    expect(verifyWebhook(SECRET, String(NOW), new Uint8Array(bytes), signature)).toBe(true);
    expect(verifyWebhook(SECRET, String(NOW), new Uint8Array(bytes).buffer, signature)).toBe(true);
    expect(verifyWebhook(SECRET, String(NOW), text, signature)).toBe(true);
    expect(verifyWebhook(SECRET, NOW, text, signature)).toBe(true); // the timestamp as a number too
  });

  it('reads only the bytes of a view, not the whole buffer under it', () => {
    const padded = Buffer.concat([Buffer.from('xx'), BODY, Buffer.from('yy')]);
    const view = padded.subarray(2, 2 + BODY.length);
    expect(verifyWebhook(SECRET, String(NOW), view, sign(SECRET, NOW, BODY))).toBe(true);
  });

  it('refuses a different secret', () => {
    expect(verifyWebhook('whsec_other', String(NOW), BODY, sign(SECRET, NOW, BODY))).toBe(false);
    expect(verifyWebhook('', String(NOW), BODY, sign('', NOW, BODY))).toBe(false); // no secret verifies nothing
  });

  it('refuses a changed body', () => {
    const signature = sign(SECRET, NOW, BODY);
    expect(verifyWebhook(SECRET, String(NOW), Buffer.concat([BODY, Buffer.from(' ')]), signature)).toBe(false);
    expect(verifyWebhook(SECRET, String(NOW), BODY.toString('utf8').replace('run.succeeded', 'run.failed'), signature)).toBe(false);
    expect(verifyWebhook(SECRET, String(NOW), JSON.stringify(JSON.parse(BODY.toString('utf8')), null, 1), signature)).toBe(false);
  });

  it('refuses a changed timestamp', () => {
    expect(verifyWebhook(SECRET, String(NOW + 1), BODY, sign(SECRET, NOW, BODY))).toBe(false);
  });

  it('refuses a signature without the v1= prefix', () => {
    const signature = sign(SECRET, NOW, BODY);
    expect(verifyWebhook(SECRET, String(NOW), BODY, signature.slice('v1='.length))).toBe(false);
    expect(verifyWebhook(SECRET, String(NOW), BODY, `v2=${signature.slice(3)}`)).toBe(false);
    expect(verifyWebhook(SECRET, String(NOW), BODY, signature.toUpperCase())).toBe(false);
  });

  it.each([[''], [undefined], [null], ['v1='], ['v1=zz'], ['é'], [5], [['v1=00']]])('refuses the signature %j', (signature) => {
    expect(verifyWebhook(SECRET, String(NOW), BODY, signature as string)).toBe(false);
  });

  it.each([[''], ['abc'], ['12.5'], ['1e9'], [' 1700000000'], ['+1700000000'], ['0x10'], [undefined], [null], [1.5], [NaN], [Infinity], [-NOW], [true]])(
    'refuses the timestamp %j, which is not whole seconds',
    (timestamp) => {
      expect(verifyWebhook(SECRET, timestamp as string, BODY, sign(SECRET, String(timestamp), BODY))).toBe(false);
    },
  );

  it('refuses a timestamp older than the tolerance, or from too far ahead', () => {
    const signature = sign(SECRET, NOW, BODY);
    vi.setSystemTime((NOW + 300) * 1000);
    expect(verifyWebhook(SECRET, String(NOW), BODY, signature)).toBe(true);
    vi.setSystemTime((NOW + 301) * 1000);
    expect(verifyWebhook(SECRET, String(NOW), BODY, signature)).toBe(false);
    expect(verifyWebhook(SECRET, String(NOW), BODY, signature, { toleranceSeconds: 600 })).toBe(true);
    vi.setSystemTime((NOW - 300) * 1000);
    expect(verifyWebhook(SECRET, String(NOW), BODY, signature)).toBe(true);
    vi.setSystemTime((NOW - 301) * 1000);
    expect(verifyWebhook(SECRET, String(NOW), BODY, signature)).toBe(false);
    vi.setSystemTime((NOW + 2) * 1000);
    expect(verifyWebhook(SECRET, String(NOW), BODY, signature, { toleranceSeconds: 1 })).toBe(false);
    expect(verifyWebhook(SECRET, String(NOW), BODY, signature, { toleranceSeconds: NaN })).toBe(false);
  });

  it('never throws for a body that is not bytes', () => {
    expect(verifyWebhook(SECRET, String(NOW), { id: 'evt_1' } as unknown as string, sign(SECRET, NOW, '[object Object]'))).toBe(false);
    expect(verifyWebhook(SECRET, String(NOW), undefined as unknown as string, sign(SECRET, NOW, ''))).toBe(false);
  });
});

describe('the HMAC-SHA256 the library carries', () => {
  const hmac = (secret: string, message: Uint8Array): string => createHmac('sha256', secret).update(message).digest('hex');
  const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

  it('agrees with RFC 4231, test case 2', () => {
    expect(hmacSha256Hex(bytes('Jefe'), bytes('what do ya want for nothing?'))).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  it('agrees with Node for every message length around the block size', () => {
    for (let length = 0; length <= 260; length++) {
      const message = randomBytes(length);
      expect(hmacSha256Hex(bytes(SECRET), message), `length ${length}`).toBe(hmac(SECRET, message));
    }
  });

  it('agrees with Node for keys shorter than, as long as, and longer than a block', () => {
    const message = randomBytes(1000);
    for (const length of [1, 31, 32, 55, 56, 63, 64, 65, 100, 200]) {
      const secret = 'k'.repeat(length);
      expect(hmacSha256Hex(bytes(secret), message), `key length ${length}`).toBe(hmac(secret, message));
    }
  });

  it('agrees with Node for a large body', () => {
    const message = randomBytes(1_000_003);
    expect(hmacSha256Hex(bytes(SECRET), message)).toBe(hmac(SECRET, message));
  });
});

describe('parseWebhook()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW * 1000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the event of a request that verifies', () => {
    const event = parseWebhook(SECRET, String(NOW), BODY, sign(SECRET, NOW, BODY));
    expect(event).toEqual(EVENT);
    expect(event.data.run.status).toBe('ok');
    expect(parseWebhook(SECRET, String(NOW), BODY.toString('utf8'), sign(SECRET, NOW, BODY)).id).toBe('evt_1');
  });

  it('throws WebhookVerificationError for a request that does not verify', () => {
    const attempt = (): WebhookEvent => parseWebhook('whsec_other', String(NOW), BODY, sign(SECRET, NOW, BODY));
    expect(attempt).toThrow(WebhookVerificationError);
    expect(attempt).toThrow(EnrichedNowError);
    try {
      attempt();
    } catch (error) {
      expect((error as Error).name).toBe('WebhookVerificationError');
      expect((error as Error).message).not.toContain('whsec_');
    }
    expect(() => parseWebhook(SECRET, String(NOW), BODY, undefined)).toThrow(WebhookVerificationError);
  });

  it('honours the tolerance', () => {
    const signature = sign(SECRET, NOW - 400, BODY);
    expect(() => parseWebhook(SECRET, String(NOW - 400), BODY, signature)).toThrow(WebhookVerificationError);
    expect(parseWebhook(SECRET, String(NOW - 400), BODY, signature, { toleranceSeconds: 600 }).id).toBe('evt_1');
  });

  it.each([['not json'], ['[1, 2]'], ['"text"'], ['null']])('throws for a signed body that is not an event: %s', (body) => {
    expect(() => parseWebhook(SECRET, String(NOW), body, sign(SECRET, NOW, body))).toThrow(WebhookVerificationError);
  });

  it('throws for a signed body that is not UTF-8', () => {
    const body = new Uint8Array([0xff, 0xfe]);
    expect(() => parseWebhook(SECRET, String(NOW), body, sign(SECRET, NOW, body))).toThrow(WebhookVerificationError);
  });
});

describe('WEBHOOK_EVENTS', () => {
  it('names every event', () => {
    expect(WEBHOOK_EVENTS).toEqual(['run.succeeded', 'run.partial', 'run.failed', 'run.unsupported', 'run.cancelled']);
  });
});
