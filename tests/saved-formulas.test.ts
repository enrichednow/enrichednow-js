import { describe, expect, it, vi } from 'vitest';

import { APIConnectionError, ServerError } from '../src';
import type { FormulaRow, JobOrderHunterParams, Suppression } from '../src';
import { answer, answerBody, apiError, expectRequest, fixture, json, makeClient, mockFetch, replay } from './helpers';

const PARAMS = {
  job_titles: ['Java Developer'],
  locations: ['London'],
  posted_within_days: 2,
  title_exclude_keywords: ['intern'],
  exclude_companies: ['Blocked By Us Inc'],
  company_size: { min: 11, max: 5000 },
} satisfies JobOrderHunterParams;

const SAVED_ID = 'sf_000000000000000000000002';

async function collect(pieces: AsyncIterable<Uint8Array>): Promise<string> {
  let out = '';
  for await (const piece of pieces) out += new TextDecoder().decode(piece);
  return out;
}

/** Make a call with fake timers, every pause (between retries) passing at once, and say how it ended. */
async function settled<T>(call: () => Promise<T>): Promise<{ value?: T; error?: unknown }> {
  vi.useFakeTimers();
  try {
    const outcome = call().then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    await vi.runAllTimersAsync();
    return await outcome;
  } finally {
    vi.useRealTimers();
  }
}

