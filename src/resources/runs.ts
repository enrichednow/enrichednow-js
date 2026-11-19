import { DEFAULT_POLL_INTERVAL, DEFAULT_RUN_TIMEOUT, sleep } from '../internal';
import type { EnrichedNow, RequestOptions } from '../client';
import { RunTimeoutError } from '../errors';
import { Page, PagePromise, RecordsPage } from '../pagination';
import type {
  FailedRunStatus,
  JSONObject,
  RecordExportParams,
  RecordFormat,
  RecordList,
  RecordListParams,
  RecordsExport,
  Run,
  RunList,
  RunListParams,
  RunStatus,
  TerminalRunStatus,
} from '../types';

/** Above `wait`, how much longer the request itself may take, in milliseconds. */
const WAIT_MARGIN = 30_000;
/** Records a page when a whole run is exported: the API's largest page. */
const EXPORT_PAGE = 1000;
const FORMATS: readonly RecordFormat[] = ['csv', 'ndjson'];
const ACCEPT: Record<RecordFormat, string> = { csv: 'text/csv', ndjson: 'application/x-ndjson' };
const decoder = new TextDecoder();

export interface RunGetOptions extends RequestOptions {
  /** Seconds the request stays open for the run to end, 0 to 300. Default 0: the run as it is now. */
  wait?: number | undefined;
}

/** A CSV page after the first, without the header row every page starts with (the columns are the same). */
function withoutHeader(body: Uint8Array): Uint8Array {
  const end = body.indexOf(0x0a);
  return end < 0 ? new Uint8Array(0) : body.subarray(end + 1);
}

const TERMINAL: ReadonlySet<RunStatus> = new Set(['ok', 'partial', 'failed', 'unsupported', 'cancelled']);
const FAILED: ReadonlySet<RunStatus> = new Set(['failed', 'unsupported', 'cancelled']);

/** Whether a run with this status has ended. */
export function isTerminalStatus(status: RunStatus): status is TerminalRunStatus {
  return TERMINAL.has(status);
}

/** Whether a run with this status ended without a usable result: `failed`, `unsupported` or `cancelled`. */
export function isFailedStatus(status: RunStatus): status is FailedRunStatus {
  return FAILED.has(status);
}

export interface RunWaitOptions extends Omit<RequestOptions, 'timeout'> {
  /** Milliseconds to wait for the run to end. Default 600 000. Past it, {@link RunTimeoutError} is thrown; the run carries on. */
  timeout?: number | undefined;
  /** Milliseconds between two looks at the run. Default 2 000. */
  pollInterval?: number | undefined;
}

export class Runs {
  constructor(private readonly client: EnrichedNow) {}

  /** One run, as it is now; with `wait`, as it is when it has ended or the time is up. */
  get<TInput = JSONObject>(runId: string, options: RunGetOptions = {}): Promise<Run<TInput>> {
    const { wait, ...request } = options;
    return this.client.request<Run<TInput>>({
      method: 'GET',
      path: `/v1/runs/${encodeURIComponent(runId)}`,
      query: { wait },
      ...request,
      timeout: request.timeout ?? (wait ? Math.max(this.client.timeout, wait * 1000 + WAIT_MARGIN) : undefined),
    });
  }

  /**
   * The account's runs, newest first.
   *
   * ```ts
   * for await (const run of client.runs.list({ status: 'partial' })) { ... }
   * const page = await client.runs.list({ limit: 50 });
   * ```
   */
  list(params: RunListParams = {}, options?: RequestOptions): PagePromise<Run> {
    const fetchPage = async (cursor: string | undefined): Promise<Page<Run>> => {
      const body = await this.client.request<RunList>({
        method: 'GET',
        path: '/v1/runs',
        query: { ...params, cursor },
        ...options,
      });
      return new Page(body.runs, body.next_cursor, fetchPage);
    };
    return new PagePromise(() => fetchPage(params.cursor));
  }

  /**
   * Ask a run to stop. A queued run ends `cancelled` at once; a running one is asked to stop and usually still
   * comes back `running` — follow it with {@link Runs.wait} to see how it ended. A run that has ended is returned
   * unchanged.
   */
  cancel<TInput = JSONObject>(runId: string, options?: RequestOptions): Promise<Run<TInput>> {
    return this.client.request<Run<TInput>>({
      method: 'POST',
      path: `/v1/runs/${encodeURIComponent(runId)}/cancel`,
      idempotent: true, // cancelling twice is cancelling once
      ...options,
    });
  }

  /**
   * Wait until a run has ended, and return it. Whatever the final status, the run is returned: read `status` and
   * `reason`. When the run is still going after `timeout`, {@link RunTimeoutError} is thrown and the run carries on.
   */
  wait<TInput = JSONObject>(runId: string, options: RunWaitOptions = {}): Promise<Run<TInput>> {
    const { timeout = DEFAULT_RUN_TIMEOUT, ...rest } = options;
    return pollRun<TInput>(this.client, runId, { deadline: Date.now() + timeout, timeout, ...rest });
  }

