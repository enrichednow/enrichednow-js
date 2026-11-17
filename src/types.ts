/**
 * The shapes of the EnrichedNow API, version v1.
 *
 * Field names are the API's own (`snake_case`), so what you read here is what the API reference shows.
 * Times are RFC 3339 strings in UTC; dates are `YYYY-MM-DD`.
 */

/** Any JSON object. */
export type JSONObject = Record<string, unknown>;

/** A JSON Schema document. */
export type JSONSchema = Record<string, unknown>;

// --- service ---------------------------------------------------------------------------------------------------------

export interface Health {
  status: 'ok';
}

// --- scrapers --------------------------------------------------------------------------------------------------------

/** A scraper as the catalogue lists it. */
export interface Scraper {
  /** The id a run is started with, e.g. `ats.board`. */
  id: string;
  /** A whole number that goes up when the scraper changes. */
  version: number;
  title: string;
  summary: string;
  mode: 'sync' | 'job';
  /** What a charged run costs: one unit a `request`, or one unit a `record`. */
  billing_unit: 'request' | 'record';
  data_class: string;
  availability: 'public' | 'internal';
}

/** One scraper, with the JSON Schema of its input and of its records. */
export interface ScraperDetail extends Scraper {
  /** JSON Schema of the run's `input`. */
  input_schema: JSONSchema;
  /** JSON Schema of one record. */
  record_schema: JSONSchema;
}

/** The body of `GET /v1/scrapers`. */
export interface ScraperList {
  scrapers: Scraper[];
}

// --- runs ------------------------------------------------------------------------------------------------------------

export type RunStatus = 'queued' | 'running' | 'ok' | 'partial' | 'failed' | 'unsupported' | 'cancelled';

/** The statuses a run can end with. */
export type TerminalRunStatus = Exclude<RunStatus, 'queued' | 'running'>;

/** The statuses a run that produced no usable result ends with. */
export type FailedRunStatus = 'failed' | 'unsupported' | 'cancelled';

export interface RunDiagnostics {
  /** Requests the run made, in total. */
  requests: number;
  /** Bytes fetched; `null` when they were not measured. */
  bytes: number | null;
  /** How long the run took, in milliseconds. */
  wall_ms: number | null;
  /** What the scraper learned about the target, e.g. `careers_url`, `ats`, `pages_read`. Which facts depends on the scraper. */
  facts: Record<string, unknown>;
}

/**
 * One execution of one scraper with one input.
 *
 * @typeParam TInput - The scraper's input, as sent.
 */
