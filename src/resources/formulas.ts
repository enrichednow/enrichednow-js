import type { EnrichedNow, RequestOptions } from '../client';
import { RunTimeoutError } from '../errors';
import type { FormulaParams } from '../formula-params';
import {
  DEFAULT_POLL_INTERVAL,
  DEFAULT_RUN_TIMEOUT,
  EXPORT_ACCEPT,
  EXPORT_FORMATS,
  EXPORT_PAGE,
  given,
  heldTimeout,
  newIdempotencyKey,
  sleep,
  withoutHeader,
} from '../internal';
import { Page, PagePromise } from '../pagination';
import type {
  Attestation,
  AttestationList,
  Formula,
  FormulaDetail,
  FormulaEstimate,
  FormulaList,
  FormulaListParams,
  FormulaRow,
  FormulaRowExportParams,
  FormulaRowList,
  FormulaRowListParams,
  FormulaRun,
  FormulaRunList,
  FormulaRunListParams,
  JSONObject,
  RecordFormat,
  RowFeedback,
  RowVerdict,
  RowsExport,
} from '../types';
import { isTerminalStatus } from './runs';
import type { RunGetOptions, RunWaitOptions } from './runs';

/** The longest a look at a formula run asks the API to hold the request, in seconds. */
const MAX_HOLD = 60;
const decoder = new TextDecoder();

export interface FormulaEstimateOptions extends RequestOptions {
  /** The most the run would be allowed to spend. Default: the formula's. */
  unitCap?: number | undefined;
  /** The most rows it would be allowed to produce. Default: `max_results`, or the formula's. */
  rowCap?: number | undefined;
  /** Estimate a preview: at most 10 rows and 50 units. */
  preview?: boolean | undefined;
}

export interface FormulaRunStartOptions extends RequestOptions {
  /** A preview: at most 10 rows and 50 units, charged as usual; nothing is remembered as delivered. */
  preview?: boolean | undefined;
  /** The most this run may spend. It cannot be overspent: at the cap it stops and ends `partial`. Default: the formula's. */
  unitCap?: number | undefined;
  /** The most rows it may produce. Default: `max_results`, or the formula's. */
  rowCap?: number | undefined;
  /**
   * Seconds the request stays open for the run to end, 0 to 300. Default 0: the run comes back as soon as it is
   * queued. When the time runs out the run carries on, and comes back `queued` or `running`.
   */
  wait?: number | undefined;
  /**
   * Names this call so that it can be repeated without starting a second run: for 24 hours the same key with the same
   * request gives the run the first call started. Default: a new key for each call, which is what makes its retries
   * safe.
   */
  idempotencyKey?: string | undefined;
}

export interface RowFeedbackOptions extends RequestOptions {
  /** A note for yourself and for us, up to 1000 characters. */
  note?: string | undefined;
  /**
   * With `wrong_company`: the company's real domain. This account's runs match the company to it from now on; without
   * it, the company is left unmatched.
   */
  correctDomain?: string | undefined;
}

/**
 * Formulas: ready-made recipes that turn a few parameters into a finished, deduplicated list of rows. The catalogue
 * and each formula's page are free to read; a run spends units, never more than its unit cap.
 */
export class Formulas {
  constructor(private readonly client: EnrichedNow) {}

  /**
   * The catalogue: every formula the account can see. With `query`, the formulas that match it, best first.
   *
   * ```ts
   * const formulas = await client.formulas.list({ query: 'companies hiring Java developers in London' });
   * ```
   */
  async list(params: FormulaListParams = {}, options?: RequestOptions): Promise<Formula[]> {
    const body = await this.client.request<FormulaList>({ method: 'GET', path: '/v1/formulas', query: { ...params }, ...options });
    return body.formulas;
  }

  /** One formula: its parameters as a JSON Schema, presets, columns, what it needs, sample rows and changelog. */
  get(formulaId: string, options?: RequestOptions): Promise<FormulaDetail> {
    return this.client.request<FormulaDetail>({
      method: 'GET',
      path: `/v1/formulas/${encodeURIComponent(formulaId)}`,
      ...options,
    });
  }

