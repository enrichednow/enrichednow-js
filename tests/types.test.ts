import { describe, expectTypeOf, it } from 'vitest';

import { parseWebhook, verifyWebhook } from '../src';
import type {
  Company,
  Page,
  PagePromise,
  Posting,
  PostingDetail,
  RecordsPage,
  Run,
  Scraper,
  ScraperDetail,
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
});
