import { describe, expectTypeOf, it } from 'vitest';

import { FORMULA_IDS, parseWebhook, verifyWebhook } from '../src';
import type {
  Attestation,
  Company,
  Formula,
  FormulaDetail,
  FormulaEstimate,
  FormulaId,
  FormulaParams,
  FormulaRow,
  FormulaRun,
  FormulaRunFailedError,
  JSONObject,
  JobOrderHunterParams,
  Page,
  PagePromise,
  PlanLimits,
  Posting,
  PostingDetail,
  RecordsPage,
  RowFeedback,
  RowsExport,
  Run,
  RunFailedError,
  RunTimeoutError,
  SavedFormula,
  Scraper,
  ScraperDetail,
  SeenReset,
  Snapshot,
  Suppression,
  SuppressionUpload,
  Usage,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookEndpointList,
  WebhookEndpointWithSecret,
  WebhookEvent,
  WebhookEventName,
  WebhookSecret,
} from '../src';
import { makeClient, mockFetch } from './helpers';

interface Job {
  title: string;
  url: string;
}

interface BoardInput {
  board_url: string;
}

/**
 * These are checked by `tsc --noEmit`, not by running them: each body is a function that is never called, so
 * nothing is requested.
 */
const checked = (_check: () => void) => () => {};