describe('saved formulas', () => {
  it('create() saves a formula with a schedule, sending only what is given', async () => {
    const mock = replay('saved_create');
    const saved = await makeClient(mock.fetch).savedFormulas.create('job-order-hunter', PARAMS, {
      schedule: { cadence: 'weekdays', local_time: '07:30', timezone: 'Europe/London' },
      notify: 'digest',
    });
    mock.expectRequests();
    expect(saved).toMatchObject({
      id: SAVED_ID,
      formula_id: 'job-order-hunter',
      name: 'Java Developer, London, on weekdays',
      name_auto: true,
      status: 'active',
      notify: 'digest',
      monthly_unit_cap: null,
      last_run: null,
      schedule: { cadence: 'weekdays', local_time: '07:30', timezone: 'Europe/London', day_of_week: null, next_fire_at: '2026-11-25T09:04:29Z' },
    });
    expect(saved.estimate).toMatchObject({ max_units: 1425 });
  });

  it('create() sends the caps and the name under the API names', async () => {
    const mock = mockFetch(() => answer(fixture('saved_create')));
    await makeClient(mock.fetch).savedFormulas.create('job-order-hunter', PARAMS, { name: 'Java', unitCap: 100, rowCap: 50, monthlyUnitCap: 1000 });
    expect(mock.calls[0]!.body).toEqual({ formula_id: 'job-order-hunter', params: PARAMS, name: 'Java', unit_cap: 100, row_cap: 50, monthly_unit_cap: 1000 });
  });

  it('create() is not sent again after a 500 or a failed connection: the saved formula may exist', async () => {
    const broken = mockFetch(apiError(500, 'internal'));
    expect((await settled(() => makeClient(broken.fetch).savedFormulas.create('job-order-hunter', PARAMS))).error).toBeInstanceOf(ServerError);
    expect(broken.calls).toHaveLength(1);

    const cut = mockFetch(new TypeError('fetch failed'));
    expect((await settled(() => makeClient(cut.fetch).savedFormulas.create('job-order-hunter', PARAMS))).error).toBeInstanceOf(APIConnectionError);
    expect(cut.calls).toHaveLength(1);
  });

  it('list() lists them, with the filters under the API names', async () => {
    const mock = replay('saved_list');
    const saved = await makeClient(mock.fetch).savedFormulas.list({ limit: 10 }).toArray();
    mock.expectRequests();
    expect(saved.map((one) => one.id)).toEqual([SAVED_ID]);

    const filtered = mockFetch(json({ saved_formulas: [], next_cursor: null }));
    await makeClient(filtered.fetch).savedFormulas.list({ formulaId: 'job-order-hunter', status: 'archived' });
    expect(Object.fromEntries(filtered.calls[0]!.url.searchParams)).toEqual({ formula_id: 'job-order-hunter', status: 'archived' });
  });

  it('list() pages with next_cursor', async () => {
    const page = answerBody<{ saved_formulas: unknown[] }>('saved_list');
    const mock = mockFetch(json({ ...page, next_cursor: 'c2' }), json({ ...page, next_cursor: null }));
    const saved = await makeClient(mock.fetch).savedFormulas.list({ limit: 1 }).toArray();
    expect(saved).toHaveLength(2);
    expect(mock.calls.map((call) => call.url.search)).toEqual(['?limit=1', '?limit=1&cursor=c2']);
  });

  it('get() reads one', async () => {
    const mock = replay('saved_get');
    const saved = await makeClient(mock.fetch).savedFormulas.get(SAVED_ID);
    mock.expectRequests();
    expect(saved).toEqual(mock.exchanges[0]!.response.body);
  });

  it('update() sends only what changes', async () => {
    const mock = replay('saved_update');
    const saved = await makeClient(mock.fetch).savedFormulas.update(SAVED_ID, { name: 'Java in London, weekdays', monthlyUnitCap: 20_000 });
    mock.expectRequests();
    expect(saved).toMatchObject({ name: 'Java in London, weekdays', name_auto: false, monthly_unit_cap: 20_000 });
  });

  it('update() sends null to remove the schedule, the monthly cap and a name of your own; undefined is left out', async () => {
    const mock = mockFetch(() => answer(fixture('saved_update')));
    await makeClient(mock.fetch).savedFormulas.update(SAVED_ID, {
      schedule: null,
      monthlyUnitCap: null,
      name: null,
      notify: undefined,
      unitCap: undefined,
    });
    expect(mock.calls[0]!.text).toBe('{"name":null,"monthly_unit_cap":null,"schedule":null}');
  });

  it('update() sends new parameters, a reset of what was delivered, and the rest under the API names', async () => {
    const mock = mockFetch(() => answer(fixture('saved_update')));
    await makeClient(mock.fetch).savedFormulas.update<'job-order-hunter'>(SAVED_ID, {
      params: { job_titles: ['Kotlin Developer'], locations: ['London'] },
      resetSeen: true,
      unitCap: 500,
      rowCap: 100,
      schedule: { cadence: 'weekly', local_time: '08:00', timezone: 'UTC', day_of_week: 0 },
      notify: 'none',
    });
    expect(mock.calls[0]!.body).toEqual({
      params: { job_titles: ['Kotlin Developer'], locations: ['London'] },
      reset_seen: true,
      unit_cap: 500,
      row_cap: 100,
      schedule: { cadence: 'weekly', local_time: '08:00', timezone: 'UTC', day_of_week: 0 },
      notify: 'none',
    });
  });

  it('update() refuses a change with nothing in it, before sending', async () => {
    const mock = mockFetch();
    await expect(makeClient(mock.fetch).savedFormulas.update(SAVED_ID, {})).rejects.toThrow(TypeError);
    await expect(makeClient(mock.fetch).savedFormulas.update(SAVED_ID, { name: undefined })).rejects.toThrow(/Nothing to change/);
    expect(mock.calls).toHaveLength(0);
  });

  it('update() is retried: the same change twice is the change once', async () => {
    const mock = mockFetch(apiError(502, 'internal'), () => answer(fixture('saved_update')));
    const { value } = await settled(() => makeClient(mock.fetch).savedFormulas.update(SAVED_ID, { name: 'Java in London, weekdays', monthlyUnitCap: 20_000 }));
    expect(value).toMatchObject({ name: 'Java in London, weekdays' });
    expect(mock.calls).toHaveLength(2);
  });

  it('archive() deletes it and answers it, archived', async () => {
    const mock = replay('saved_archive');
    const saved = await makeClient(mock.fetch).savedFormulas.archive(SAVED_ID);
    mock.expectRequests();
    expect(saved).toMatchObject({ status: 'archived', archived_at: '2026-11-25T09:04:25.250000Z', schedule: { next_fire_at: null } });
  });

  it('duplicate() makes a copy, with what the original delivered when asked', async () => {
    const mock = replay('saved_duplicate');
    const copy = await makeClient(mock.fetch).savedFormulas.duplicate(SAVED_ID, { name: 'Java in London (copy)', copySeen: true });
    mock.expectRequests();
    expect(copy).toMatchObject({ id: 'sf_000000000000000000000003', name: 'Java in London (copy)', schedule: null });

    const plain = mockFetch(() => answer(fixture('saved_duplicate')), apiError(500, 'internal'));
    await makeClient(plain.fetch).savedFormulas.duplicate(SAVED_ID);
    expect(plain.calls[0]!.body).toEqual({});
    expect((await settled(() => makeClient(plain.fetch).savedFormulas.duplicate(SAVED_ID))).error).toBeInstanceOf(ServerError);
    expect(plain.calls).toHaveLength(2); // not sent again: the copy may exist
  });

  it('run() runs it now, with wait and the idempotency key', async () => {
    const mock = replay('saved_run');
    const run = await makeClient(mock.fetch).savedFormulas.run(SAVED_ID, { wait: 60, idempotencyKey: 'c0ffee-saved-1' });
    mock.expectRequests();
    expect(run).toMatchObject({ id: 'frun_000000000000000000000004', saved_formula_id: SAVED_ID, status: 'partial', include_seen: false });
  });

  it('run() of a preview that delivers rows already delivered too sends both; a key is made when none is given', async () => {
    const mock = mockFetch(() => answer(fixture('saved_run')));
    await makeClient(mock.fetch).savedFormulas.run(SAVED_ID, { preview: true, includeSeen: true });
    expect(mock.calls[0]!.body).toEqual({ mode: 'preview', include_seen: true });
    expect(mock.calls[0]!.url.search).toBe('');
    expect(mock.calls[0]!.headers['idempotency-key']).toMatch(/^[0-9a-f-]{32,36}$/);
  });

  it('pause() and resume() change its schedule', async () => {
    const mock = replay('saved_pause', 'saved_resume');
    const client = makeClient(mock.fetch);
    const paused = await client.savedFormulas.pause(SAVED_ID);
    const resumed = await client.savedFormulas.resume(SAVED_ID);
    mock.expectRequests();
    expect(paused).toMatchObject({ status: 'paused', paused_reason: 'manual', schedule: { next_fire_at: null } });
    expect(paused.last_run).toEqual({
      id: 'frun_000000000000000000000004',
      status: 'partial',
      reason: 'contacts_not_connected',
      rows_new: 4,
      created_at: '2026-11-25T09:02:56.250000Z',
      finished_at: '2026-11-25T09:04:20.250000Z',
    });
    expect(resumed).toMatchObject({ status: 'active', paused_reason: null });
  });

  it('resetSeen() forgets what it delivered', async () => {
    const mock = replay('saved_seen_reset');
    const reset = await makeClient(mock.fetch).savedFormulas.resetSeen(SAVED_ID);
    mock.expectRequests();
    expect(reset.cleared).toBe(4);
    expect(reset.saved_formula.id).toBe(SAVED_ID);
  });

  it('rows() reads its rows from a time on, page after page', async () => {
    const recorded = fixture('saved_rows');
    const more = answerBody<{ rows: FormulaRow[] }>('saved_rows').rows.map((row) => ({ ...row, id: `${row.id}b` }));
    const mock = mockFetch(() => answer(recorded), () => json({ rows: more, next_cursor: null }));
    const rows = await makeClient(mock.fetch).savedFormulas.rows(SAVED_ID, { since: '2026-11-25T09:02:55.250000+00:00', limit: 2 }).toArray();
    expectRequest(mock.calls[0]!, recorded);
    const cursor = (recorded.response.body as { next_cursor: string }).next_cursor;
    expect(Object.fromEntries(mock.calls[1]!.url.searchParams)).toEqual({ since: '2026-11-25T09:02:55.250000+00:00', limit: '2', cursor });
    expect(rows.map((row) => row.id)).toEqual([
      'frow_000000000000000000000005',
      'frow_000000000000000000000006',
      'frow_000000000000000000000005b',
      'frow_000000000000000000000006b',
    ]);
    expect(rows[0]!.run_id).toBe('frun_000000000000000000000004');
  });

  it('rows() takes a Date for since, and the order and filters under the API names', async () => {
    const mock = mockFetch(json({ rows: [], next_cursor: null }));
    await makeClient(mock.fetch)
      .savedFormulas.rows(SAVED_ID, { since: new Date('2026-11-25T09:00:00Z'), order: 'desc', fields: ['company_name', 'job_url'], minScore: 5 })
      .toArray();
    expect(Object.fromEntries(mock.calls[0]!.url.searchParams)).toEqual({
      since: '2026-11-25T09:00:00.000Z',
      order: 'desc',
      fields: 'company_name,job_url',
      min_score: '5',
    });
  });

  it('export() and exportAll() write its rows as CSV', async () => {
    const mock = replay('saved_rows_csv', 'saved_rows_csv');
    const client = makeClient(mock.fetch);
    const page = await client.savedFormulas.export(SAVED_ID, { format: 'csv', fields: ['company_name', 'job_title', 'job_url'] });
    expect(page.text).toBe(mock.exchanges[0]!.response.text);
    expect(page.nextCursor).toBeNull();
    expect(mock.calls[0]!.headers['accept']).toBe('text/csv');
    expectRequest(mock.calls[0]!, mock.exchanges[0]!);

    const csv = await collect(client.savedFormulas.exportAll(SAVED_ID, { format: 'csv', fields: ['company_name', 'job_title', 'job_url'] }));
    expectRequest(mock.calls[1]!, mock.exchanges[1]!, { query: { format: 'csv', fields: 'company_name,job_title,job_url', limit: '1000' } });
    expect(csv).toBe(mock.exchanges[1]!.response.text);
  });

  it('snapshots() reads what it observed of one entity', async () => {
    const mock = replay('saved_snapshots');
    const snapshots = await makeClient(mock.fetch).savedFormulas.snapshots('sf_000000000000000000000001', { entityKey: 'https://board.example/1' });
    mock.expectRequests();
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toEqual({
      entity: 'job',
      entity_key: 'https://board.example/1',
      fields: { 'job.title': 'Senior Java Developer' },
      run_id: 'frun_000000000000000000000005',
      observed_at: '2026-11-25T09:04:27.250000Z',
    });
  });

  it('limits() reads what the plan allows', async () => {
    const mock = replay('saved_limits');
    const limits = await makeClient(mock.fetch).savedFormulas.limits();
    mock.expectRequests();
    expect(limits).toEqual({ schedules: 3, schedules_active: 1, min_interval_minutes: 1440, row_retention_days: 90, destinations: 3 });
  });
});

