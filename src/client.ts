import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  EnrichedNowError,
  RunFailedError,
  retryAfterMs,
} from './errors';
import { DEFAULT_BASE_URL, DEFAULT_MAX_RETRIES, DEFAULT_RUN_TIMEOUT, DEFAULT_TIMEOUT, sleep } from './internal';
import type { PagePromise, RecordsPage } from './pagination';
import { Data } from './resources/data';
import { Runs, isFailedStatus, isTerminalStatus, pollRun } from './resources/runs';
import { Scrapers } from './resources/scrapers';
import type { RunStartOptions } from './resources/scrapers';
import { UsageResource } from './resources/usage';
import { Webhooks } from './resources/webhooks';
import type { Health, JSONObject, Run, Standing } from './types';
import { VERSION } from './version';

const INITIAL_RETRY_DELAY = 500;
const MAX_RETRY_DELAY = 8_000;
/** A `Retry-After` longer than this is not waited for: the error is thrown, with `retryAfter` on it. */
const MAX_RETRY_AFTER = 60_000;

/** The `fetch` this library calls. Any implementation of the standard will do. */
export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Headers to add to a request. `null` or `undefined` removes a header the client would send. */
export type HeadersInput = Record<string, string | null | undefined>;

export interface ClientOptions {
  /** Your API key (`en_live_…`). Default: the `ENRICHEDNOW_API_KEY` environment variable. */
  apiKey?: string | undefined;
  /** Default `https://api.enrichednow.com`. */
  baseURL?: string | undefined;
  /** Milliseconds one request may take, each attempt on its own. Default 60 000. */
  timeout?: number | undefined;
  /** How many times a request that failed in a way worth retrying is sent again. Default 2. `0` turns retries off. */
  maxRetries?: number | undefined;
  /** The `fetch` to use. Default: the global one. */
  fetch?: Fetch | undefined;
  /** Headers sent with every request. */
  defaultHeaders?: HeadersInput | undefined;
}

/** What every method accepts as its last argument. */
export interface RequestOptions {
  /** Abort the request, and whatever waiting surrounds it. Throws {@link APIUserAbortError}. */
  signal?: AbortSignal | undefined;
  /** Milliseconds this request may take, each attempt on its own. Default: the client's. */
  timeout?: number | undefined;
  /** Default: the client's. */
  maxRetries?: number | undefined;
  /** Headers for this request only. */
  headers?: HeadersInput | undefined;
}

/** A request to the API, for {@link EnrichedNow.request}. */
export interface RequestSpec extends RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** The path under the base URL, e.g. `/v1/runs`. */
  path: string;
  /** Query parameters. `undefined` and `null` are left out; an array is sent comma-separated. */
  query?: Record<string, unknown> | undefined;
  /** Sent as JSON. */
  body?: unknown;
  /**
   * Whether sending the request twice does the same as sending it once. A request that is not idempotent is retried
   * only when the API refused it with `429`, which says nothing was done. Default: `true` for `GET`, `false` otherwise.
   */
  idempotent?: boolean | undefined;
}

/** An answer of the API whose body is not JSON, as {@link EnrichedNow.requestBytes} returns it. */
export interface RawResponse {
  status: number;
  headers: Headers;
  body: Uint8Array;
}

export interface ScrapeOptions extends Omit<RequestOptions, 'timeout'> {
  /** Seconds the first request stays open for the run to end, 0 to 300. Default 60. */
  wait?: number | undefined;
  /** Milliseconds to wait for the run to end, in all. Default 600 000. Past it, {@link RunTimeoutError} is thrown; the run carries on. */
  timeout?: number | undefined;
  /** Milliseconds between two looks at a run that is still going. Default 2 000. */
  pollInterval?: number | undefined;
  /** Throw {@link RunFailedError} when the run ends `failed`, `unsupported` or `cancelled`. Default `true`. */
  throwOnFailure?: boolean | undefined;
  /** Records per page when the records are read: 1 to 1000. Default: the API's, 100. */
  pageSize?: number | undefined;
  /** An `https` URL that is also told when the run ends: see {@link RunStartOptions.webhookUrl}. */
  webhookUrl?: string | undefined;
  /** Names this call so that it can be repeated without a second run: see {@link RunStartOptions.idempotencyKey}. */
  idempotencyKey?: string | undefined;
}

