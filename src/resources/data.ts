import type { EnrichedNow, RequestOptions } from '../client';
import { Page, PagePromise } from '../pagination';
import type {
  Company,
  CompanyList,
  CompanyListParams,
  Posting,
  PostingDetail,
  PostingFilterParams,
  PostingList,
  PostingListParams,
} from '../types';
import { dateParam } from './usage';

/**
 * The datasets: job postings and the companies they belong to, under `/v1/data`.
 *
 * Each record returned costs one data unit, so iterating a whole list costs as many units as it has records.
 * Narrow the search with filters, and stop early with `break` or `toArray({ maxItems })`.
 */
export class Data {
  readonly companies: Companies;
  readonly postings: Postings;

  constructor(client: EnrichedNow) {
    this.companies = new Companies(client);
    this.postings = new Postings(client);
  }
}

export class Postings {
  constructor(private readonly client: EnrichedNow) {}

  /**
   * Search job postings, newest first. By default: postings from applicant tracking systems, matched to a company,
   * open and closed.
   *
   * ```ts
   * for await (const posting of client.data.postings.list({ title: 'data engineer', country: 'US', status: 'open' })) { ... }
   * ```
   */
  list(params: PostingListParams = {}, options?: RequestOptions): PagePromise<Posting> {
    return postingsPage(this.client, '/v1/data/postings', params, options);
  }

  /** One posting, with its description and its history. Any posting can be read by its id, whatever its provenance. */
  get(postingId: string, options?: RequestOptions): Promise<PostingDetail> {
    return this.client.request<PostingDetail>({
      method: 'GET',
      path: `/v1/data/postings/${encodeURIComponent(postingId)}`,
      ...options,
    });
  }
}

export class Companies {
  constructor(private readonly client: EnrichedNow) {}

  /** List companies, by domain. */
  list(params: CompanyListParams = {}, options?: RequestOptions): PagePromise<Company> {
    const fetchPage = async (cursor: string | undefined): Promise<Page<Company>> => {
      const body = await this.client.request<CompanyList>({
        method: 'GET',
        path: '/v1/data/companies',
        query: { ...params, cursor },
        ...options,
      });
      return new Page(body.companies, body.next_cursor, fetchPage);
    };
    return new PagePromise(() => fetchPage(params.cursor));
  }

  /** One company, by domain. Any host of the company's domain will do (`www.acme.com`, `jobs.acme.com`). */
  get(domain: string, options?: RequestOptions): Promise<Company> {
    return this.client.request<Company>({
      method: 'GET',
      path: `/v1/data/companies/${encodeURIComponent(domain)}`,
      ...options,
    });
  }

  /** A company's postings: the same filters, defaults and paging as the postings search. */
  postings(domain: string, params: PostingFilterParams = {}, options?: RequestOptions): PagePromise<Posting> {
    return postingsPage(this.client, `/v1/data/companies/${encodeURIComponent(domain)}/postings`, params, options);
  }
}

function postingsPage(
  client: EnrichedNow,
  path: string,
  params: PostingListParams,
  options: RequestOptions | undefined,
): PagePromise<Posting> {
  const query = {
    ...params,
    // `posted_*` are days; the `*_seen_*` bounds are times, which a `Date` already is.
    posted_from: dateParam(params.posted_from),
    posted_to: dateParam(params.posted_to),
  };
  const fetchPage = async (cursor: string | undefined): Promise<Page<Posting>> => {
    const body = await client.request<PostingList>({ method: 'GET', path, query: { ...query, cursor }, ...options });
    return new Page(body.postings, body.next_cursor, fetchPage);
  };
  return new PagePromise(() => fetchPage(params.cursor));
}
