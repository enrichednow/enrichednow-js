import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APIUserAbortError, EnrichedNowError, RunFailedError, RunTimeoutError, ServerError } from '../src';
import { apiError, json, makeClient, makeRun, mockFetch } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function settle<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
  const outcome = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  return outcome;
}

const paths = (mock: ReturnType<typeof mockFetch>) => mock.calls.map((call) => `${call.method} ${call.url.pathname}${call.url.search}`);

describe('runs.wait()', () => {
  it('looks at the run every 2 s until it has ended', async () => {
    const mock = mockFetch(json(makeRun('queued')), json(makeRun('running')), json(makeRun('ok')));
    const pending = makeClient(mock.fetch).runs.wait('run_1');
    await vi.advanceTimersByTimeAsync(0);
    expect(mock.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(mock.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mock.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(mock.calls).toHaveLength(3);
    await expect(pending).resolves.toMatchObject({ status: 'ok' });
    expect(paths(mock)).toEqual(['GET /v1/runs/run_1', 'GET /v1/runs/run_1', 'GET /v1/runs/run_1']);
  });

  it('returns at once when the run has already ended', async () => {
    const mock = mockFetch(json(makeRun('partial')));
    const { value } = await settle(makeClient(mock.fetch).runs.wait('run_1'));
    expect(value).toMatchObject({ status: 'partial' });
    expect(mock.calls).toHaveLength(1);
  });

  it.each(['failed', 'unsupported', 'cancelled'] as const)('returns a run that ended %s; it does not throw', async (status) => {
    const mock = mockFetch(json(makeRun('running')), json(makeRun(status)));
    const { value } = await settle(makeClient(mock.fetch).runs.wait('run_1'));
    expect(value).toMatchObject({ status });
  });

  it('takes a pollInterval', async () => {
    const mock = mockFetch(json(makeRun('running')), json(makeRun('ok')));
    const pending = makeClient(mock.fetch).runs.wait('run_1', { pollInterval: 250 });
    await vi.advanceTimersByTimeAsync(249);
    expect(mock.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mock.calls).toHaveLength(2);
    await pending;
  });

  it('throws RunTimeoutError, with the run, when the run is still going after the timeout', async () => {
    const mock = mockFetch(...Array.from({ length: 4 }, () => json(makeRun('running'))));
    const { error } = await settle(makeClient(mock.fetch).runs.wait('run_1', { timeout: 5000 }));
    expect(error).toBeInstanceOf(RunTimeoutError);
    expect(error).toBeInstanceOf(EnrichedNowError);
    expect(error).toMatchObject({ runId: 'run_841742f37553189ff9c27ba1', run: { status: 'running' } });
    expect((error as Error).message).toMatch(/5000 ms/);
    expect(mock.calls).toHaveLength(4); // at 0, 2, 4 and 5 seconds
  });

  it('stops waiting when the signal aborts', async () => {
    const mock = mockFetch(json(makeRun('running')));
    const controller = new AbortController();
    const pending = makeClient(mock.fetch).runs.wait('run_1', { signal: controller.signal });
    const assertion = expect(pending).rejects.toBeInstanceOf(APIUserAbortError);
    await vi.advanceTimersByTimeAsync(1000);
    controller.abort();
    await assertion;
    expect(mock.calls).toHaveLength(1);
  });

  it('survives a 500 while it waits', async () => {
    const mock = mockFetch(json(makeRun('running')), apiError(500, 'internal'), json(makeRun('ok')));
    const { value } = await settle(makeClient(mock.fetch).runs.wait('run_1'));
    expect(value).toMatchObject({ status: 'ok' });
  });
});

describe('scrape()', () => {
  const input = { board_url: 'https://boards.greenhouse.io/acme' };

  it('starts a run with wait=60 and returns it with its records when it ended in time', async () => {
    const mock = mockFetch(json(makeRun('ok')), json({ records: [{ title: 'A' }, { title: 'B' }], next_cursor: null }));
    const client = makeClient(mock.fetch);
    const { value } = await settle(client.scrape<{ title: string }>('ats.board', input));
    const { run, records } = value!;

    expect(run).toMatchObject({ status: 'ok', record_count: 2 });
    expect(paths(mock)).toEqual(['POST /v1/scrapers/ats.board/runs?wait=60']); // the records are not fetched yet
    expect(mock.calls[0]!.body).toEqual({ input });

    const titles: string[] = [];
    for await (const record of records) titles.push(record.title);
    expect(titles).toEqual(['A', 'B']);
    expect(paths(mock)[1]).toBe(`GET /v1/runs/${run.id}/records`);
  });

  it('collects the records with toArray()', async () => {
    const mock = mockFetch(
      json(makeRun('ok')),
      json({ records: [{ n: 1 }], next_cursor: 'MQ' }),
      json({ records: [{ n: 2 }], next_cursor: null }),
    );
    const { value } = await settle(makeClient(mock.fetch).scrape('ats.board', input, { pageSize: 1 }));
    await expect(value!.records.toArray()).resolves.toEqual([{ n: 1 }, { n: 2 }]);
    expect(paths(mock).slice(1)).toEqual([
      'GET /v1/runs/run_841742f37553189ff9c27ba1/records?limit=1',
      'GET /v1/runs/run_841742f37553189ff9c27ba1/records?limit=1&cursor=MQ',
    ]);
  });

  it('waits on when the run is still going after the first request', async () => {
    const mock = mockFetch(json(makeRun('running'), 202), json(makeRun('running')), json(makeRun('ok')));
    const pending = makeClient(mock.fetch).scrape('ats.board', input);
    await vi.advanceTimersByTimeAsync(1999);
    expect(mock.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mock.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2000);
    const { run } = await pending;
    expect(run.status).toBe('ok');
    expect(paths(mock)).toEqual([
      'POST /v1/scrapers/ats.board/runs?wait=60',
      'GET /v1/runs/run_841742f37553189ff9c27ba1',
      'GET /v1/runs/run_841742f37553189ff9c27ba1',
    ]);
  });

  it.each([
    ['failed', 'fetch_failed'],
    ['unsupported', 'render_required'],
    ['cancelled', 'cancelled'],
  ] as const)('throws RunFailedError for a run that ended %s', async (status, reason) => {
    const mock = mockFetch(json(makeRun(status, { reason })));
    const { error } = await settle(makeClient(mock.fetch).scrape('ats.board', input));
    expect(error).toBeInstanceOf(RunFailedError);
    expect(error).toBeInstanceOf(EnrichedNowError);
    expect(error).toMatchObject({ name: 'RunFailedError', status, reason, runId: 'run_841742f37553189ff9c27ba1', run: { status, reason } });
    expect((error as Error).message).toContain(status);
    expect((error as Error).message).toContain(reason);
    expect(mock.calls).toHaveLength(1);
  });

  it('throws RunFailedError for a run that failed while it was waited for', async () => {
    const mock = mockFetch(json(makeRun('queued'), 202), json(makeRun('failed', { reason: 'deadline_exceeded' })));
    const { error } = await settle(makeClient(mock.fetch).scrape('ats.board', input));
    expect(error).toMatchObject({ name: 'RunFailedError', status: 'failed', reason: 'deadline_exceeded' });
  });

  it('returns the failed run instead when told not to throw', async () => {
    const mock = mockFetch(json(makeRun('failed')), json({ records: [], next_cursor: null }));
    const { value, error } = await settle(makeClient(mock.fetch).scrape('ats.board', input, { throwOnFailure: false }));
    expect(error).toBeUndefined();
    expect(value!.run).toMatchObject({ status: 'failed', reason: 'fetch_failed' });
    await expect(value!.records.toArray()).resolves.toEqual([]);
  });

  it('returns a partial run: it has records', async () => {
    const mock = mockFetch(json(makeRun('partial', { reason: 'render_required', record_count: 12 })));
    const { value } = await settle(makeClient(mock.fetch).scrape('careers.company', { domain: 'acme.com' }));
    expect(value!.run).toMatchObject({ status: 'partial', reason: 'render_required' });
  });

  it('throws RunTimeoutError when the run does not end within the timeout', async () => {
    const mock = mockFetch(json(makeRun('running'), 202), ...Array.from({ length: 5 }, () => json(makeRun('running'))));
    const { error } = await settle(makeClient(mock.fetch).scrape('ats.board', input, { timeout: 5000 }));
    expect(error).toBeInstanceOf(RunTimeoutError);
    expect((error as Error).message).toMatch(/5000 ms/);
    expect(mock.calls[0]!.url.search).toBe('?wait=5'); // the first request is not held open past the timeout
  });

  it('takes wait and pollInterval', async () => {
    const mock = mockFetch(json(makeRun('running'), 202), json(makeRun('ok')));
    const pending = makeClient(mock.fetch).scrape('ats.board', input, { wait: 10, pollInterval: 100 });
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(paths(mock)[0]).toBe('POST /v1/scrapers/ats.board/runs?wait=10');
    expect(mock.calls).toHaveLength(2);
  });

  it('does not start a second run after a 500', async () => {
    const mock = mockFetch(apiError(500, 'internal'));
    const { error } = await settle(makeClient(mock.fetch).scrape('ats.board', input));
    expect(error).toBeInstanceOf(ServerError);
    expect(mock.calls).toHaveLength(1);
  });

  it('passes validation errors through', async () => {
    const fields = [{ path: 'input.board_url', message: 'Field required' }];
    const mock = mockFetch(apiError(422, 'invalid_input', 'The input is not valid.', { fields }));
    const { error } = await settle(makeClient(mock.fetch).scrape('ats.board', {}));
    expect(error).toMatchObject({ name: 'ValidationError', fields });
  });

  it('stops when the signal aborts', async () => {
    const mock = mockFetch(json(makeRun('running'), 202));
    const controller = new AbortController();
    const pending = makeClient(mock.fetch).scrape('ats.board', input, { signal: controller.signal });
    const assertion = expect(pending).rejects.toBeInstanceOf(APIUserAbortError);
    await vi.advanceTimersByTimeAsync(500);
    controller.abort();
    await assertion;
    expect(mock.calls).toHaveLength(1);
  });
});