export interface Run<TInput = JSONObject> {
  id: string;
  scraper_id: string;
  scraper_version: number;
  status: RunStatus;
  /** A stable code whenever the status is not `ok`, e.g. `render_required`, `fetch_failed`, `cancelled`; `null` when it is. */
  reason: string | null;
  input: TInput;
  /** How many records the run stored. */
  record_count: number;
  /** Units charged: `0` until the run ends `ok` or `partial`. */
  units: number;
  /** What the run did; `null` until it ends. */
  diagnostics: RunDiagnostics | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

/** The body of `GET /v1/runs`. */
export interface RunList<TInput = JSONObject> {
  runs: Run<TInput>[];
  next_cursor: string | null;
}

/** The body of `GET /v1/runs/{id}/records`. */
export interface RecordList<TRecord = JSONObject> {
  records: TRecord[];
  next_cursor: string | null;
  /** Present, and `true`, only when the records are gone: they are kept 7 days after the run ended. */
  expired?: boolean | null;
}

export interface RunListParams {
  /** Runs per page: 1 to 100. Default 20. */
  limit?: number;
  /** The `next_cursor` of the page before. */
  cursor?: string;
  /** Only runs of this scraper. */
  scraper_id?: string;
  /** Only runs with this status. */
  status?: RunStatus;
}

export interface RecordListParams {
  /** Records per page: 1 to 1000. Default 100. */
  limit?: number;
  /** The `next_cursor` of the page before. */
  cursor?: string;
}

// --- usage -----------------------------------------------------------------------------------------------------------

export type UsageGroupBy = 'day' | 'scraper' | 'product';
export type Product = 'scrapers' | 'data';

export interface UsageParams {
  /** First day (UTC), included: `YYYY-MM-DD` or a `Date`. Default: the 1st of the month `to` falls in. */
  from?: string | Date;
  /** Last day (UTC), included: `YYYY-MM-DD` or a `Date`. Default: today. */
  to?: string | Date;
  /** One row per day (the default), per scraper or per product. */
  group_by?: UsageGroupBy;
  /** Only this product's usage. Without it, both products are counted together. */
  product?: Product;
}

export interface UsagePeriod {
  from: string;
  to: string;
}

export interface UsageRow {
  /** A day (`YYYY-MM-DD`, UTC), a scraper id, or a product (`scrapers`, `data`), depending on `group_by`. */
  key: string;
  units: number;
  /** What was charged: runs that ended `ok` or `partial` and, for the data API, requests that returned at least one record. */
  runs: number;
}

export interface Usage {
  period: UsagePeriod;
  /** Units charged in the period: of both products, or of the one `product` names. */
  total_units: number;
  /** The account's allowance for a calendar month (UTC): the data allowance with `product: 'data'`, otherwise the unit allowance. */
  allowance_units: number;
  rows: UsageRow[];
}

// --- datasets: /v1/data ----------------------------------------------------------------------------------------------

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'temporary' | 'internship' | 'volunteer';

export type Seniority = 'c_level' | 'vp' | 'director' | 'manager' | 'lead' | 'senior' | 'junior' | 'intern';

export type JobFunction =
  | 'data'
  | 'sales'
  | 'customer_support'
  | 'product'
  | 'design'
  | 'marketing'
  | 'finance'
  | 'legal'
  | 'people'
  | 'it'
  | 'healthcare'
  | 'education'
  | 'operations'
  | 'engineering'
  | 'skilled_trades'
  | 'retail_hospitality';

export type Provenance = 'feed' | 'page' | 'board';

export interface CompanyRef {
  domain: string | null;
  name: string | null;
}

export interface PostingLocation {
  raw: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  remote: boolean | null;
}

export interface Salary {
  raw: string | null;
  min: number | null;
  max: number | null;
  currency: string | null;
  period: string | null;
}

export interface PostingSource {
  /** The source's name: an applicant tracking system (`greenhouse`), a job board, or `careers_page`. */
  name: string;
  provenance: Provenance;
  trusted: boolean;
  external_id: string | null;
}

export interface Posting {
  id: string;
  title: string;
  title_clean: string;
  company: CompanyRef;
  location: PostingLocation;
  employment_type: EmploymentType | null;
  salary: Salary | null;
  /** `YYYY-MM-DD`. */
  posted_at: string | null;
  /** `YYYY-MM-DD`. */
  valid_through: string | null;
  seniority: Seniority | null;
  function: JobFunction | null;
  url: string;
  apply_url: string | null;
  source: PostingSource;
  status: 'open' | 'closed';
  first_seen_at: string;
  last_seen_at: string;
  closed_at: string | null;
}

export interface PostingClassification {
  seniority_rule: string | null;
  function_rule: string | null;
}

export interface PostingEvent {
  kind: 'first_seen' | 'seen_earlier' | 'closed' | 'reopened';
  at: string;
}

export interface PostingChange {
  field: string;
  old: unknown;
  new: unknown;
  at: string;
}

export interface PostingSightings {
  count: number;
  recent: string[];
}

export interface PostingHistory {
  events: PostingEvent[];
  changes: PostingChange[];
  sightings: PostingSightings;
  reopened_count: number;
}

/** One posting, with its description and its history. */
export interface PostingDetail extends Posting {
  description: string | null;
  classification: PostingClassification;
  history: PostingHistory;
}

/** The body of the posting lists. */
export interface PostingList {
  postings: Posting[];
  next_cursor: string | null;
}

/** The filters of a postings search. They are the same for all postings and for one company's. */
export interface PostingFilterParams {
  /** Words that must all appear in the cleaned title, in any order and any case. */
  title?: string;
  /** Text that must appear in the location (raw text, city, region or country). */
  location?: string;
  /** A country code (ISO 3166-1 alpha-2) or name. */
  country?: string;
  /** `true`: marked remote. `false`: marked not remote. Postings that do not say are in neither. */
  remote?: boolean;
  employment_type?: EmploymentType;
  seniority?: Seniority;
  function?: JobFunction;
  /** `open`: not closed. `closed`: has `closed_at`. Default `all`. */
  status?: 'open' | 'closed' | 'all';
  /** The source's name: an applicant tracking system (`greenhouse`), a job board, or `careers_page`. */
  source?: string;
  /** Which provenances to return: one or more of `feed`, `page`, `board`, or `all`. Only `feed` is returned unless asked. */
  provenance?: Provenance | 'all' | Provenance[] | (string & {});
  /** `true`: also return postings not matched to a company. */
  unmatched?: boolean;
  /** Posted on or after this date: `YYYY-MM-DD` or a `Date`. */
  posted_from?: string | Date;
  /** Posted on or before this date: `YYYY-MM-DD` or a `Date`. */
  posted_to?: string | Date;
  /** First seen at or after this time (a date means its start, UTC). */
  first_seen_from?: string | Date;
  /** First seen before this time. */
  first_seen_to?: string | Date;
  /** Last seen at or after this time. */
  last_seen_from?: string | Date;
  /** Last seen before this time. */
  last_seen_to?: string | Date;
  /** Newest first by this time. Default `first_seen_at`. */
  sort?: 'first_seen_at' | 'last_seen_at';
  /** Postings per page: 1 to 200. Default 50. Each posting returned costs one data unit. */
  limit?: number;
  /** The `next_cursor` of the previous page, with the same other parameters. */
  cursor?: string;
}

export interface PostingListParams extends PostingFilterParams {
  /** The company's domain; any host or URL of it will do. */
  company_domain?: string;
}

export interface CompanyName {
  name: string;
  first_seen_at: string;
  last_seen_at: string;
}

export interface CompanyLastRead {
  at: string | null;
  status: 'complete' | 'incomplete' | 'failed' | null;
  last_complete_at: string | null;
}

export interface PostingCounts {
  open: number;
  closed: number;
}

export interface Company {
  domain: string;
  name: string | null;
  names: CompanyName[];
  careers_url: string | null;
  /** The applicant tracking system detected. */
  ats: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_read: CompanyLastRead;
  /** Counts of trusted postings. */
  postings: PostingCounts;
}

/** The body of `GET /v1/data/companies`. */
export interface CompanyList {
  companies: Company[];
  next_cursor: string | null;
}

export interface CompanyListParams {
  /** Text that must appear in the domain or in a name seen. */
  q?: string;
  /** The applicant tracking system detected. */
  ats?: string;
  /** Companies per page: 1 to 200. Default 50. Each company returned costs one data unit. */
  limit?: number;
  /** The `next_cursor` of the page before. */
  cursor?: string;
}

// --- errors ----------------------------------------------------------------------------------------------------------

/** The codes of the API's errors. Match on these. */
export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_input'
  | 'quota_exceeded'
  | 'too_many_runs'
  | 'rate_limited'
  | 'internal'
  | 'data_unavailable';

/** One problem of an `invalid_input` error. `path` is where it is, as you wrote it: `input.board_url`, `wait`, `limit`. */
export interface FieldError {
  path: string;
  message: string;
}

/** The body of every error the API returns. */
export interface ErrorBody {
  error: {
    code: ErrorCode | (string & {});
    message: string;
    details: Record<string, unknown>;
  };
}
