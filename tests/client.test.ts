import { afterEach, describe, expect, it, vi } from 'vitest';

import EnrichedNow, {
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  EnrichedNow as Named,
  EnrichedNowError,
  VERSION,
} from '../src';
import pkg from '../package.json';
import { hang, json, makeClient, mockFetch } from './helpers';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the client', () => {
  it('is the default export and a named one', () => {
    expect(EnrichedNow).toBe(Named);
  });

  it('has the version of the package', () => {
    expect(VERSION).toBe(pkg.version);
  });

  it('reads the key from ENRICHEDNOW_API_KEY', () => {
    vi.stubEnv('ENRICHEDNOW_API_KEY', 'en_live_from_env');
    expect(new EnrichedNow({ fetch: mockFetch().fetch }).apiKey).toBe('en_live_from_env');
  });

  it('prefers the key it is given', () => {
    vi.stubEnv('ENRICHEDNOW_API_KEY', 'en_live_from_env');
    expect(new EnrichedNow({ apiKey: 'en_live_given', fetch: mockFetch().fetch }).apiKey).toBe('en_live_given');
  });

  it('says what to do when there is no key', () => {
    vi.stubEnv('ENRICHEDNOW_API_KEY', '');
    expect(() => new EnrichedNow()).toThrow(EnrichedNowError);
    expect(() => new EnrichedNow()).toThrow(/ENRICHEDNOW_API_KEY/);
  });

  it('refuses a maxRetries or a timeout that makes no sense', () => {
    expect(() => makeClient(mockFetch().fetch, { maxRetries: -1 })).toThrow(/maxRetries/);
    expect(() => makeClient(mockFetch().fetch, { timeout: 0 })).toThrow(/timeout/);
  });

  it('has the documented defaults', () => {
    const client = makeClient(mockFetch().fetch);
    expect(client.baseURL).toBe('https://api.enrichednow.com');
    expect(client.maxRetries).toBe(2);
    expect(client.timeout).toBe(60_000);
  });

  it('uses the global fetch when none is given', async () => {
    const mock = mockFetch(json({ status: 'ok' }));
    vi.stubGlobal('fetch', mock.fetch);
    await expect(new EnrichedNow({ apiKey: 'en_live_test' }).health()).resolves.toEqual({ status: 'ok' });
    expect(mock.calls).toHaveLength(1);
  });

  it('sends the key, the user agent and JSON headers', async () => {
    const mock = mockFetch(json({ status: 'ok' }));
    await makeClient(mock.fetch).health();
    const [call] = mock.calls;
    expect(call!.url.href).toBe('https://api.enrichednow.com/v1/health');
    expect(call!.method).toBe('GET');
    expect(call!.headers).toEqual({
      accept: 'application/json',
      authorization: 'Bearer en_live_test',
      'user-agent': `enrichednow-js/${pkg.version}`,
    });
  });

  it('takes a base URL, with or without a trailing slash', async () => {
    const mock = mockFetch(json({ status: 'ok' }));
    await makeClient(mock.fetch, { baseURL: 'http://localhost:8000/' }).health();
    expect(mock.calls[0]!.url.href).toBe('http://localhost:8000/v1/health');
  });

  it('adds default headers and per-request headers, and removes one set to null', async () => {
    const mock = mockFetch(json({ status: 'ok' }));
    const client = makeClient(mock.fetch, { defaultHeaders: { 'X-App': 'one', 'X-Other': 'kept' } });
    await client.health({ headers: { 'x-app': 'two', Accept: null } });
    expect(mock.calls[0]!.headers).toMatchObject({ 'x-app': 'two', 'x-other': 'kept' });
    expect(mock.calls[0]!.headers).not.toHaveProperty('accept');
  });

  it('sends a body as JSON through request()', async () => {
    const mock = mockFetch(json({ fine: true }));
    const body = await makeClient(mock.fetch).request({
      method: 'POST',
      path: 'v1/anything',
      query: { a: 1, b: undefined, c: null, d: ['x', 'y'], e: false },
      body: { hello: 'there' },
    });
    expect(body).toEqual({ fine: true });
    const [call] = mock.calls;
    expect(call!.url.pathname).toBe('/v1/anything');
    expect(call!.url.search).toBe('?a=1&d=x%2Cy&e=false');
    expect(call!.headers['content-type']).toBe('application/json');
    expect(call!.body).toEqual({ hello: 'there' });
  });

  it('returns undefined for an empty answer', async () => {
    const mock = mockFetch(new Response(null, { status: 204 }));
    await expect(makeClient(mock.fetch).request({ method: 'DELETE', path: '/v1/thing' })).resolves.toBeUndefined();
  });

  it('throws an APIError for a success that is not JSON', async () => {
    const mock = mockFetch(new Response('<html>hello</html>', { status: 200 }));
    await expect(makeClient(mock.fetch).health()).rejects.toMatchObject({ name: 'APIError', status: 200, body: '<html>hello</html>' });
  });
});

describe('aborting', () => {
  it('throws APIUserAbortError when the signal aborts during a request', async () => {
    const mock = mockFetch(hang);
    const controller = new AbortController();
    const pending = makeClient(mock.fetch).runs.get('run_1', { signal: controller.signal });
    setTimeout(() => controller.abort(), 5);
    await expect(pending).rejects.toBeInstanceOf(APIUserAbortError);
    expect(mock.calls).toHaveLength(1); // an abort is not retried
  });

  it('does not send a request whose signal has already aborted', async () => {
    const mock = mockFetch();
    const error = await makeClient(mock.fetch)
      .health({ signal: AbortSignal.abort() })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(APIUserAbortError);
    expect(error).toBeInstanceOf(APIError);
    expect(mock.calls).toHaveLength(0);
  });

  it('aborts the wait between two attempts', async () => {
    vi.useFakeTimers();
    const mock = mockFetch(json({ error: { code: 'internal', message: 'Broken.', details: {} } }, 500));
    const controller = new AbortController();
    const pending = makeClient(mock.fetch).health({ signal: controller.signal });
    const assertion = expect(pending).rejects.toBeInstanceOf(APIUserAbortError);
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    await assertion;
    expect(mock.calls).toHaveLength(1);
  });

  it('passes the signal on to every page of a list', async () => {
    const mock = mockFetch(json({ records: [1], next_cursor: 'Mg' }), hang);
    const controller = new AbortController();
    const seen: unknown[] = [];
    const reading = (async () => {
      for await (const record of makeClient(mock.fetch).runs.records('run_1', {}, { signal: controller.signal })) {
        seen.push(record);
        setTimeout(() => controller.abort(), 5);
      }
    })();
    await expect(reading).rejects.toBeInstanceOf(APIUserAbortError);
    expect(seen).toEqual([1]);
  });
});

describe('timeouts', () => {
  it('gives a request up after its timeout, and tries again', async () => {
    const mock = mockFetch(hang, hang, hang);
    const error = await makeClient(mock.fetch, { timeout: 10, maxRetries: 2 })
      .health()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(APIConnectionTimeoutError);
    expect((error as APIError).status).toBeUndefined();
    expect((error as Error).message).toMatch(/10 ms/);
    expect(mock.calls).toHaveLength(3);
  }, 10_000);

  it('takes a timeout for one request', async () => {
    const mock = mockFetch(hang);
    await expect(makeClient(mock.fetch).health({ timeout: 10, maxRetries: 0 })).rejects.toBeInstanceOf(APIConnectionTimeoutError);
  });
});