  /**
   * What a run with these parameters would cost. Spends nothing. Parameters that cannot run are not an error: the
   * answer has `valid: false` and `errors` says what to change.
   *
   * ```ts
   * const { valid, errors, estimate } = await client.formulas.estimate('job-order-hunter', {
   *   job_titles: ['Java Developer'],
   *   locations: ['London'],
   * });
   * ```
   *
   * @typeParam F - The formula's id. For a formula this library knows, `params` has its own type.
   */
  estimate<F extends string>(formulaId: F, params: FormulaParams<F>, options: FormulaEstimateOptions = {}): Promise<FormulaEstimate> {
    const { unitCap, rowCap, preview, ...request } = options;
    return this.client.request<FormulaEstimate>({
      method: 'POST',
      path: `/v1/formulas/${encodeURIComponent(formulaId)}/estimate`,
      body: { params, ...given({ unit_cap: unitCap, row_cap: rowCap }), ...(preview ? { mode: 'preview' } : {}) },
      idempotent: true, // it spends nothing and changes nothing
      ...request,
    });
  }

  /**
   * Start a run. The run comes back as it is when the request ends: with `wait`, finished if it ended in time;
   * otherwise `queued` or `running` — follow it with `client.formulaRuns.wait(run.id)`, or use `client.runFormula()`,
   * which does both.
   *
   * The request carries an `Idempotency-Key`, so it is safe to send again: after a connection error, a timeout or a
   * `5xx` it is retried with the same key, and the API answers with the run the first attempt started, never a
   * second one.
   *
   * @typeParam F - The formula's id. For a formula this library knows, `params` has its own type.
   */
  run<F extends string>(formulaId: F, params: FormulaParams<F>, options: FormulaRunStartOptions = {}): Promise<FormulaRun> {
    const { preview, unitCap, rowCap, ...start } = options;
    return startFormulaRun(this.client, `/v1/formulas/${encodeURIComponent(formulaId)}/runs`, {
      params,
      ...(preview ? { mode: 'preview' } : {}),
      ...given({ unit_cap: unitCap, row_cap: rowCap }),
    }, start);
  }
}

export class FormulaRuns {
  constructor(private readonly client: EnrichedNow) {}

  /**
   * The account's formula runs, newest first.
   *
   * ```ts
   * for await (const run of client.formulaRuns.list({ formulaId: 'job-order-hunter', status: 'partial' })) { ... }
   * ```
   */
  list(params: FormulaRunListParams = {}, options?: RequestOptions): PagePromise<FormulaRun> {
    const { formulaId, savedFormulaId, status, limit } = params;
    const query = { formula_id: formulaId, saved_formula_id: savedFormulaId, status, limit };
    const fetchPage = async (cursor: string | undefined): Promise<Page<FormulaRun>> => {
      const body = await this.client.request<FormulaRunList>({
        method: 'GET',
        path: '/v1/formula-runs',
        query: { ...query, cursor },
        ...options,
      });
      return new Page(body.runs, body.next_cursor, fetchPage);
    };
    return new PagePromise(() => fetchPage(params.cursor));
  }

  /** One run, with what each step did; with `wait`, as it is when it has ended or the time is up. */
  get(runId: string, options: RunGetOptions = {}): Promise<FormulaRun> {
    const { wait, ...request } = options;
    return this.client.request<FormulaRun>({
      method: 'GET',
      path: `/v1/formula-runs/${encodeURIComponent(runId)}`,
      query: { wait },
      ...request,
      timeout: request.timeout ?? (wait ? heldTimeout(this.client.timeout, wait) : undefined),
    });
  }

  /**
   * Wait until a run has ended, and return it, however it ended. Each look asks the API to hold the request until the
   * run ends, up to a minute. When the run is still going after `timeout`, {@link RunTimeoutError} is thrown, with
   * the run; the run carries on.
   */
  wait(runId: string, options: RunWaitOptions = {}): Promise<FormulaRun> {
    const { timeout = DEFAULT_RUN_TIMEOUT, ...rest } = options;
    return pollFormulaRun(this.client, runId, { deadline: Date.now() + timeout, timeout, ...rest });
  }