describe('suppressions', () => {
  it('list() pages with next_cursor', async () => {
    const recorded = fixture('suppressions_list');
    const last: Suppression = { kind: 'email', value: 'ana@initech.example', source: 'manual', created_at: '2026-11-25T09:04:28.250000Z' };
    const mock = mockFetch(() => answer(recorded), () => json({ suppressions: [last], next_cursor: null }));
    const entries = await makeClient(mock.fetch).suppressions.list({ limit: 2 }).toArray();
    expectRequest(mock.calls[0]!, recorded);
    expect(Object.fromEntries(mock.calls[1]!.url.searchParams)).toEqual({ limit: '2', cursor: 'WyJkb21haW4iLCAiZ2xvYmV4LmV4YW1wbGUiXQ' });
    expect(entries.map((entry) => `${entry.kind}:${entry.value}`)).toEqual(['company_name:umbrella', 'domain:globex.example', 'email:ana@initech.example']);
  });

  it('add() adds entries and returns how many were new', async () => {
    const mock = replay('suppressions_add');
    const added = await makeClient(mock.fetch).suppressions.add([
      { kind: 'domain', value: 'https://www.globex.example/' },
      { kind: 'email', value: 'Ana@Initech.example' },
      { kind: 'company_name', value: 'Umbrella, Inc.' },
    ]);
    mock.expectRequests();
    expect(added).toBe(3);
  });

  it('add() sends the source when given, and is retried', async () => {
    const mock = mockFetch(apiError(500, 'internal'), () => answer(fixture('suppressions_add')));
    const { value } = await settled(() => makeClient(mock.fetch).suppressions.add([{ kind: 'domain', value: 'acme.com' }], { source: 'upload' }));
    expect(value).toBe(3);
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls[1]!.body).toEqual({ entries: [{ kind: 'domain', value: 'acme.com' }], source: 'upload' });
  });

  it('upload() sends a CSV file as it is, as text/csv', async () => {
    const mock = replay('suppressions_upload');
    const csv = mock.exchanges[0]!.request.text!;
    const result = await makeClient(mock.fetch).suppressions.upload(csv);
    mock.expectRequests();
    expect(mock.calls[0]!.headers['content-type']).toBe('text/csv');
    expect(result).toEqual({ added: 3, already: 0, invalid: [{ index: 5, message: "'not an address' is not a email that can be matched." }] });
  });

  it('upload() takes bytes, a Blob and a stream, and the kind of every value', async () => {
    const csv = fixture('suppressions_upload').request.text!;
    const bytes = new TextEncoder().encode(csv);
    async function* stream(): AsyncGenerator<Uint8Array | string> {
      yield bytes.subarray(0, 10);
      yield csv.slice(10);
    }
    const inputs = [bytes, bytes.buffer.slice(0), new Blob([csv], { type: 'text/csv' }), stream()];
    const mock = mockFetch(...inputs.map(() => () => answer(fixture('suppressions_upload'))));
    const client = makeClient(mock.fetch);
    for (const input of inputs) await client.suppressions.upload(input);
    expect(mock.calls.map((call) => call.text)).toEqual(inputs.map(() => csv));

    const kinded = mockFetch(() => answer(fixture('suppressions_upload')));
    await makeClient(kinded.fetch).suppressions.upload('acme.com\ninitech.example\n', { kind: 'domain' });
    expect(kinded.calls[0]!.url.search).toBe('?kind=domain');
    expect(kinded.calls[0]!.body).toBeUndefined();
  });

  it('upload() is not sent again after a 500', async () => {
    const mock = mockFetch(apiError(500, 'internal'));
    expect((await settled(() => makeClient(mock.fetch).suppressions.upload('acme.com\n'))).error).toBeInstanceOf(ServerError);
    expect(mock.calls).toHaveLength(1);
  });

  it('delete() removes one entry: 204, nothing to return', async () => {
    const mock = replay('suppressions_delete');
    await expect(makeClient(mock.fetch).suppressions.delete('domain', 'globex.example')).resolves.toBeUndefined();
    mock.expectRequests();
  });

  it('delete() escapes the value in the path', async () => {
    const mock = mockFetch(new Response(null, { status: 204 }));
    await makeClient(mock.fetch).suppressions.delete('company_name', 'acme/b c');
    expect(mock.calls[0]!.url.pathname).toBe('/v1/suppressions/company_name/acme%2Fb%20c');
  });
});