export interface ScrapeResult<TRecord = JSONObject, TInput = JSONObject> {
  /** The run as it ended. */
  run: Run<TInput>;
  /**
   * The run's records. Not fetched until used: iterate with `for await`, collect with `records.toArray()`,
   * or `await` it for the first page.
   */
  records: PagePromise<TRecord, RecordsPage<TRecord>>;
}

/**
 * The EnrichedNow API client.
 *
 * ```ts
 * import EnrichedNow from 'enrichednow';
 *
 * const client = new EnrichedNow(); // reads ENRICHEDNOW_API_KEY
 * const { run, records } = await client.scrape('ats.board', { board_url: 'https://boards.greenhouse.io/acme' });
 * for await (const record of records) console.log(record);
 * ```
 */
export class EnrichedNow {
  readonly apiKey: string;
  readonly baseURL: string;
  readonly timeout: number;
  readonly maxRetries: number;

  /** The catalogue of scrapers, and starting a run. */
  readonly scrapers: Scrapers;
  /** Runs: reading, listing, waiting for, cancelling, and their records. */
  readonly runs: Runs;
  /** Units used over a period. */
  readonly usage: UsageResource;
  /** The datasets: job postings and companies. */
  readonly data: Data;
  /** Webhooks: the endpoints told when a run ends, their signing secrets, and the delivery log. */
  readonly webhooks: Webhooks;

  private readonly fetchImpl: Fetch;
  private readonly defaultHeaders: HeadersInput;
  private lastStanding: Standing | null = null;

  /**
   * Where the account stood at the last answer that said so: every answer about runs carries the account's units and
   * runs in progress in its headers (`X-Units-*`, `X-RateLimit-*`). `null` until such an answer has come;
   * `client.usage.standing()` asks for it.
   */
  get standing(): Standing | null {
    return this.lastStanding;
  }

  constructor(options: ClientOptions = {}) {
    const apiKey = options.apiKey ?? readEnv('ENRICHEDNOW_API_KEY');
    if (typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new EnrichedNowError(
        'No API key. Set the ENRICHEDNOW_API_KEY environment variable, or pass one: ' +
          "new EnrichedNow({ apiKey: 'en_live_...' }). Keys are created in the console, under API keys.",
      );
    }
    this.apiKey = apiKey.trim();
    this.baseURL = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    if (!Number.isInteger(this.maxRetries) || this.maxRetries < 0) {
      throw new EnrichedNowError('maxRetries must be a whole number, 0 or more.');
    }
    if (!(this.timeout > 0)) {
      throw new EnrichedNowError('timeout must be a number of milliseconds above 0.');
    }
    if (options.fetch) {
      this.fetchImpl = options.fetch;
    } else if (typeof globalThis.fetch === 'function') {
      this.fetchImpl = (input, init) => globalThis.fetch(input, init);
    } else {
      throw new EnrichedNowError(
        'There is no global fetch in this runtime. Use Node 18 or later, or pass one: new EnrichedNow({ fetch }).',
      );
    }
    this.defaultHeaders = options.defaultHeaders ?? {};

    this.scrapers = new Scrapers(this);
    this.runs = new Runs(this);
    this.usage = new UsageResource(this);
    this.data = new Data(this);
    this.webhooks = new Webhooks(this);
  }

