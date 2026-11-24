import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  APIConnectionTimeoutError,
  APIUserAbortError,
  EnrichedNowError,
  FormulaRunFailedError,
  Page,
  PagePromise,
  RunFailedError,
  RunTimeoutError,
  ServerError,
} from '../src';
import type { FormulaRow, FormulaRun, JobOrderHunterParams } from '../src';
import { answer, answerBody, apiError, expectRequest, fixture, hang, json, makeClient, mockFetch, replay } from './helpers';
import type { Exchange } from './helpers';

/** The parameters the recordings ran `job-order-hunter` with. */
const PARAMS = {
  job_titles: ['Java Developer'],
  locations: ['London'],
  posted_within_days: 2,
  title_exclude_keywords: ['intern'],
  exclude_companies: ['Blocked By Us Inc'],
  company_size: { min: 11, max: 5000 },
} satisfies JobOrderHunterParams;

const RUN_ID = 'frun_000000000000000000000002';

const text = (chunks: Uint8Array[]): string => chunks.map((chunk) => new TextDecoder().decode(chunk)).join('');

async function collect(pieces: AsyncIterable<Uint8Array>): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const piece of pieces) chunks.push(piece);
  return text(chunks);
}

/** A page after the recorded one: the same shape, the last page. */
function lastPage(name: string, list: string, items: unknown[]): Response {
  const recorded = answerBody(name);
  return json({ ...recorded, [list]: items, next_cursor: null });
}

/** Make a call with fake timers, every pause (between retries) passing at once. */
async function quickly<T>(call: () => Promise<T>): Promise<T> {
  vi.useFakeTimers();
  try {
    const outcome = call().then(
      (value) => ({ value }),
      (error: unknown) => ({ value: undefined as T, error }),
    );
    await vi.runAllTimersAsync();
    const settled: { value: T; error?: unknown } = await outcome;
    if ('error' in settled) throw settled.error;
    return settled.value;
  } finally {
    vi.useRealTimers();
  }
}

