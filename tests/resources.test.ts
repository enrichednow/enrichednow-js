import { describe, expect, it } from 'vitest';

import { unitCost } from '../src';
import type { Company, Posting, PostingDetail, Scraper, ScraperDetail, Usage } from '../src';
import { json, makeClient, makeRun, mockFetch } from './helpers';

const scraper = {
  id: 'ats.board',
  version: 1,
  title: 'ATS board',
  summary: 'The openings of one board.',
  mode: 'job',
  billing_unit: 'request',
  units_per_request: 5,
  units_per_record: null,
  data_class: 'jobs',
  availability: 'public',
} as const;

const posting = { id: 'pst_1', title: 'Engineer' } as unknown as Posting;
const company = { domain: 'acme.com', name: 'Acme' } as unknown as Company;

/** The one request a call made: `METHOD /path?query`. */
function request(mock: ReturnType<typeof mockFetch>, index = 0): string {
  const call = mock.calls[index]!;
  return `${call.method} ${call.url.pathname}${call.url.search}`;
}

describe('scrapers', () => {
  it('unitCost() is a run or a record by the billing unit, 1 when the API did not say', () => {
    expect(unitCost(scraper)).toBe(5);
    const byRecord: Scraper = { ...scraper, billing_unit: 'record', units_per_request: null, units_per_record: 4 };
    expect(unitCost(byRecord)).toBe(4);
    const { units_per_request: _a, units_per_record: _b, ...old } = scraper;
    expect(unitCost(old)).toBe(1);
    expect(unitCost({ ...old, billing_unit: 'record' })).toBe(1);
    expect(unitCost({ ...scraper, units_per_request: null, units_per_record: 9 })).toBe(1);
  });

  it('list() returns the catalogue as an array', async () => {
    const mock = mockFetch(json({ scrapers: [scraper] }));
    await expect(makeClient(mock.fetch).scrapers.list()).resolves.toEqual([scraper]);
    expect(request(mock)).toBe('GET /v1/scrapers');
  });

  it('get() returns one scraper with its schemas', async () => {
    const detail: ScraperDetail = { ...scraper, input_schema: { type: 'object' }, record_schema: { type: 'object' } };
    const mock = mockFetch(json(detail));
    await expect(makeClient(mock.fetch).scrapers.get('ats.board')).resolves.toEqual(detail);
    expect(request(mock)).toBe('GET /v1/scrapers/ats.board');
  });

  it('run() posts the input under `input`', async () => {
    const mock = mockFetch(json(makeRun('queued'), 202));
    const run = await makeClient(mock.fetch).scrapers.run('ats.board', { board_url: 'https://boards.greenhouse.io/acme' });
    expect(run.status).toBe('queued');
    expect(request(mock)).toBe('POST /v1/scrapers/ats.board/runs');
    expect(mock.calls[0]!.body).toEqual({ input: { board_url: 'https://boards.greenhouse.io/acme' } });
    expect(mock.calls[0]!.headers['content-type']).toBe('application/json');
  });

  it('run() sends `wait` as a query parameter', async () => {
    const mock = mockFetch(json(makeRun('ok')));
    const run = await makeClient(mock.fetch).scrapers.run('ats.board', {}, { wait: 60 });
    expect(run.status).toBe('ok');
    expect(request(mock)).toBe('POST /v1/scrapers/ats.board/runs?wait=60');
  });

  it('escapes an id in the path', async () => {
    const mock = mockFetch(json(scraper));
    await makeClient(mock.fetch).scrapers.get('a/b c');
    expect(mock.calls[0]!.url.pathname).toBe('/v1/scrapers/a%2Fb%20c');
  });
});

describe('runs', () => {
  it('get() reads one run', async () => {
    const mock = mockFetch(json(makeRun('running')));
    await expect(makeClient(mock.fetch).runs.get('run_1')).resolves.toMatchObject({ status: 'running' });
    expect(request(mock)).toBe('GET /v1/runs/run_1');
  });

  it('list() sends its filters', async () => {
    const mock = mockFetch(json({ runs: [makeRun('partial')], next_cursor: null }));
    const page = await makeClient(mock.fetch).runs.list({ scraper_id: 'careers.company', status: 'partial', limit: 50 });
    expect(page.data).toHaveLength(1);
    expect(request(mock)).toBe('GET /v1/runs?scraper_id=careers.company&status=partial&limit=50');
  });

  it('cancel() posts to the run', async () => {
    const mock = mockFetch(json(makeRun('cancelled')));
    await expect(makeClient(mock.fetch).runs.cancel('run_1')).resolves.toMatchObject({ status: 'cancelled', reason: 'cancelled' });
    expect(request(mock)).toBe('POST /v1/runs/run_1/cancel');
    expect(mock.calls[0]!.body).toBeUndefined();
  });

  it('records() sends limit and cursor', async () => {
    const mock = mockFetch(json({ records: [{ title: 'Engineer' }], next_cursor: null }));
    const page = await makeClient(mock.fetch).runs.records<{ title: string }>('run_1', { limit: 1000, cursor: 'MTAw' });
    expect(page.data[0]!.title).toBe('Engineer');
    expect(request(mock)).toBe('GET /v1/runs/run_1/records?limit=1000&cursor=MTAw');
  });
});