  /**
   * Run a scraper and wait for it to end: start the run, wait for a final status, and hand back the run with its
   * records.
   *
   * A run that ends `failed`, `unsupported` or `cancelled` throws {@link RunFailedError} — pass
   * `throwOnFailure: false` to get the run back instead. A run that ends `partial` is returned: it has records,
   * and `run.reason` says what is missing.
   *
   * ```ts
   * const { run, records } = await client.scrape('careers.company', { domain: 'acme.com' });
   * const all = await records.toArray();
   * ```
   *
   * @typeParam TRecord - The shape of one record; the scraper's `record_schema` describes it.
   * @typeParam TInput - The shape of the scraper's input.
   */
  async scrape<TRecord = JSONObject, TInput extends object = JSONObject>(
    scraperId: string,
    input: TInput,
    options: ScrapeOptions = {},
  ): Promise<ScrapeResult<TRecord, TInput>> {
    const { wait = 60, timeout = DEFAULT_RUN_TIMEOUT, pollInterval, throwOnFailure = true, pageSize, webhookUrl, idempotencyKey, ...request } = options;
    const deadline = Date.now() + timeout;
    const hold = Math.max(0, Math.min(wait, timeout / 1000));

    const start: RunStartOptions = { ...request, wait: hold };
    if (webhookUrl !== undefined) start.webhookUrl = webhookUrl;
    if (idempotencyKey !== undefined) start.idempotencyKey = idempotencyKey;
    let run = await this.scrapers.run<TInput>(scraperId, input, start);
    if (!isTerminalStatus(run.status)) {
      run = await pollRun<TInput>(this, run.id, { deadline, timeout, pollInterval, last: run, ...request });
    }
    if (throwOnFailure && isFailedStatus(run.status)) {
      throw new RunFailedError(run);
    }
    const records = this.runs.records<TRecord>(run.id, pageSize === undefined ? {} : { limit: pageSize }, request);
    return { run, records };
  }

  /** Whether the service is up. */
  health(options?: RequestOptions): Promise<Health> {
    return this.request<Health>({ method: 'GET', path: '/v1/health', ...options });
  }

  /**
   * Send a request to the API and return its parsed body. The resources are built on this; use it for anything they
   * do not cover.
   */
  async request<T = unknown>(spec: RequestSpec): Promise<T> {
    const { response, body } = await this.exchange(spec);
    const text = decoder.decode(body);
    const parsed = parseBody(text);
    if (parsed === INVALID_JSON) {
      throw new APIError('The API answered with a body that is not JSON.', {
        status: response.status,
        headers: response.headers,
        body: text,
        requestId: response.headers.get('x-request-id') ?? undefined,
      });
    }
    return parsed as T;
  }

  /**
   * Send a request to the API and return the answer's bytes and headers, for a body that is not JSON (records as CSV
   * or NDJSON, a file a run produced). An error answer throws as {@link EnrichedNow.request} does.
   */
  async requestBytes(spec: RequestSpec): Promise<RawResponse> {
    const { response, body } = await this.exchange(spec);
    return { status: response.status, headers: response.headers, body };
  }