describe('attestations and row feedback', () => {
  it('attestations.list() says which terms are accepted', async () => {
    const mock = replay('attestations_list');
    const attestations = await makeClient(mock.fetch).attestations.list();
    mock.expectRequests();
    expect(attestations).toEqual([
      expect.objectContaining({ kind: 'personal_data', text_version: '2026-11-24', accepted: true, accepted_by: 'ada@example.com' }),
    ]);
  });

  it('formulaRows.feedback() says what is wrong with a row, and answers the correction', async () => {
    const mock = replay('formula_rows_feedback');
    const feedback = await makeClient(mock.fetch).formulaRows.feedback('frow_000000000000000000000001', 'wrong_company', {
      note: 'This is the agency, not the employer.',
      correctDomain: 'corvid.example',
    });
    mock.expectRequests();
    expect(feedback).toEqual({
      row_id: 'frow_000000000000000000000001',
      verdict: 'wrong_company',
      status: 'flagged',
      correction: { company_name: 'Corvid', country: 'UK', domain: 'corvid.example' },
    });
  });

  it('formulaRows.feedback() sends only the verdict when that is all, and is retried', async () => {
    const mock = mockFetch(apiError(500, 'internal'), json({ row_id: 'frow_1', verdict: 'good', status: 'new', correction: null }));
    const { value } = await settled(() => makeClient(mock.fetch).formulaRows.feedback('frow_1', 'good'));
    expect(value).toMatchObject({ status: 'new', correction: null });
    expect(mock.calls[1]!.body).toEqual({ verdict: 'good' });
  });
});