  /**
   * A run's rows, best first, readable while the run is still going. Rows are kept 90 days.
   *
   * ```ts
   * for await (const row of client.formulaRuns.rows(run.id, { fields: ['company_name', 'contact_email'], minScore: 10 })) {
   *   console.log(row.data.company_name, row.score);
   * }
   * ```
   *
   * @typeParam TData - The shape of a row's `data`: the formula's columns.
   */
  rows<TData = JSONObject>(runId: string, params: FormulaRowListParams = {}, options?: RequestOptions): PagePromise<FormulaRow<TData>> {
    const { fields, minScore, view, limit } = params;
    return rowPages<TData>(this.client, `/v1/formula-runs/${encodeURIComponent(runId)}/rows`, { fields, min_score: minScore, view, limit }, params.cursor, options);
  }

  /**
   * One page of a run's rows written by the API, as `csv` or `ndjson`. A CSV page begins with the header row.
   * `nextCursor` continues; {@link FormulaRuns.exportAll} follows it for you.
   */
  export(runId: string, params: FormulaRowExportParams, options?: RequestOptions): Promise<RowsExport> {
    const { format, fields, minScore, view, limit, cursor } = params;
    return exportRows(this.client, `/v1/formula-runs/${encodeURIComponent(runId)}/rows`, format, { fields, min_score: minScore, view, limit, cursor }, options);
  }

  /**
   * Every row of a run, as `csv` or `ndjson`, page by page: write the pieces one after the other and the result is one
   * file (a CSV has its header row once).
   *
   * ```ts
   * const out = fs.createWriteStream('rows.csv');
   * for await (const chunk of client.formulaRuns.exportAll(run.id, { format: 'csv' })) out.write(chunk);
   * ```
   */
  async *exportAll(runId: string, params: Omit<FormulaRowExportParams, 'cursor'>, options?: RequestOptions): AsyncGenerator<Uint8Array> {
    for await (const piece of exportAllPages((cursor) => this.export(runId, { limit: EXPORT_PAGE, ...params, cursor }, options))) {
      yield piece;
    }
  }

  /**
   * Ask a run to stop: no new work starts, and calls in flight are asked to stop. Rows already written stay, and what
   * was done stays charged. The answer usually still says `running`; follow it with {@link FormulaRuns.wait}.
   */
  cancel(runId: string, options?: RequestOptions): Promise<FormulaRun> {
    return this.client.request<FormulaRun>({
      method: 'POST',
      path: `/v1/formula-runs/${encodeURIComponent(runId)}/cancel`,
      idempotent: true, // cancelling twice is cancelling once
      ...options,
    });
  }
}

/** Feedback on a formula's rows. */
export class FormulaRows {
  constructor(private readonly client: EnrichedNow) {}

  /**
   * Say what is wrong with a row, or that it is good. One answer a row; a later one replaces it. `wrong_company` also
   * corrects the match for this account's runs from now on. `not_relevant` marks the row `rejected`; the other faults
   * mark it `flagged`.
   */
  feedback(rowId: string, verdict: RowVerdict, options: RowFeedbackOptions = {}): Promise<RowFeedback> {
    const { note, correctDomain, ...request } = options;
    return this.client.request<RowFeedback>({
      method: 'POST',
      path: `/v1/formula-rows/${encodeURIComponent(rowId)}/feedback`,
      body: { verdict, ...given({ note, correct_domain: correctDomain }) },
      idempotent: true, // the same answer twice is the answer once
      ...request,
    });
  }
}

/**
 * The terms some formulas need accepted before they run: those that return people. Accepting them is for an owner or
 * an admin, in the console; a key cannot.
 */
export class Attestations {
  constructor(private readonly client: EnrichedNow) {}

  /** Each kind of terms, its current text, and whether the account accepted that version. */
  async list(options?: RequestOptions): Promise<Attestation[]> {
    const body = await this.client.request<AttestationList>({ method: 'GET', path: '/v1/attestations', ...options });
    return body.attestations;
  }
}