  private async exchange(spec: RequestSpec): Promise<{ response: Response; body: Uint8Array }> {
    const { method, path, query, body, signal } = spec;
    const maxRetries = spec.maxRetries ?? this.maxRetries;
    const timeout = spec.timeout ?? this.timeout;
    const idempotent = spec.idempotent ?? method === 'GET';
    const url = this.buildURL(path, query);
    const headers = this.buildHeaders(body !== undefined, spec.headers);
    const payload = body === undefined ? undefined : JSON.stringify(body);

    for (let attempt = 0; ; attempt++) {
      if (signal?.aborted) throw new APIUserAbortError();

      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeout);
      const onAbort = (): void => controller.abort();
      signal?.addEventListener('abort', onAbort, { once: true });

      let response: Response;
      let bytes: Uint8Array;
      try {
        const init: RequestInit = { method, headers, signal: controller.signal };
        if (payload !== undefined) init.body = payload;
        response = await this.fetchImpl(url, init);
        bytes = new Uint8Array(await response.arrayBuffer());
      } catch (cause) {
        if (signal?.aborted) throw new APIUserAbortError(undefined, { cause });
        const error = timedOut
          ? new APIConnectionTimeoutError(`The request timed out after ${timeout} ms.`, { cause })
          : new APIConnectionError(undefined, { cause });
        // Whether the request reached the API is not known, so only a request that is safe to repeat is sent again.
        if (idempotent && attempt < maxRetries) {
          await sleep(backoffDelay(attempt), signal);
          continue;
        }
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      }

      const standing = standingFromHeaders(response.headers);
      if (standing !== null) this.lastStanding = standing;
      if (response.ok) return { response, body: bytes };

      const text = decoder.decode(bytes);
      const parsed = parseBody(text);
      const error = APIError.fromResponse(response.status, parsed === INVALID_JSON ? text : parsed, response.headers);
      if (attempt < maxRetries && shouldRetry(response.status, idempotent)) {
        const asked = retryAfterMs(response.headers);
        if (asked === undefined || asked <= MAX_RETRY_AFTER) {
          await sleep(asked ?? backoffDelay(attempt), signal);
          continue;
        }
      }
      throw error;
    }
  }

  private buildURL(path: string, query: Record<string, unknown> | undefined): string {
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        if (value.length > 0) params.set(name, value.join(','));
      } else if (value instanceof Date) {
        params.set(name, value.toISOString());
      } else {
        params.set(name, String(value));
      }
    }
    const search = params.toString();
    return `${this.baseURL}${path.startsWith('/') ? path : `/${path}`}${search ? `?${search}` : ''}`;
  }

  private buildHeaders(hasBody: boolean, extra: HeadersInput | undefined): Record<string, string> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${this.apiKey}`,
      'user-agent': `enrichednow-js/${VERSION}`,
    };
    if (hasBody) headers['content-type'] = 'application/json';
    for (const source of [this.defaultHeaders, extra ?? {}]) {
      for (const [name, value] of Object.entries(source)) {
        const key = name.toLowerCase();
        if (value === null || value === undefined) delete headers[key];
        else headers[key] = value;
      }
    }
    return headers;
  }
}

const INVALID_JSON = Symbol('invalid JSON');
const decoder = new TextDecoder();

/** The account's standing an answer's headers carry, or `null` when it carries none (an answer not about runs). */
export function standingFromHeaders(headers: Headers): Standing | null {
  if (!headers.has('x-units-limit') && !headers.has('x-ratelimit-limit')) return null;
  const number = (name: string): number | null => {
    const value = headers.get(name);
    if (value === null || !/^-?[0-9]+$/.test(value.trim())) return null;
    return Number(value);
  };
  return {
    unitsLimit: number('x-units-limit'),
    unitsUsed: number('x-units-used'),
    unitsRemaining: number('x-units-remaining'),
    unitsTopup: number('x-units-topup'),
    unitsReset: headers.get('x-units-reset'),
    runsLimit: number('x-ratelimit-limit'),
    runsRemaining: number('x-ratelimit-remaining'),
    unmetered: headers.get('x-units-unmetered') === 'true',
  };
}

function parseBody(text: string): unknown {
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return INVALID_JSON;
  }
}

function shouldRetry(status: number, idempotent: boolean): boolean {
  // 429 says the request was refused before anything was done, so it is safe to send again whatever the request.
  if (status === 429) return true;
  return idempotent && (status === 408 || status >= 500);
}

/** Exponential backoff with jitter: 0.5 s, 1 s, 2 s, … up to 8 s, each shortened by up to a quarter. */
function backoffDelay(attempt: number): number {
  const delay = Math.min(INITIAL_RETRY_DELAY * 2 ** attempt, MAX_RETRY_DELAY);
  return delay * (1 - Math.random() * 0.25);
}

function readEnv(name: string): string | undefined {
  try {
    const scope = globalThis as {
      process?: { env?: Record<string, string | undefined> };
      Deno?: { env?: { get?: (name: string) => string | undefined } };
    };
    return scope.process?.env?.[name] ?? scope.Deno?.env?.get?.(name) ?? undefined;
  } catch {
    return undefined; // a runtime that does not let the environment be read
  }
}
