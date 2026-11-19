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
  /** Only runs started with this API key (`key_…`). */
  api_key_id?: string;
  /** Only runs created at or after this time (RFC 3339, or a day). */
  from?: string | Date;
  /** Only runs created before this time (RFC 3339, or a day). */
  to?: string | Date;
}

export interface RecordListParams {
  /** Records per page: 1 to 1000. Default 100. */
  limit?: number;
  /** The `next_cursor` of the page before. */
  cursor?: string;
}

/** How the API writes records for {@link Runs.export}: `csv` (a header row, then a row a record) or `ndjson`. */
export type RecordFormat = 'csv' | 'ndjson';

export interface RecordExportParams {
  format: RecordFormat;
  /** Records per page: 1 to 1000. Default 100 for one page, 1000 for {@link Runs.exportAll}. */
  limit?: number;
  /** The `nextCursor` of the page before. */
  cursor?: string;
}

/** One page of a run's records as the API wrote it. */
export interface RecordsExport {
  format: RecordFormat;
  /** The page's bytes: UTF-8 text. */
  body: Uint8Array;
  /** The page as text. */
  text: string;
  /** Where the next page starts (the `X-Next-Cursor` header); `null` on the last page. */
  nextCursor: string | null;
  /** True when the records are gone: they are kept 7 days after a run ends. */
  expired: boolean;
}

/**
 * Where the account stands, as the API says it in the headers of every answer about runs (`X-Units-*`,
 * `X-RateLimit-*`). A number the answer did not carry is `null`.
 */
export interface Standing {
  /** The month's allowance of units. For an unmetered account, the largest number the API's integers hold. */
  unitsLimit: number | null;
  /** Units of the month's allowance used so far. */
  unitsUsed: number | null;
  /** Units of the month's allowance left. Top-up units are counted apart. */
  unitsRemaining: number | null;
  /** Top-up units left: spent once the month's allowance is used up; they do not expire. */
  unitsTopup: number | null;
  /** When the allowance starts again: the first of next month, RFC 3339 UTC. */
  unitsReset: string | null;
  /** Runs the account may have in progress at the same time. */
  runsLimit: number | null;
  /** How many more runs can be started now. */
  runsRemaining: number | null;
  /** True for an account with no unit limit. */
  unmetered: boolean;
}

// --- webhooks --------------------------------------------------------------------------------------------------------

/** How a run ended, as a webhook names it. `run.succeeded` is the status `ok`. */
export type WebhookEventName = 'run.succeeded' | 'run.partial' | 'run.failed' | 'run.unsupported' | 'run.cancelled';

/** A URL of yours that is sent a signed `POST` when a run ends with one of the events it asked for. */
export interface WebhookEndpoint {
  /** `whk_…` */
  id: string;
  url: string;
  /** A note for yourself. */
  description: string;
  /** The run endings it is told about. */
  events: WebhookEventName[];
  /** `false`: nothing is sent to it. */
  enabled: boolean;
  /** Why it was switched off for you (its deliveries failed for a day). `null` when it is on, and when you switched it off yourself. */
  disabled_reason: string | null;
  disabled_at: string | null;
  /** When a delivery to it last succeeded. */
  last_success_at: string | null;
  /** When an attempt to deliver to it last failed. */
  last_failure_at: string | null;
  created_at: string;
}

/** An endpoint with its signing secret: what creating one, or replacing its secret, returns. */
export interface WebhookEndpointWithSecret extends WebhookEndpoint {
  /** The signing secret (`whsec_…`). Returned only here, once: store it. */
  secret: string;
}

/** The body of `GET /v1/webhooks`. */
export interface WebhookEndpointList {
  endpoints: WebhookEndpoint[];
  /** Whether the account has a signing secret for a run's own `webhook_url`. */
  run_secret_set: boolean;
}

/** The body of `POST /v1/webhooks/run-secret`. */
export interface WebhookSecret {
  /** The signing secret (`whsec_…`). Returned only here, once: store it. */
  secret: string;
}

export interface WebhookEndpointCreateParams {
  /** Where to `POST`: an `https` URL. */
  url: string;
  /** The run endings to be told about; at least one. */
  events: WebhookEventName[];
  /** A note for yourself, up to 200 characters. */
  description?: string;
}

/** What to change of an endpoint: at least one of these. */
export interface WebhookEndpointUpdateParams {
  url?: string;
  events?: WebhookEventName[];
  description?: string;
  /** `false` switches the endpoint off; `true` switches it on again. */
  enabled?: boolean;
}

export type WebhookDeliveryStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled';

/** One event sent to one target, with how its last attempt went. */
export interface WebhookDelivery {
  /** `whd_…` */
  id: string;
  /** `null` for a delivery to a run's own `webhook_url`. */
  endpoint_id: string | null;
  run_id: string;
  /** The `id` in the event's body and the `X-Webhook-Id` header: the same on every attempt, and when the delivery is sent again. */
  event_id: string;
  event: WebhookEventName;
  url: string;
  /**
   * `pending`: waiting for its next attempt. `succeeded`: answered 2xx. `failed`: out of attempts. `cancelled`: its
   * endpoint was switched off or deleted first.
   */
  status: WebhookDeliveryStatus;
  /** Attempts made so far. */
  attempts: number;
  max_attempts: number;
  /** When it is tried next; `null` once it has ended. */
  next_attempt_at: string | null;
  /** The HTTP status of the last attempt's answer, when there was one. */
  response_status: number | null;
  /**
   * A stable code for why the last attempt failed (`http_error`, `redirect_refused`, `timeout`, `connection_failed`,
   * `tls_error`, `dns_failed`, `address_not_allowed`, `url_not_allowed`) or why the delivery was cancelled
   * (`endpoint_disabled`, `endpoint_deleted`). `null` after a success.
   */
  error: string | null;
  /** How long the last attempt took, in milliseconds. */
  duration_ms: number | null;
  last_attempt_at: string | null;
  created_at: string;
  finished_at: string | null;
  /** The delivery this one was sent again from. */
  resend_of: string | null;
}

/** The body of `GET /v1/webhooks/deliveries`. */
export interface WebhookDeliveryList {
  deliveries: WebhookDelivery[];
  next_cursor: string | null;
}

export interface WebhookDeliveryListParams {
  /** Deliveries per page: 1 to 100. Default 20. */
  limit?: number;
  /** The `next_cursor` of the page before. */
  cursor?: string;
  /** Only deliveries to this endpoint. */
  endpoint_id?: string;
  /** Only deliveries about this run. */
  run_id?: string;
  /** Only deliveries with this status. */
  status?: WebhookDeliveryStatus;
}

/**
 * What a webhook request carries. `parseWebhook` returns it from a request that verified.
 *
 * @typeParam TInput - The run's input, as sent.
 */
export interface WebhookEvent<TInput = JSONObject> {
  /** `evt_…`: the same on every attempt and when the delivery is sent again, so use it to ignore a repeat. */
  id: string;
  type: WebhookEventName;
  created_at: string;
  data: {
    /** The run that ended, as `client.runs.get()` would return it. */
    run: Run<TInput>;
  };
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
  /** True for an account with no unit limit (the service's own): nothing it does is refused for units. */
  unmetered?: boolean;
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
