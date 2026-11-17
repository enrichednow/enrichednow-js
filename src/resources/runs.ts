import { DEFAULT_POLL_INTERVAL, DEFAULT_RUN_TIMEOUT, sleep } from '../internal';
import type { EnrichedNow, RequestOptions } from '../client';
import { RunTimeoutError } from '../errors';
import { Page, PagePromise, RecordsPage } from '../pagination';
import type {
  FailedRunStatus,
  JSONObject,
  RecordList,
  RecordListParams,
  Run,
  RunList,
  RunListParams,
  RunStatus,
  TerminalRunStatus,
} from '../types';

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

  /** One run, as it is now. */
  get<TInput = JSONObject>(runId: string, options?: RequestOptions): Promise<Run<TInput>> {
    return this.client.request<Run<TInput>>({ method: 'GET', path: `/v1/runs/${encodeURIComponent(runId)}`, ...options });
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