describe('usage', () => {
  const usage: Usage = {
    period: { from: '2026-11-01', to: '2026-11-30' },
    total_units: 12,
    allowance_units: 1000,
    rows: [{ key: 'ats.board', units: 12, runs: 12 }],
  };

  it('get() without parameters asks for the default period', async () => {
    const mock = mockFetch(json(usage));
    await expect(makeClient(mock.fetch).usage.get()).resolves.toEqual(usage);
    expect(request(mock)).toBe('GET /v1/usage');
  });

  it('get() sends the period, the grouping and the product', async () => {
    const mock = mockFetch(json(usage));
    await makeClient(mock.fetch).usage.get({ from: '2026-11-01', to: '2026-11-30', group_by: 'scraper', product: 'scrapers' });
    expect(request(mock)).toBe('GET /v1/usage?from=2026-11-01&to=2026-11-30&group_by=scraper&product=scrapers');
  });

  it('get() takes a Date as its UTC day', async () => {
    const mock = mockFetch(json(usage));
    await makeClient(mock.fetch).usage.get({ from: new Date('2026-11-01T23:30:00Z'), to: new Date('2026-11-30T00:00:00Z') });
    expect(request(mock)).toBe('GET /v1/usage?from=2026-11-01&to=2026-11-30');
  });
});

describe('data', () => {
  it('postings.list() sends its filters', async () => {
    const mock = mockFetch(json({ postings: [posting], next_cursor: null }));
    const page = await makeClient(mock.fetch).data.postings.list({
      company_domain: 'acme.com',
      title: 'data engineer',
      country: 'US',
      remote: true,
      employment_type: 'full_time',
      seniority: 'senior',
      function: 'engineering',
      status: 'open',
      source: 'greenhouse',
      provenance: ['feed', 'page'],
      unmatched: false,
      posted_from: new Date('2026-11-01T12:00:00Z'),
      posted_to: '2026-11-30',
      first_seen_from: new Date('2026-11-01T00:00:00.000Z'),
      last_seen_to: '2026-11-17T00:00:00Z',
      sort: 'last_seen_at',
      limit: 200,
    });
    expect(page.data).toEqual([posting]);
    const { url } = mock.calls[0]!;
    expect(url.pathname).toBe('/v1/data/postings');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      company_domain: 'acme.com',
      title: 'data engineer',
      country: 'US',
      remote: 'true',
      employment_type: 'full_time',
      seniority: 'senior',
      function: 'engineering',
      status: 'open',
      source: 'greenhouse',
      provenance: 'feed,page',
      unmatched: 'false',
      posted_from: '2026-11-01',
      posted_to: '2026-11-30',
      first_seen_from: '2026-11-01T00:00:00.000Z',
      last_seen_to: '2026-11-17T00:00:00Z',
      sort: 'last_seen_at',
      limit: '200',
    });
  });

  it('postings.get() reads one posting', async () => {
    const detail = { ...posting, description: 'Words.' } as PostingDetail;
    const mock = mockFetch(json(detail));
    await expect(makeClient(mock.fetch).data.postings.get('pst_1')).resolves.toEqual(detail);
    expect(request(mock)).toBe('GET /v1/data/postings/pst_1');
  });

  it('companies.list() sends its filters', async () => {
    const mock = mockFetch(json({ companies: [company], next_cursor: null }));
    const page = await makeClient(mock.fetch).data.companies.list({ q: 'acme', ats: 'greenhouse', limit: 10 });
    expect(page.data).toEqual([company]);
    expect(request(mock)).toBe('GET /v1/data/companies?q=acme&ats=greenhouse&limit=10');
  });

  it('companies.get() reads one company by domain', async () => {
    const mock = mockFetch(json(company));
    await expect(makeClient(mock.fetch).data.companies.get('www.acme.com')).resolves.toEqual(company);
    expect(request(mock)).toBe('GET /v1/data/companies/www.acme.com');
  });

  it("companies.postings() reads a company's postings with the same filters", async () => {
    const mock = mockFetch(json({ postings: [posting], next_cursor: null }));
    const page = await makeClient(mock.fetch).data.companies.postings('acme.com', { status: 'open', provenance: 'all' });
    expect(page.data).toEqual([posting]);
    expect(request(mock)).toBe('GET /v1/data/companies/acme.com/postings?status=open&provenance=all');
  });
});