describe('types', () => {
  const client = makeClient(mockFetch().fetch);

  it('resources return the API shapes', checked(() => {
    expectTypeOf(client.scrapers.list()).resolves.toEqualTypeOf<Scraper[]>();
    expectTypeOf(client.scrapers.get('ats.board')).resolves.toEqualTypeOf<ScraperDetail>();
    expectTypeOf(client.runs.get('run_1')).resolves.toEqualTypeOf<Run>();
    expectTypeOf(client.runs.cancel('run_1')).resolves.toEqualTypeOf<Run>();
    expectTypeOf(client.runs.wait('run_1')).resolves.toEqualTypeOf<Run>();
    expectTypeOf(client.runs.list()).toEqualTypeOf<PagePromise<Run>>();
    expectTypeOf(client.usage.get()).resolves.toEqualTypeOf<Usage>();
    expectTypeOf(client.data.postings.list()).toEqualTypeOf<PagePromise<Posting>>();
    expectTypeOf(client.data.postings.get('pst_1')).resolves.toEqualTypeOf<PostingDetail>();
    expectTypeOf(client.data.companies.list()).toEqualTypeOf<PagePromise<Company>>();
    expectTypeOf(client.data.companies.get('acme.com')).resolves.toEqualTypeOf<Company>();
    expectTypeOf(client.data.companies.postings('acme.com')).toEqualTypeOf<PagePromise<Posting>>();
  }));

  it('a run carries the type of its input', checked(() => {
    expectTypeOf(client.scrapers.run('ats.board', { board_url: 'https://example.com' } satisfies BoardInput)).resolves.toEqualTypeOf<
      Run<BoardInput>
    >();
  }));

  it('records carry the type they are given', checked(() => {
    const records = client.runs.records<Job>('run_1');
    expectTypeOf(records).toEqualTypeOf<PagePromise<Job, RecordsPage<Job>>>();
    expectTypeOf(records.toArray()).resolves.toEqualTypeOf<Job[]>();
    expectTypeOf<Awaited<typeof records>>().toEqualTypeOf<RecordsPage<Job>>();
    expectTypeOf<Awaited<ReturnType<RecordsPage<Job>['getNextPage']>>>().toEqualTypeOf<RecordsPage<Job>>();
    expectTypeOf<Awaited<PagePromise<Run>>>().toEqualTypeOf<Page<Run>>();
  }));

  it('scrape() carries both', checked(() => {
    const scrape = () => client.scrape<Job, BoardInput>('ats.board', { board_url: 'https://example.com' });
    expectTypeOf<Awaited<ReturnType<typeof scrape>>['run']>().toEqualTypeOf<Run<BoardInput>>();
    expectTypeOf<Awaited<ReturnType<typeof scrape>>['records']>().toEqualTypeOf<PagePromise<Job, RecordsPage<Job>>>();
  }));

  it('webhooks return the API shapes', checked(() => {
    expectTypeOf(client.webhooks.list()).resolves.toEqualTypeOf<WebhookEndpointList>();
    expectTypeOf(client.webhooks.create({ url: 'https://example.com', events: ['run.failed'] })).resolves.toEqualTypeOf<WebhookEndpointWithSecret>();
    expectTypeOf(client.webhooks.get('whk_1')).resolves.toEqualTypeOf<WebhookEndpoint>();
    expectTypeOf(client.webhooks.update('whk_1', { enabled: false })).resolves.toEqualTypeOf<WebhookEndpoint>();
    expectTypeOf(client.webhooks.delete('whk_1')).resolves.toEqualTypeOf<void>();
    expectTypeOf(client.webhooks.rotateSecret('whk_1')).resolves.toEqualTypeOf<WebhookEndpointWithSecret>();
    expectTypeOf(client.webhooks.createRunSecret()).resolves.toEqualTypeOf<WebhookSecret>();
    expectTypeOf(client.webhooks.deliveries.list()).toEqualTypeOf<PagePromise<WebhookDelivery>>();
    expectTypeOf(client.webhooks.deliveries.resend('whd_1')).resolves.toEqualTypeOf<WebhookDelivery>();
    // @ts-expect-error an event that does not exist
    void client.webhooks.create({ url: 'https://example.com', events: ['run.started'] });
  }));

  it('verifying a webhook is synchronous, and the event carries the run', checked(() => {
    expectTypeOf(verifyWebhook('whsec', '1700000000', new Uint8Array(), 'v1=00')).toEqualTypeOf<boolean>();
    expectTypeOf(verifyWebhook('whsec', undefined, 'text', undefined, { toleranceSeconds: 60 })).toEqualTypeOf<boolean>();
    expectTypeOf(parseWebhook('whsec', '1700000000', new ArrayBuffer(0), 'v1=00')).toEqualTypeOf<WebhookEvent>();
    expectTypeOf(parseWebhook<BoardInput>('whsec', 1700000000, '', 'v1=00').data.run).toEqualTypeOf<Run<BoardInput>>();
    expectTypeOf<WebhookEvent['type']>().toEqualTypeOf<WebhookEventName>();
  }));

  it('records are JSON objects unless told otherwise', checked(() => {
    expectTypeOf(client.runs.records('run_1').toArray()).resolves.toEqualTypeOf<Record<string, unknown>[]>();
  }));

  it('formulas return the API shapes', checked(() => {
    expectTypeOf(client.formulas.list()).resolves.toEqualTypeOf<Formula[]>();
    expectTypeOf(client.formulas.get('job-order-hunter')).resolves.toEqualTypeOf<FormulaDetail>();
    expectTypeOf(client.formulas.estimate('a-formula', {})).resolves.toEqualTypeOf<FormulaEstimate>();
    expectTypeOf(client.formulas.run('a-formula', {})).resolves.toEqualTypeOf<FormulaRun>();
    expectTypeOf(client.formulaRuns.list()).toEqualTypeOf<PagePromise<FormulaRun>>();
    expectTypeOf(client.formulaRuns.get('frun_1', { wait: 60 })).resolves.toEqualTypeOf<FormulaRun>();
    expectTypeOf(client.formulaRuns.wait('frun_1')).resolves.toEqualTypeOf<FormulaRun>();
    expectTypeOf(client.formulaRuns.cancel('frun_1')).resolves.toEqualTypeOf<FormulaRun>();
    expectTypeOf(client.formulaRuns.rows('frun_1')).toEqualTypeOf<PagePromise<FormulaRow>>();
    expectTypeOf(client.formulaRuns.export('frun_1', { format: 'csv' })).resolves.toEqualTypeOf<RowsExport>();
    expectTypeOf(client.formulaRuns.exportAll('frun_1', { format: 'ndjson' })).toEqualTypeOf<AsyncGenerator<Uint8Array>>();
    expectTypeOf(client.savedFormulas.create('a-formula', {})).resolves.toEqualTypeOf<SavedFormula>();
    expectTypeOf(client.savedFormulas.list()).toEqualTypeOf<PagePromise<SavedFormula>>();
    expectTypeOf(client.savedFormulas.get('sf_1')).resolves.toEqualTypeOf<SavedFormula>();
    expectTypeOf(client.savedFormulas.update('sf_1', { notify: 'none' })).resolves.toEqualTypeOf<SavedFormula>();
    expectTypeOf(client.savedFormulas.archive('sf_1')).resolves.toEqualTypeOf<SavedFormula>();
    expectTypeOf(client.savedFormulas.duplicate('sf_1')).resolves.toEqualTypeOf<SavedFormula>();
    expectTypeOf(client.savedFormulas.run('sf_1')).resolves.toEqualTypeOf<FormulaRun>();
    expectTypeOf(client.savedFormulas.pause('sf_1')).resolves.toEqualTypeOf<SavedFormula>();
    expectTypeOf(client.savedFormulas.resume('sf_1')).resolves.toEqualTypeOf<SavedFormula>();
    expectTypeOf(client.savedFormulas.resetSeen('sf_1')).resolves.toEqualTypeOf<SeenReset>();
    expectTypeOf(client.savedFormulas.rows('sf_1', { since: new Date() })).toEqualTypeOf<PagePromise<FormulaRow>>();
    expectTypeOf(client.savedFormulas.snapshots('sf_1')).resolves.toEqualTypeOf<Snapshot[]>();
    expectTypeOf(client.savedFormulas.limits()).resolves.toEqualTypeOf<PlanLimits>();
    expectTypeOf(client.suppressions.list()).toEqualTypeOf<PagePromise<Suppression>>();
    expectTypeOf(client.suppressions.add([{ kind: 'domain', value: 'acme.com' }])).resolves.toEqualTypeOf<number>();
    expectTypeOf(client.suppressions.upload('acme.com\n')).resolves.toEqualTypeOf<SuppressionUpload>();
    expectTypeOf(client.suppressions.delete('domain', 'acme.com')).resolves.toEqualTypeOf<void>();
    expectTypeOf(client.attestations.list()).resolves.toEqualTypeOf<Attestation[]>();
    expectTypeOf(client.formulaRows.feedback('frow_1', 'good')).resolves.toEqualTypeOf<RowFeedback>();
    // @ts-expect-error a verdict that does not exist
    void client.formulaRows.feedback('frow_1', 'bad');
    // @ts-expect-error a kind that does not exist
    void client.suppressions.add([{ kind: 'phone', value: '+44' }]);
  }));

  it('a formula this library knows checks its parameters; any other formula takes any JSON object', checked(() => {
    void client.formulas.run('job-order-hunter', { job_titles: ['Java Developer'], locations: ['London'], company_size: { min: 11, max: 500 } });
    // @ts-expect-error job_titles is required
    void client.formulas.run('job-order-hunter', { locations: ['London'] });
    // @ts-expect-error job_titles is a list
    void client.formulas.run('job-order-hunter', { job_titles: 'Java Developer', locations: ['London'] });
    // @ts-expect-error not a parameter of this formula
    void client.formulas.run('job-order-hunter', { job_titles: ['Java'], locations: ['London'], titles: ['Java'] });
    // @ts-expect-error not a board it searches
    void client.formulas.estimate('job-order-hunter', { job_titles: ['Java'], locations: ['London'], sources: ['monster'] });
    // @ts-expect-error the same check on runFormula()
    void client.runFormula('job-order-hunter', { locations: ['London'] });
    // @ts-expect-error and on saving one
    void client.savedFormulas.create('job-order-hunter', { locations: ['London'] });
    // @ts-expect-error and on changing one, given its formula
    void client.savedFormulas.update<'job-order-hunter'>('sf_1', { params: { locations: ['London'] } });

    void client.formulas.run('a-formula-from-next-month', { anything: 1, at: ['all'] });
    void client.runFormula('a-formula-from-next-month', { anything: 1 });
    void client.savedFormulas.update('sf_1', { params: { anything: 1 } });
    const id: string = 'job-order-hunter';
    void client.formulas.run(id, { anything: 1 });

    expectTypeOf<FormulaParams<'job-order-hunter'>>().toEqualTypeOf<JobOrderHunterParams>();
    expectTypeOf<FormulaParams<'a-formula-from-next-month'>>().toEqualTypeOf<JSONObject>();
    expectTypeOf<FormulaParams<string>>().toEqualTypeOf<JSONObject>();
    expectTypeOf(FORMULA_IDS).toEqualTypeOf<readonly FormulaId[]>();
  }));

  it('a change to a saved formula takes null where null removes something, and only there', checked(() => {
    void client.savedFormulas.update('sf_1', { schedule: null, monthlyUnitCap: null, name: null });
    // @ts-expect-error a unit cap is changed, not removed
    void client.savedFormulas.update('sf_1', { unitCap: null });
    // @ts-expect-error not a cadence
    void client.savedFormulas.update('sf_1', { schedule: { cadence: 'yearly', local_time: '07:00', timezone: 'UTC' } });
  }));

  it('runFormula() and the rows carry the row type they are given', checked(() => {
    interface Lead {
      company_name: string;
      contact_email: string | null;
    }
    const run = () => client.runFormula<'job-order-hunter', Lead>('job-order-hunter', { job_titles: ['Java'], locations: ['London'] });
    expectTypeOf<Awaited<ReturnType<typeof run>>['run']>().toEqualTypeOf<FormulaRun>();
    expectTypeOf<Awaited<ReturnType<typeof run>>['rows']>().toEqualTypeOf<PagePromise<FormulaRow<Lead>>>();
    expectTypeOf(client.formulaRuns.rows<Lead>('frun_1').toArray()).resolves.toEqualTypeOf<FormulaRow<Lead>[]>();
    expectTypeOf(client.savedFormulas.rows<Lead>('sf_1')).toEqualTypeOf<PagePromise<FormulaRow<Lead>>>();
    expectTypeOf<Awaited<PagePromise<FormulaRow<Lead>>>>().toEqualTypeOf<Page<FormulaRow<Lead>>>();
  }));

  it('the errors about a run carry the run they are about', checked(() => {
    expectTypeOf<RunFailedError['run']>().toEqualTypeOf<Run>();
    expectTypeOf<RunTimeoutError['run']>().toEqualTypeOf<Run>();
    expectTypeOf<FormulaRunFailedError['run']>().toEqualTypeOf<FormulaRun>();
    expectTypeOf<RunTimeoutError<JSONObject, FormulaRun>['run']>().toEqualTypeOf<FormulaRun>();
  }));
});
