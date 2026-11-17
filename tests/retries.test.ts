import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APIConnectionError, APIConnectionTimeoutError, RateLimitError, ServerError } from '../src';
import { apiError, hang, json, makeClient, makeRun, mockFetch } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0); // no jitter: the waits are 500 ms, 1 s, 2 s, ...
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Let every wait pass, and say how the call ended. */
async function settle<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
  const outcome = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  return outcome;
}

const broken = () => apiError(500, 'internal', 'Something went wrong on our side.');

describe('retries of a request that is safe to repeat', () => {
  it('tries again after a 500 and returns the answer', async () => {
    const mock = mockFetch(broken(), json({ status: 'ok' }));
    const { value } = await settle(makeClient(mock.fetch).health());
    expect(value).toEqual({ status: 'ok' });
    expect(mock.calls).toHaveLength(2);
  });

  it('tries again after 503 data_unavailable', async () => {
    const mock = mockFetch(apiError(503, 'data_unavailable'), json({ postings: [], next_cursor: null }));
    const { value } = await settle(makeClient(mock.fetch).data.postings.list().toArray());
    expect(value).toEqual([]);
    expect(mock.calls).toHaveLength(2);
  });

  it('tries again after a failed connection', async () => {
    const mock = mockFetch(new TypeError('fetch failed'), new TypeError('fetch failed'), json({ status: 'ok' }));
    const { value } = await settle(makeClient(mock.fetch).health());
    expect(value).toEqual({ status: 'ok' });
    expect(mock.calls).toHaveLength(3);
  });

  it('gives up after maxRetries and throws the last error', async () => {
    const mock = mockFetch(broken(), broken(), broken());
    const { error } = await settle(makeClient(mock.fetch).health());
    expect(error).toBeInstanceOf(ServerError);
    expect(mock.calls).toHaveLength(3); // the request and 2 retries
  });

  it('throws the connection error when every attempt fails to connect', async () => {
    const mock = mockFetch(new TypeError('fetch failed'), new TypeError('fetch failed'), new TypeError('fetch failed'));
    const { error } = await settle(makeClient(mock.fetch).health());
    expect(error).toBeInstanceOf(APIConnectionError);
    expect(mock.calls).toHaveLength(3);
  });

  it('takes maxRetries from the client and from the request', async () => {
    const none = mockFetch(broken());
    expect((await settle(makeClient(none.fetch, { maxRetries: 0 }).health())).error).toBeInstanceOf(ServerError);
    expect(none.calls).toHaveLength(1);

    const four = mockFetch(broken(), broken(), broken(), broken(), json({ status: 'ok' }));
    expect((await settle(makeClient(four.fetch).health({ maxRetries: 4 }))).value).toEqual({ status: 'ok' });
    expect(four.calls).toHaveLength(5);
  });

  it('waits 0.5 s, then 1 s, then 2 s', async () => {
    const mock = mockFetch(broken(), broken(), broken(), json({ status: 'ok' }));
    const pending = makeClient(mock.fetch, { maxRetries: 3 }).health();
    await vi.advanceTimersByTimeAsync(0);
    expect(mock.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(499);
    expect(mock.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mock.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(999);
    expect(mock.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(mock.calls).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1999);
    expect(mock.calls).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(mock.calls).toHaveLength(4);
    await expect(pending).resolves.toEqual({ status: 'ok' });
  });

  it('shortens a wait by up to a quarter (jitter) and never waits more than 8 s', async () => {
    vi.mocked(Math.random).mockReturnValue(1);
    const jitter = mockFetch(broken(), json({ status: 'ok' }));
    const pending = makeClient(jitter.fetch).health();
    await vi.advanceTimersByTimeAsync(374);
    expect(jitter.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(jitter.calls).toHaveLength(2);
    await pending;

    vi.mocked(Math.random).mockReturnValue(0);
    const capped = mockFetch(...Array.from({ length: 6 }, broken), json({ status: 'ok' }));
    const long = makeClient(capped.fetch, { maxRetries: 6 }).health();
    await vi.advanceTimersByTimeAsync(500 + 1000 + 2000 + 4000 + 8000);
    expect(capped.calls).toHaveLength(6);
    await vi.advanceTimersByTimeAsync(7999);
    expect(capped.calls).toHaveLength(6);
    await vi.advanceTimersByTimeAsync(1);
    expect(capped.calls).toHaveLength(7);
    await long;
  });

  it('waits as long as Retry-After says after a 429', async () => {
    const mock = mockFetch(apiError(429, 'rate_limited', 'Too many attempts.', {}, { 'Retry-After': '7' }), json({ status: 'ok' }));
    const pending = makeClient(mock.fetch).health();
    await vi.advanceTimersByTimeAsync(6999);
    expect(mock.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mock.calls).toHaveLength(2);
    await expect(pending).resolves.toEqual({ status: 'ok' });
  });

  it('reads a Retry-After that is a date', async () => {
    vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
    const mock = mockFetch(
      apiError(429, 'rate_limited', 'Too many attempts.', {}, { 'Retry-After': 'Wed, 18 Nov 2026 10:00:03 GMT' }),
      json({ status: 'ok' }),
    );
    const pending = makeClient(mock.fetch).health();
    await vi.advanceTimersByTimeAsync(2999);
    expect(mock.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mock.calls).toHaveLength(2);
    await pending;
  });

  it('does not wait for a Retry-After of more than a minute: it throws, with the wait on the error', async () => {
    const mock = mockFetch(apiError(429, 'rate_limited', 'Too many attempts.', {}, { 'Retry-After': '120' }));
    const { error } = await settle(makeClient(mock.fetch).health());
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfter).toBe(120);
    expect(mock.calls).toHaveLength(1);
  });

  it.each([
    [401, 'unauthorized'],
    [402, 'quota_exceeded'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [422, 'invalid_input'],
  ])('does not try again after %i %s', async (status, code) => {
    const mock = mockFetch(apiError(status, code));
    const { error } = await settle(makeClient(mock.fetch).runs.get('run_1'));
    expect(error).toMatchObject({ status, code });
    expect(mock.calls).toHaveLength(1);
  });

  it('tries a cancel again: cancelling twice is cancelling once', async () => {
    const mock = mockFetch(broken(), new TypeError('fetch failed'), json(makeRun('cancelled')));
    const { value } = await settle(makeClient(mock.fetch).runs.cancel('run_1'));
    expect(value).toMatchObject({ status: 'cancelled' });
    expect(mock.calls).toHaveLength(3);
  });
});

describe('starting a run is not repeated blindly', () => {
  it('is not sent again after a 500: the run may exist', async () => {
    const mock = mockFetch(broken());
    const { error } = await settle(makeClient(mock.fetch).scrapers.run('ats.board', {}));
    expect(error).toBeInstanceOf(ServerError);
    expect(mock.calls).toHaveLength(1);
  });

  it('is not sent again after a failed connection', async () => {
    const mock = mockFetch(new TypeError('fetch failed'));
    const { error } = await settle(makeClient(mock.fetch).scrapers.run('ats.board', {}));
    expect(error).toBeInstanceOf(APIConnectionError);
    expect(mock.calls).toHaveLength(1);
  });

  it('is not sent again after a timeout', async () => {
    const mock = mockFetch(hang);
    const { error } = await settle(makeClient(mock.fetch).scrapers.run('ats.board', {}, { timeout: 1000 }));
    expect(error).toBeInstanceOf(APIConnectionTimeoutError);
    expect(mock.calls).toHaveLength(1);
  });

  it('is sent again after 429 too_many_runs: no run was created', async () => {
    const tooMany = () => apiError(429, 'too_many_runs', 'Wait for one to end.', { active_runs: 2, max_concurrent_runs: 2 });
    const mock = mockFetch(tooMany(), json(makeRun('queued'), 202));
    const { value } = await settle(makeClient(mock.fetch).scrapers.run('ats.board', {}));
    expect(value).toMatchObject({ status: 'queued' });
    expect(mock.calls).toHaveLength(2);

    const still = mockFetch(tooMany(), tooMany(), tooMany());
    const { error } = await settle(makeClient(still.fetch).scrapers.run('ats.board', {}));
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error).toMatchObject({ code: 'too_many_runs', activeRuns: 2 });
    expect(still.calls).toHaveLength(3);
  });

  it('gives the request more time than the `wait` it asks for', async () => {
    const mock = mockFetch(hang);
    const pending = makeClient(mock.fetch).scrapers.run('ats.board', {}, { wait: 60 });
    const assertion = expect(pending).rejects.toBeInstanceOf(APIConnectionTimeoutError);
    await vi.advanceTimersByTimeAsync(89_999);
    expect(mock.calls[0]!.signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });
});