/** Start a formula run, a saved formula's or a formula's, with an `Idempotency-Key` kept across retries. */
export function startFormulaRun(
  client: EnrichedNow,
  path: string,
  body: JSONObject,
  options: Omit<FormulaRunStartOptions, 'preview' | 'unitCap' | 'rowCap'>,
): Promise<FormulaRun> {
  const { wait, idempotencyKey, ...request } = options;
  return client.request<FormulaRun>({
    method: 'POST',
    path,
    query: { wait },
    body,
    idempotent: true,
    ...request,
    headers: { ...request.headers, 'Idempotency-Key': idempotencyKey ?? newIdempotencyKey() },
    // The request must outlast the time the API is asked to hold it open.
    timeout: request.timeout ?? heldTimeout(client.timeout, wait),
  });
}

/** Rows a page at a time, from a run's rows or a saved formula's. `query` is in the API's names. */
export function rowPages<TData>(
  client: EnrichedNow,
  path: string,
  query: Record<string, unknown>,
  cursor: string | undefined,
  options: RequestOptions | undefined,
): PagePromise<FormulaRow<TData>> {
  const fetchPage = async (at: string | undefined): Promise<Page<FormulaRow<TData>>> => {
    const body = await client.request<FormulaRowList<TData>>({ method: 'GET', path, query: { ...query, cursor: at }, ...options });
    return new Page(body.rows, body.next_cursor, fetchPage);
  };
  return new PagePromise(() => fetchPage(cursor));
}

/** One page of rows written by the API. `query` is in the API's names. */
export async function exportRows(
  client: EnrichedNow,
  path: string,
  format: RecordFormat,
  query: Record<string, unknown>,
  options: RequestOptions | undefined,
): Promise<RowsExport> {
  if (!EXPORT_FORMATS.includes(format)) throw new TypeError(`format must be one of ${EXPORT_FORMATS.join(', ')}; for JSON read the rows`);
  const answer = await client.requestBytes({
    method: 'GET',
    path,
    query: { format, ...query },
    ...options,
    headers: { accept: EXPORT_ACCEPT[format], ...options?.headers },
  });
  return { format, body: answer.body, text: decoder.decode(answer.body), nextCursor: answer.headers.get('x-next-cursor') || null };
}

/** Every page `exportPage` gives, following the cursor, as one file: a CSV's header row only once. */
export async function* exportAllPages(exportPage: (cursor: string | undefined) => Promise<RowsExport>): AsyncGenerator<Uint8Array> {
  let cursor: string | undefined;
  for (let first = true; ; first = false) {
    const page = await exportPage(cursor);
    yield first || page.format !== 'csv' ? page.body : withoutHeader(page.body);
    if (!page.nextCursor) return;
    cursor = page.nextCursor;
  }
}

interface PollOptions extends Omit<RequestOptions, 'timeout'> {
  /** When to give up, as a time (`Date.now()`). */
  deadline: number;
  /** The timeout the caller asked for, for the error's message. */
  timeout: number;
  pollInterval?: number | undefined;
  /** The run as it was last seen, when it was just seen. */
  last?: FormulaRun | undefined;
  /** When the request that saw `last` was sent (`Date.now()`). */
  lastSent?: number | undefined;
}

/**
 * Look at a formula run until it has ended or the deadline has passed. Each look asks the API to hold the request until
 * the run ends, up to a minute; an answer that came back sooner than `pollInterval` is followed by a pause for the rest
 * of it, so a server that does not hold the request is not asked in a tight loop.
 */
export async function pollFormulaRun(client: EnrichedNow, runId: string, options: PollOptions): Promise<FormulaRun> {
  const { deadline, timeout, pollInterval = DEFAULT_POLL_INTERVAL, last, lastSent, ...request } = options;
  let run = last;
  let sent = lastSent ?? Date.now();
  for (;;) {
    if (run !== undefined) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new RunTimeoutError<JSONObject, FormulaRun>(run, timeout);
      const pause = pollInterval - (Date.now() - sent);
      if (pause > 0) await sleep(Math.min(pause, remaining), request.signal);
    }
    sent = Date.now();
    const hold = Math.min(MAX_HOLD, Math.max(0, Math.floor((deadline - sent) / 1000)));
    run = await client.formulaRuns.get(runId, { ...request, wait: hold > 0 ? hold : undefined });
    if (isTerminalStatus(run.status)) return run;
  }
}
