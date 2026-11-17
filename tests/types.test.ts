import { describe, expectTypeOf, it } from 'vitest';

import type { Company, Page, PagePromise, Posting, PostingDetail, RecordsPage, Run, Scraper, ScraperDetail, Usage } from '../src';
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

  it('records are JSON objects unless told otherwise', checked(() => {
    expectTypeOf(client.runs.records('run_1').toArray()).resolves.toEqualTypeOf<Record<string, unknown>[]>();
  }));
});
