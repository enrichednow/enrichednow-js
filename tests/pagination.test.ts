import { describe, expect, it } from 'vitest';

import { EnrichedNowError, Page, RecordsPage } from '../src';
import { json, makeClient, makeRun, mockFetch } from './helpers';

const threePages = () =>
  mockFetch(
    json({ records: [{ n: 1 }, { n: 2 }], next_cursor: 'Mg' }),
    json({ records: [{ n: 3 }, { n: 4 }], next_cursor: 'NA' }),
    json({ records: [{ n: 5 }], next_cursor: null }),
  );

describe('paging through records', () => {
  it('asks for nothing until the list is used', async () => {
    const mock = mockFetch();
    makeClient(mock.fetch).runs.records('run_1');
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(mock.calls).toHaveLength(0);
  });

  it('iterates every record of every page, passing each cursor back', async () => {
    const mock = threePages();
    const seen: number[] = [];
    for await (const record of makeClient(mock.fetch).runs.records<{ n: number }>('run_1', { limit: 2 })) {
      seen.push(record.n);
    }
    expect(seen).toEqual([1, 2, 3, 4, 5]);
    expect(mock.calls.map((call) => call.url.search)).toEqual(['?limit=2', '?limit=2&cursor=Mg', '?limit=2&cursor=NA']);
    expect(mock.calls.every((call) => call.url.pathname === '/v1/runs/run_1/records')).toBe(true);
  });

  it('fetches no further page after a break', async () => {
    const mock = threePages();
    for await (const record of makeClient(mock.fetch).runs.records<{ n: number }>('run_1')) {
      if (record.n === 1) break;
    }
    expect(mock.calls).toHaveLength(1);
  });

  it('collects everything with toArray()', async () => {
    const mock = threePages();
    const records = await makeClient(mock.fetch).runs.records<{ n: number }>('run_1').toArray();
    expect(records.map((record) => record.n)).toEqual([1, 2, 3, 4, 5]);
  });

  it('stops toArray() at maxItems without fetching more', async () => {
    const mock = threePages();
    const records = await makeClient(mock.fetch).runs.records<{ n: number }>('run_1').toArray({ maxItems: 3 });
    expect(records.map((record) => record.n)).toEqual([1, 2, 3]);
    expect(mock.calls).toHaveLength(2);
  });

  it('gives page-level access when awaited', async () => {
    const mock = threePages();
    const first = await makeClient(mock.fetch).runs.records<{ n: number }>('run_1');
    expect(first).toBeInstanceOf(RecordsPage);
    expect(first).toBeInstanceOf(Page);
    expect(first.data).toEqual([{ n: 1 }, { n: 2 }]);
    expect(first.nextCursor).toBe('Mg');
    expect(first.expired).toBe(false);
    expect(first.hasNextPage()).toBe(true);

    const second = await first.getNextPage();
    expect(second.data).toEqual([{ n: 3 }, { n: 4 }]);
    const third = await second.getNextPage();
    expect(third.hasNextPage()).toBe(false);
    expect(third.nextCursor).toBeNull();
    await expect(third.getNextPage()).rejects.toBeInstanceOf(EnrichedNowError);
    expect(mock.calls).toHaveLength(3);
  });

  it('iterates pages with pages()', async () => {
    const mock = threePages();
    const sizes: number[] = [];
    for await (const page of makeClient(mock.fetch).runs.records('run_1').pages()) {
      sizes.push(page.data.length);
    }
    expect(sizes).toEqual([2, 2, 1]);
  });

  it('iterates on from a page', async () => {
    const mock = threePages();
    const first = await makeClient(mock.fetch).runs.records<{ n: number }>('run_1');
    const seen: number[] = [];
    for await (const record of first) seen.push(record.n);
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });

  it('fetches the first page once, however often it is awaited', async () => {
    const mock = mockFetch(json({ records: [{ n: 1 }], next_cursor: null }));
    const records = makeClient(mock.fetch).runs.records('run_1');
    await records;
    await records;
    await records.toArray();
    expect(mock.calls).toHaveLength(1);
  });

  it('says when the records have expired', async () => {
    const mock = mockFetch(json({ records: [], next_cursor: null, expired: true }));
    const page = await makeClient(mock.fetch).runs.records('run_1');
    expect(page.expired).toBe(true);
    expect(page.data).toEqual([]);
  });

  it('serialises a page as its data', async () => {
    const mock = mockFetch(json({ records: [{ n: 1 }], next_cursor: null }));
    const page = await makeClient(mock.fetch).runs.records('run_1');
    expect(JSON.parse(JSON.stringify(page))).toEqual({ data: [{ n: 1 }], nextCursor: null, expired: false });
    expect(Object.keys(page)).toEqual(['data', 'nextCursor', 'expired']);
  });

  it('rejects when a page cannot be read', async () => {
    const mock = mockFetch(json({ error: { code: 'not_found', message: "There is no run 'run_x'.", details: {} } }, 404));
    await expect(makeClient(mock.fetch).runs.records('run_x').toArray()).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('paging through the other lists', () => {
  it('runs.list() pages with next_cursor and keeps its filters', async () => {
    const mock = mockFetch(
      json({ runs: [makeRun('ok', { id: 'run_a' })], next_cursor: 'abc' }),
      json({ runs: [makeRun('ok', { id: 'run_b' })], next_cursor: null }),
    );
    const ids: string[] = [];
    for await (const run of makeClient(mock.fetch).runs.list({ status: 'ok' })) ids.push(run.id);
    expect(ids).toEqual(['run_a', 'run_b']);
    expect(mock.calls.map((call) => call.url.search)).toEqual(['?status=ok', '?status=ok&cursor=abc']);
  });

  it('data.postings.list() pages with next_cursor and keeps its filters', async () => {
    const mock = mockFetch(json({ postings: [{ id: 'p1' }], next_cursor: 'c2' }), json({ postings: [{ id: 'p2' }], next_cursor: null }));
    const postings = await makeClient(mock.fetch).data.postings.list({ title: 'engineer', sort: 'last_seen_at' }).toArray();
    expect(postings.map((posting) => posting.id)).toEqual(['p1', 'p2']);
    expect(mock.calls.map((call) => call.url.search)).toEqual([
      '?title=engineer&sort=last_seen_at',
      '?title=engineer&sort=last_seen_at&cursor=c2',
    ]);
  });

  it('data.companies.list() and companies.postings() page too', async () => {
    const mock = mockFetch(
      json({ companies: [{ domain: 'a.com' }], next_cursor: 'c2' }),
      json({ companies: [{ domain: 'b.com' }], next_cursor: null }),
      json({ postings: [{ id: 'p1' }], next_cursor: 'c2' }),
      json({ postings: [{ id: 'p2' }], next_cursor: null }),
    );
    const client = makeClient(mock.fetch);
    expect((await client.data.companies.list().toArray()).map((company) => company.domain)).toEqual(['a.com', 'b.com']);
    expect((await client.data.companies.postings('a.com').toArray()).map((posting) => posting.id)).toEqual(['p1', 'p2']);
    expect(mock.calls[3]!.url.pathname + mock.calls[3]!.url.search).toBe('/v1/data/companies/a.com/postings?cursor=c2');
  });
});