describe('formulas', () => {
  it('list() returns the catalogue', async () => {
    const mock = replay('formulas_list');
    const formulas = await makeClient(mock.fetch).formulas.list();
    mock.expectRequests();
    expect(formulas.map((formula) => formula.id)).toEqual(['data-formula', 'job-order-hunter', 'posting-watch']);
    expect(formulas[1]).toMatchObject({ status: 'beta', available: true, needs_attestation: true, schedules: ['daily', 'weekdays', 'weekly'] });
    expect(formulas[0]!.health).toEqual({ status: 'ok', degraded_sources: [], success_rate_7d: null, median_seconds_7d: null });
    expect(formulas[1]!.basics.map((input) => [input.name, input.required])).toEqual([
      ['job_titles', true],
      ['locations', true],
      ['posted_within_days', false],
    ]);
    expect(formulas[1]!.basics[0]).toMatchObject({ title: 'Job titles', type: 'list of strings' });
  });

  it('list() narrows by words and category', async () => {
    const mock = replay('formulas_list_filtered');
    const formulas = await makeClient(mock.fetch).formulas.list({ query: 'hiring', category: 'recruiting' });
    mock.expectRequests();
    expect(formulas.map((formula) => formula.id)).toEqual(['job-order-hunter']);
  });

  it('get() returns one formula, with its parameters, columns, needs and sample rows', async () => {
    const mock = replay('formulas_get');
    const formula = await makeClient(mock.fetch).formulas.get('job-order-hunter');
    mock.expectRequests();
    expect(formula).toEqual(mock.exchanges[0]!.response.body);
    expect(formula.parameters['required']).toEqual(['job_titles', 'locations']);
    expect(formula.columns[0]).toEqual({ key: 'company_name', label: 'Company', type: 'string', default_visible: true });
    expect(formula.company_view).toMatchObject({ key: 'company_domain', label: 'One row per company' });
    expect(formula.requirements.capabilities).toEqual(['people_search', 'contact_find', 'email_verify']);
    expect(formula.limits['min_unit_cap']).toBe(20);
    expect(formula.sample_rows).toHaveLength(20);
    expect(formula.sample_is_fixture).toBe(false);
    expect(formula.presets[0]).toMatchObject({ id: 'it-contract-uk', label: 'IT contract desk (UK)' });
  });

  it('estimate() sends the parameters and the caps given, and is free', async () => {
    const mock = replay('formulas_estimate');
    const estimate = await makeClient(mock.fetch).formulas.estimate('job-order-hunter', PARAMS, { unitCap: 2000 });
    mock.expectRequests();
    expect(estimate).toEqual({
      valid: true,
      errors: [],
      estimate: { min_units: 1, expected_units: 63, max_units: 1425, expected_rows: 1, basis: '2 searches across 2 sources, about 1 row' },
      missing: [],
      not_offered: ['google.jobs'],
    });
  });

  it('estimate() answers parameters that cannot run with valid: false, not an error', async () => {
    const mock = replay('formulas_estimate_invalid');
    // An unknown shape on purpose: this is what a form sends as the customer types.
    const estimate = await makeClient(mock.fetch).formulas.estimate<string>('job-order-hunter', { locations: ['London'] });
    mock.expectRequests();
    expect(estimate).toMatchObject({ valid: false, estimate: null, errors: [{ path: 'params.job_titles', message: 'This is required.' }] });
  });

  it('estimate() of a preview sends the mode, and is retried: it spends nothing', async () => {
    const mock = mockFetch(apiError(500, 'internal'), () => answer(fixture('formulas_estimate')));
    await quickly(() => makeClient(mock.fetch).formulas.estimate('job-order-hunter', PARAMS, { preview: true, rowCap: 10 }));
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls[1]!.body).toEqual({ params: PARAMS, row_cap: 10, mode: 'preview' });
  });

  it('run() starts a preview, holds the request with wait, and sends the idempotency key', async () => {
    const mock = replay('formulas_run');
    const run = await makeClient(mock.fetch).formulas.run('job-order-hunter', PARAMS, { preview: true, wait: 60, idempotencyKey: 'c0ffee-run-2' });
    mock.expectRequests();
    expect(run).toMatchObject({
      id: 'frun_000000000000000000000003',
      formula_id: 'job-order-hunter',
      status: 'partial',
      reason: 'contacts_not_connected',
      mode: 'preview',
      unit_cap: 50,
      row_cap: 10,
      units_spent: 17,
      rows_total: 4,
    });
    expect(run.reasons).toEqual([{ code: 'contacts_not_connected' }, { code: 'source_not_offered', step: 'search_google_jobs', scraper: 'google.jobs' }]);
    expect(run.steps).toHaveLength(47);
    expect(run.steps![0]).toMatchObject({ id: 'search_ats', status: 'skipped', records_in: 0, units: 0 });
  });

  it('run() without wait comes back queued (202), and sends only what is given', async () => {
    const mock = replay('formulas_run_queued');
    const run = await makeClient(mock.fetch).formulas.run('job-order-hunter', PARAMS, { unitCap: 2000, idempotencyKey: 'c0ffee-run-1' });
    mock.expectRequests();
    expect(run).toMatchObject({ id: RUN_ID, status: 'queued', mode: 'full', steps: [] });
  });

  it('run() makes a key of its own, and keeps it across retries', async () => {
    const mock = mockFetch(apiError(500, 'internal'), new TypeError('fetch failed'), () => answer(fixture('formulas_run_queued')));
    await quickly(() => makeClient(mock.fetch).formulas.run('job-order-hunter', PARAMS));
    const keys = mock.calls.map((call) => call.headers['idempotency-key']);
    expect(keys).toHaveLength(3);
    expect(keys[0]).toMatch(/^[0-9a-f-]{32,36}$/);
    expect(new Set(keys).size).toBe(1);
  });

  it('run() gives the request more time than the wait it asks for', async () => {
    vi.useFakeTimers();
    try {
      const mock = mockFetch(hang);
      const pending = makeClient(mock.fetch, { maxRetries: 0 }).formulas.run('job-order-hunter', PARAMS, { wait: 120 });
      const assertion = expect(pending).rejects.toBeInstanceOf(APIConnectionTimeoutError);
      await vi.advanceTimersByTimeAsync(149_999);
      expect(mock.calls[0]!.signal!.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('a formula this library has no type for takes any parameters', async () => {
    const mock = mockFetch(() => answer(fixture('formulas_run_queued')));
    await makeClient(mock.fetch).formulas.run('a-new-formula', { anything: [1, 2], nested: { fine: true } });
    expect(mock.calls[0]!.url.pathname).toBe('/v1/formulas/a-new-formula/runs');
    expect(mock.calls[0]!.body).toEqual({ params: { anything: [1, 2], nested: { fine: true } } });
  });
});

describe('formula runs', () => {
  it('list() pages with next_cursor, and sends its filters under the API names', async () => {
    const recorded = fixture('formula_runs_list');
    const second = answerBody<{ runs: FormulaRun[] }>('formula_runs_list').runs.map((run) => ({ ...run, id: 'frun_000000000000000000000001' }));
    const mock = mockFetch(() => answer(recorded), () => lastPage('formula_runs_list', 'runs', second));
    const runs = await makeClient(mock.fetch).formulaRuns.list({ limit: 1 }).toArray();
    expectRequest(mock.calls[0]!, recorded);
    expect(Object.fromEntries(mock.calls[1]!.url.searchParams)).toEqual({ limit: '1', cursor: (recorded.response.body as { next_cursor: string }).next_cursor });
    expect(runs.map((run) => run.id)).toEqual(['frun_000000000000000000000003', 'frun_000000000000000000000001']);
    expect(runs[0]!.steps).toBeNull(); // steps are on one run, not in a list

    const filtered = mockFetch(json({ runs: [], next_cursor: null }));
    await makeClient(filtered.fetch).formulaRuns.list({ formulaId: 'job-order-hunter', savedFormulaId: 'sf_1', status: 'partial' });
    expect(Object.fromEntries(filtered.calls[0]!.url.searchParams)).toEqual({ formula_id: 'job-order-hunter', saved_formula_id: 'sf_1', status: 'partial' });
  });

  it('get() reads one run, with what each step did; with wait, held until it ends', async () => {
    const mock = replay('formula_runs_get_running', 'formula_runs_get');
    const client = makeClient(mock.fetch);
    const running = await client.formulaRuns.get(RUN_ID);
    const ended = await client.formulaRuns.get(RUN_ID, { wait: 60 });
    mock.expectRequests();
    expect(running).toMatchObject({ status: 'running', reason: null, units_spent: 0 });
    expect(running.steps).toEqual([expect.objectContaining({ id: 'search_linkedin', status: 'running', finished_at: null })]);
    expect(ended).toMatchObject({ status: 'partial', reason: 'contacts_not_connected', rows_total: 4, units_spent: 24 });
    expect(client.standing).toMatchObject({ unitsUsed: 24, unitsRemaining: 976, runsRemaining: 2 }); // formula answers carry it too
  });

  it('rows() walks every row of every page, passing the cursor back', async () => {
    const mock = replay('formula_runs_rows', 'formula_runs_rows_page2');
    const rows = await makeClient(mock.fetch).formulaRuns.rows(RUN_ID, { limit: 2 }).toArray();
    mock.expectRequests();
    expect(rows.map((row) => row.id)).toEqual([
      'frow_000000000000000000000001',
      'frow_000000000000000000000002',
      'frow_000000000000000000000003',
      'frow_000000000000000000000004',
    ]);
    expect(rows[0]).toMatchObject({ run_id: RUN_ID, score: 20, status: 'new', data: { company_name: 'Corvid', contact_email: 'careers@corvid-demo.com' } });
    expect(rows[0]!.evidence).toHaveProperty('sources');
  });

  it('rows() is a list like the others: nothing is asked until it is used, and a page is a Page', async () => {
    const mock = replay('formula_runs_rows', 'formula_runs_rows_page2');
    const rows = makeClient(mock.fetch).formulaRuns.rows<{ company_name: string }>(RUN_ID, { limit: 2 });
    expect(rows).toBeInstanceOf(PagePromise);
    expect(mock.calls).toHaveLength(0);
    const first = await rows;
    expect(first).toBeInstanceOf(Page);
    expect(first.nextCursor).toBe('Mg');
    expect(first.data[0]!.data.company_name).toBe('Corvid');
    const second = await first.getNextPage();
    expect(second.hasNextPage()).toBe(false);
  });

  it('rows() keeps the fields asked for, and rows scored at least minScore', async () => {
    const mock = replay('formula_runs_rows_fields');
    const rows = await makeClient(mock.fetch)
      .formulaRuns.rows(RUN_ID, { fields: ['company_name', 'job_title', 'contact_email'], minScore: 10 })
      .toArray();
    mock.expectRequests();
    expect(rows).toHaveLength(3);
    expect(Object.keys(rows[0]!.data).sort()).toEqual(['company_name', 'contact_email', 'job_title']);
  });

  it('rows() reads one row per company', async () => {
    const mock = replay('formula_runs_rows_company');
    const rows = await makeClient(mock.fetch).formulaRuns.rows(RUN_ID, { view: 'company' }).toArray();
    mock.expectRequests();
    expect(rows[0]).toMatchObject({ row_key: 'company:corvid-demo.com', data: { job_title: ['Java Developer (Remote)', 'Java Consultant'] } });
  });

  it('export() reads one page as CSV, with the next cursor from X-Next-Cursor', async () => {
    const mock = replay('formula_runs_rows_csv');
    const page = await makeClient(mock.fetch).formulaRuns.export(RUN_ID, { format: 'csv', limit: 2 });
    mock.expectRequests();
    expect(mock.calls[0]!.headers['accept']).toBe('text/csv');
    expect(page.format).toBe('csv');
    expect(page.text).toBe(mock.exchanges[0]!.response.text);
    expect(new TextDecoder().decode(page.body)).toBe(page.text);
    expect(page.nextCursor).toBe('Mg');
  });

  it('export() reads NDJSON, a row a line', async () => {
    const mock = replay('formula_runs_rows_ndjson');
    const page = await makeClient(mock.fetch).formulaRuns.export(RUN_ID, { format: 'ndjson' });
    mock.expectRequests();
    expect(mock.calls[0]!.headers['accept']).toBe('application/x-ndjson');
    expect(page.nextCursor).toBeNull();
    const lines = page.text.trimEnd().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(lines[0]).toMatchObject({ company_name: 'Corvid', job_title: 'Java Developer (Remote)' });
  });

  it('export() refuses a format the API does not write', async () => {
    const client = makeClient(mockFetch().fetch);
    // @ts-expect-error: not a format
    await expect(client.formulaRuns.export(RUN_ID, { format: 'xml' })).rejects.toThrow(TypeError);
  });

  it('exportAll() follows the cursor and writes one CSV file: the header row once', async () => {
    const mock = replay('formula_runs_rows_csv', 'formula_runs_rows_csv_page2');
    const csv = await collect(makeClient(mock.fetch).formulaRuns.exportAll(RUN_ID, { format: 'csv', limit: 2 }));
    mock.expectRequests();
    const [page1, page2] = mock.exchanges.map((exchange) => exchange.response.text!);
    expect(csv).toBe(page1! + page2!.slice(page2!.indexOf('\n') + 1));
    expect(csv.split('\r\n').filter((line) => line.startsWith('company_name,'))).toHaveLength(1);
    expect(csv.trimEnd().split('\r\n')).toHaveLength(5); // the header and 4 rows
  });

  it('exportAll() writes NDJSON as it comes, a thousand rows a page unless told otherwise', async () => {
    const mock = replay('formula_runs_rows_ndjson');
    const ndjson = await collect(makeClient(mock.fetch).formulaRuns.exportAll(RUN_ID, { format: 'ndjson' }));
    expectRequest(mock.calls[0]!, mock.exchanges[0]!, { query: { format: 'ndjson', limit: '1000' } });
    expect(ndjson).toBe(mock.exchanges[0]!.response.text);
  });

  it('cancel() asks the run to stop; the answer can still say running', async () => {
    const mock = replay('formula_runs_cancel');
    const run = await makeClient(mock.fetch).formulaRuns.cancel('frun_000000000000000000000001');
    mock.expectRequests();
    expect(run).toMatchObject({ id: 'frun_000000000000000000000001', status: 'running' });
  });

  it('cancel() is retried: cancelling twice is cancelling once', async () => {
    const mock = mockFetch(apiError(503, 'internal'), () => answer(fixture('formula_runs_cancel')));
    await quickly(() => makeClient(mock.fetch).formulaRuns.cancel('frun_000000000000000000000001'));
    expect(mock.calls).toHaveLength(2);
  });
});

describe('waiting for a formula run', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** A `fetch` that answers with these exchanges, and notes when (`Date.now()`) each request was sent. */
  function timed(...answers: (Exchange | Response)[]) {
    const sentAt: number[] = [];
    const mock = mockFetch(
      ...answers.map((given) => () => {
        sentAt.push(Date.now());
        return given instanceof Response ? given : answer(given);
      }),
    );
    const start = Date.now();
    return { ...mock, offsets: () => sentAt.map((at) => at - start) };
  }

  async function settle<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
    const outcome = promise.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    await vi.runAllTimersAsync();
    return outcome;
  }

  it('wait() asks the API to hold each look, and pauses the rest of the interval after a quick answer', async () => {
    const running = fixture('formula_runs_get_running');
    const ended = fixture('formula_runs_get');
    const mock = timed(running, ended);
    const { value } = await settle(makeClient(mock.fetch).formulaRuns.wait(RUN_ID));
    expect(value).toMatchObject({ id: RUN_ID, status: 'partial', reason: 'contacts_not_connected' });
    expect(mock.offsets()).toEqual([0, 2000]);
    expectRequest(mock.calls[0]!, running, { query: { wait: '60' } });
    expectRequest(mock.calls[1]!, ended); // recorded with wait=60
  });

  it('wait() looks again at once after an answer the API held for longer than the interval', async () => {
    const running = fixture('formula_runs_get_running');
    const sentAt: number[] = [];
    const start = Date.now();
    const mock = mockFetch(
      () => {
        sentAt.push(Date.now() - start);
        return new Promise<Response>((resolve) => setTimeout(() => resolve(answer(running)), 60_000));
      },
      () => {
        sentAt.push(Date.now() - start);
        return answer(fixture('formula_runs_get'));
      },
    );
    const { value } = await settle(makeClient(mock.fetch).formulaRuns.wait(RUN_ID, { pollInterval: 5000 }));
    expect(value).toMatchObject({ status: 'partial' });
    expect(sentAt).toEqual([0, 60_000]);
  });

  it('wait() returns a run that ended failed or cancelled; it does not throw', async () => {
    const cancelled = { ...answerBody<FormulaRun>('formula_runs_get'), status: 'cancelled', reason: 'cancelled' };
    const mock = timed(json(cancelled));
    const { value } = await settle(makeClient(mock.fetch).formulaRuns.wait(RUN_ID));
    expect(value).toMatchObject({ status: 'cancelled' });
  });

  it('wait() throws RunTimeoutError, with the formula run, when it is still going after the timeout', async () => {
    const running = fixture('formula_runs_get_running');
    const mock = timed(running, running, running, running);
    const { error } = await settle(makeClient(mock.fetch).formulaRuns.wait(RUN_ID, { timeout: 5000 }));
    expect(error).toBeInstanceOf(RunTimeoutError);
    expect(error).toBeInstanceOf(EnrichedNowError);
    expect(error).toMatchObject({ runId: RUN_ID, run: { id: RUN_ID, formula_id: 'job-order-hunter', status: 'running' } });
    expect((error as Error).message).toMatch(/5000 ms/);
    expect(mock.offsets()).toEqual([0, 2000, 4000, 5000]);
    // Each look holds no longer than what is left of the timeout.
    expect(mock.calls.map((call) => call.url.searchParams.get('wait'))).toEqual(['5', '3', '1', null]);
  });

  it('wait() stops when the signal aborts', async () => {
    const mock = timed(fixture('formula_runs_get_running'));
    const controller = new AbortController();
    const pending = makeClient(mock.fetch).formulaRuns.wait(RUN_ID, { signal: controller.signal });
    const assertion = expect(pending).rejects.toBeInstanceOf(APIUserAbortError);
    await vi.advanceTimersByTimeAsync(1000);
    controller.abort();
    await assertion;
    expect(mock.calls).toHaveLength(1);
  });

  it('runFormula() starts the run, waits for it to end, and hands back the run and every row', async () => {
    const start = fixture('formulas_run_queued');
    const running = fixture('formula_runs_get_running');
    const ended = fixture('formula_runs_get');
    const mock = timed(start, running, ended);
    mock.push(() => answer(fixture('formula_runs_rows')), () => answer(fixture('formula_runs_rows_page2')));
    const client = makeClient(mock.fetch);

    const { value } = await settle(client.runFormula('job-order-hunter', PARAMS, { unitCap: 2000, idempotencyKey: 'c0ffee-run-1', pageSize: 2 }));
    const { run, rows } = value!;
    expect(run).toMatchObject({ id: RUN_ID, status: 'partial', reason: 'contacts_not_connected' });
    expect(mock.calls).toHaveLength(3); // the rows are not read yet
    expect(mock.offsets()).toEqual([0, 2000, 4000]);
    expectRequest(mock.calls[0]!, start, { query: { wait: '60' } });
    expectRequest(mock.calls[1]!, running, { query: { wait: '60' } });
    expectRequest(mock.calls[2]!, ended);

    const all: FormulaRow[] = [];
    for await (const row of rows) all.push(row);
    expect(all).toHaveLength(4);
    expectRequest(mock.calls[3]!, fixture('formula_runs_rows'));
    expectRequest(mock.calls[4]!, fixture('formula_runs_rows_page2'));
  });

  it('runFormula() returns at once with a run that ended within the first request', async () => {
    const mock = timed(fixture('formulas_run'));
    const { value } = await settle(
      makeClient(mock.fetch).runFormula('job-order-hunter', PARAMS, { preview: true, idempotencyKey: 'c0ffee-run-2' }),
    );
    expect(value!.run).toMatchObject({ status: 'partial', mode: 'preview' });
    expectRequest(mock.calls[0]!, fixture('formulas_run'));
    expect(mock.calls).toHaveLength(1);
  });

  it('runFormula() reads the rows a thousand a page, narrowed as asked', async () => {
    const mock = timed(fixture('formulas_run'), json({ rows: [], next_cursor: null }));
    const { value } = await settle(
      makeClient(mock.fetch).runFormula('job-order-hunter', PARAMS, { fields: ['company_name'], minScore: 10, view: 'company' }),
    );
    await value!.rows.toArray();
    expect(Object.fromEntries(mock.calls[1]!.url.searchParams)).toEqual({ fields: 'company_name', min_score: '10', view: 'company', limit: '1000' });
  });

  it('runFormula() exports the whole run as one file', async () => {
    const mock = timed(fixture('formulas_run_queued'), fixture('formula_runs_get'));
    mock.push(() => answer(fixture('formula_runs_rows_csv')), () => answer(fixture('formula_runs_rows_csv_page2')));
    const { value } = await settle(makeClient(mock.fetch).runFormula('job-order-hunter', PARAMS, { pageSize: 2 }));
    const csv = await collect(value!.export('csv'));
    expectRequest(mock.calls[2]!, fixture('formula_runs_rows_csv'));
    expectRequest(mock.calls[3]!, fixture('formula_runs_rows_csv_page2'));
    expect(csv.split('\r\n').filter((line) => line.startsWith('company_name,'))).toHaveLength(1);
  });

  it.each([
    ['failed', 'source_failed:linkedin.jobs_search'],
    ['unsupported', 'formula_unavailable'],
    ['cancelled', 'cancelled'],
  ] as const)('runFormula() throws FormulaRunFailedError for a run that ended %s', async (status, reason) => {
    const failed = { ...answerBody<FormulaRun>('formulas_run'), status, reason };
    const mock = timed(json(failed));
    const { error } = await settle(makeClient(mock.fetch).runFormula('job-order-hunter', PARAMS));
    expect(error).toBeInstanceOf(FormulaRunFailedError);
    expect(error).toBeInstanceOf(RunFailedError);
    expect(error).toBeInstanceOf(EnrichedNowError);
    expect(error).toMatchObject({
      name: 'FormulaRunFailedError',
      status,
      reason,
      runId: 'frun_000000000000000000000003',
      formulaId: 'job-order-hunter',
      run: { status, reason },
    });
    expect((error as Error).message).toBe(`Formula run frun_000000000000000000000003 of job-order-hunter ended ${status} (${reason}).`);
    expect(mock.calls).toHaveLength(1); // no rows are read
  });

  it('runFormula() throws FormulaRunFailedError for a run that failed while it was waited for', async () => {
    const failed = { ...answerBody<FormulaRun>('formula_runs_get'), status: 'failed', reason: 'deadline_exceeded' };
    const mock = timed(fixture('formulas_run_queued'), json(failed));
    const { error } = await settle(makeClient(mock.fetch).runFormula('job-order-hunter', PARAMS));
    expect(error).toMatchObject({ name: 'FormulaRunFailedError', status: 'failed', reason: 'deadline_exceeded', runId: RUN_ID });
  });

  it('runFormula() returns the failed run instead when told not to throw', async () => {
    const failed = { ...answerBody<FormulaRun>('formulas_run'), status: 'failed', reason: 'source_failed:linkedin.jobs_search' };
    const mock = timed(json(failed), json({ rows: [], next_cursor: null }));
    const { value, error } = await settle(makeClient(mock.fetch).runFormula('job-order-hunter', PARAMS, { throwOnFailure: false }));
    expect(error).toBeUndefined();
    expect(value!.run.status).toBe('failed');
    await expect(value!.rows.toArray()).resolves.toEqual([]);
  });

  it('runFormula() throws RunTimeoutError when the run does not end in time; the first request is held no longer', async () => {
    const running = fixture('formula_runs_get_running');
    const mock = timed(fixture('formulas_run_queued'), running, running, running);
    const { error } = await settle(makeClient(mock.fetch).runFormula('job-order-hunter', PARAMS, { timeout: 5000 }));
    expect(error).toBeInstanceOf(RunTimeoutError);
    expect(error).toMatchObject({ runId: RUN_ID, run: { formula_id: 'job-order-hunter' } });
    expect(mock.calls[0]!.url.searchParams.get('wait')).toBe('5');
    expect(mock.offsets()).toEqual([0, 2000, 4000, 5000]);
  });

  it('runFormula() sends the start again after a 500, under the same key, and gives up as any request does', async () => {
    const mock = mockFetch(apiError(500, 'internal'), apiError(500, 'internal'), apiError(500, 'internal'));
    const { error } = await settle(makeClient(mock.fetch).runFormula('job-order-hunter', PARAMS));
    expect(error).toBeInstanceOf(ServerError);
    expect(new Set(mock.calls.map((call) => call.headers['idempotency-key'])).size).toBe(1);
    expect(mock.calls).toHaveLength(3);
  });
});