  /**
   * A run's records, in the order the run stored them.
   *
   * ```ts
   * // every record, page after page
   * for await (const record of client.runs.records(run.id)) { ... }
   *
   * // all of them at once
   * const records = await client.runs.records(run.id).toArray();
   *
   * // page by page
   * const page = await client.runs.records(run.id, { limit: 1000 });
   * ```
   *
   * Records are kept 7 days after the run ended; after that the page is empty and its `expired` is `true`.
   *
   * @typeParam TRecord - The shape of one record; the scraper's `record_schema` describes it.
   */
  records<TRecord = JSONObject>(
    runId: string,
    params: RecordListParams = {},
    options?: RequestOptions,
  ): PagePromise<TRecord, RecordsPage<TRecord>> {
    const fetchPage = async (cursor: string | undefined): Promise<RecordsPage<TRecord>> => {
      const body = await this.client.request<RecordList<TRecord>>({
        method: 'GET',
        path: `/v1/runs/${encodeURIComponent(runId)}/records`,
        query: { ...params, cursor },
        ...options,
      });
      return new RecordsPage(body.records, body.next_cursor, body.expired === true, fetchPage);
    };
    return new PagePromise(() => fetchPage(params.cursor));
  }

  /**
   * One page of a run's records written by the API, as `csv` or `ndjson`.
   *
   * The CSV has a column for each field of the scraper's record schema (a nested object becomes `parent.child`, a list
   * one cell of JSON, a cell a spreadsheet would run as a formula starts with an apostrophe), and every page begins
   * with the header row. `nextCursor` continues; {@link Runs.exportAll} follows it for you.
   */
  async export(runId: string, params: RecordExportParams, options?: RequestOptions): Promise<RecordsExport> {
    const { format, limit, cursor } = params;
    if (!FORMATS.includes(format)) throw new TypeError(`format must be one of ${FORMATS.join(', ')}; for JSON use runs.records`);
    const answer = await this.client.requestBytes({
      method: 'GET',
      path: `/v1/runs/${encodeURIComponent(runId)}/records`,
      query: { format, limit, cursor },
      ...options,
      headers: { accept: ACCEPT[format], ...options?.headers },
    });
    return {
      format,
      body: answer.body,
      text: decoder.decode(answer.body),
      nextCursor: answer.headers.get('x-next-cursor') || null,
      expired: answer.headers.get('x-records-expired') === 'true',
    };
  }

  /**
   * Every record of a run, as `csv` or `ndjson`, page by page: write the pieces one after the other and the result is
   * one file (a CSV has its header row once).
   *
   * ```ts
   * const out = fs.createWriteStream('records.csv');
   * for await (const chunk of client.runs.exportAll(run.id, { format: 'csv' })) out.write(chunk);
   * ```
   */
  async *exportAll(runId: string, params: Omit<RecordExportParams, 'cursor'>, options?: RequestOptions): AsyncGenerator<Uint8Array> {
    let cursor: string | undefined;
    for (let first = true; ; first = false) {
      const page = await this.export(runId, { limit: EXPORT_PAGE, ...params, cursor }, options);
      yield first || page.format !== 'csv' ? page.body : withoutHeader(page.body);
      if (!page.nextCursor) return;
      cursor = page.nextCursor;
    }
  }

  /**
   * A file the run produced (a screenshot, say), with this client's key. A record also carries the file's own
   * address, which works without a key for an hour.
   */
  async file(runId: string, name: string, options?: RequestOptions): Promise<Uint8Array> {
    const answer = await this.client.requestBytes({
      method: 'GET',
      path: `/v1/runs/${encodeURIComponent(runId)}/files/${encodeURIComponent(name)}`,
      ...options,
      headers: { accept: '*/*', ...options?.headers },
    });
    return answer.body;
  }
}

interface PollOptions<TInput> extends Omit<RequestOptions, 'timeout'> {
  /** When to give up, as a time (`Date.now()`). */
  deadline: number;
  /** The timeout the caller asked for, for the error's message. */
  timeout: number;
  pollInterval?: number | undefined;
  /** The run as it was last seen, when it was just seen: the first look then comes after a pause. */
  last?: Run<TInput> | undefined;
}

/** Look at a run every `pollInterval` until it has ended or the deadline has passed. */
export async function pollRun<TInput>(client: EnrichedNow, runId: string, options: PollOptions<TInput>): Promise<Run<TInput>> {
  const { deadline, timeout, pollInterval = DEFAULT_POLL_INTERVAL, last, ...request } = options;
  let run = last;
  for (;;) {
    if (run !== undefined) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new RunTimeoutError(run, timeout);
      await sleep(Math.min(pollInterval, remaining), request.signal);
    }
    run = await client.runs.get<TInput>(runId, request);
    if (isTerminalStatus(run.status)) return run;
  }
}
