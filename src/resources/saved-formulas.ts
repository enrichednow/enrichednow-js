import type { EnrichedNow, RequestOptions } from '../client';
import type { FormulaParams } from '../formula-params';
import { EXPORT_PAGE, given } from '../internal';
import { Page, PagePromise } from '../pagination';
import type {
  FormulaNotify,
  FormulaRow,
  FormulaRun,
  JSONObject,
  PlanLimits,
  RowsExport,
  SavedFormula,
  SavedFormulaList,
  SavedFormulaListParams,
  SavedFormulaRowExportParams,
  SavedFormulaRowListParams,
  ScheduleParams,
  SeenReset,
  Snapshot,
  SnapshotList,
  SnapshotListParams,
} from '../types';
import { exportAllPages, exportRows, rowPages, startFormulaRun } from './formulas';
import type { FormulaRunStartOptions } from './formulas';

export interface SavedFormulaCreateOptions extends RequestOptions {
  /** Default: made from its key parameters and the cadence; it then follows them when they change. */
  name?: string | undefined;
  /** When it runs. Default: none; it runs when you run it. */
  schedule?: ScheduleParams | undefined;
  /** The most one run may spend. Default: the formula's. Above it: owners and admins only. */
  unitCap?: number | undefined;
  /** The most rows one run may produce. */
  rowCap?: number | undefined;
  /** The most its runs may spend in a calendar month (UTC); a run is capped to what is left. Default: none. */
  monthlyUnitCap?: number | undefined;
  /** Mail when a scheduled run delivers new rows: `each_run` (the default), `digest` or `none`. */
  notify?: FormulaNotify | undefined;
}

/**
 * A change to a saved formula: only what is given changes. `undefined` (or leaving a field out) keeps it; `null`
 * removes it, where that means something.
 *
 * @typeParam F - The saved formula's formula id, for `params` to have that formula's type.
 */
export interface SavedFormulaChange<F extends string = string> {
  /** A new name. `null`: back to a name made from the parameters, which follows them. */
  name?: string | null | undefined;
  /** The whole set of parameters: what is left out takes the formula's default. */
  params?: FormulaParams<F> | undefined;
  /** With new `params`: forget what was delivered, so rows already delivered come again. Owners and admins only. */
  resetSeen?: boolean | undefined;
  unitCap?: number | undefined;
  rowCap?: number | undefined;
  /** `null` removes the monthly cap. */
  monthlyUnitCap?: number | null | undefined;
  /** `null` removes the schedule. */
  schedule?: ScheduleParams | null | undefined;
  notify?: FormulaNotify | undefined;
}

export interface SavedFormulaDuplicateOptions extends RequestOptions {
  /** The copy's name. Default: made from its parameters. */
  name?: string | undefined;
  /** Start with what the original delivered, so the copy does not deliver it again. Default: the copy starts empty. */
  copySeen?: boolean | undefined;
  /** The copy's schedule. Default: none. */
  schedule?: ScheduleParams | undefined;
}

export interface SavedFormulaRunOptions extends Omit<FormulaRunStartOptions, 'unitCap' | 'rowCap'> {
  /** Deliver rows already delivered too. They are still remembered. */
  includeSeen?: boolean | undefined;
}

/**
 * Saved formulas: a formula with its parameters, kept under a name, to run again by hand or on a schedule. A
 * scheduled run delivers only rows it has not delivered before; poll them with {@link SavedFormulas.rows} and `since`.
 */
export class SavedFormulas {
  constructor(private readonly client: EnrichedNow) {}

  /**
   * Save a formula, with a schedule or without.
   *
   * ```ts
   * const saved = await client.savedFormulas.create('job-order-hunter', { job_titles: ['Java Developer'], locations: ['London'] }, {
   *   schedule: { cadence: 'weekdays', local_time: '07:30', timezone: 'Europe/London' },
   *   notify: 'digest',
   * });
   * ```
   *
   * Like adding a webhook endpoint, this request is not sent again after a connection error, a timeout or a `5xx`:
   * the saved formula may exist. Look at `client.savedFormulas.list()` before saving it again.
   *
   * @typeParam F - The formula's id. For a formula this library knows, `params` has its own type.
   */
  create<F extends string>(formulaId: F, params: FormulaParams<F>, options: SavedFormulaCreateOptions = {}): Promise<SavedFormula> {
    const { name, schedule, unitCap, rowCap, monthlyUnitCap, notify, ...request } = options;
    return this.client.request<SavedFormula>({
      method: 'POST',
      path: '/v1/saved-formulas',
      body: {
        formula_id: formulaId,
        params,
        ...given({ name, schedule, unit_cap: unitCap, row_cap: rowCap, monthly_unit_cap: monthlyUnitCap, notify }),
      },
      idempotent: false,
      ...request,
    });
  }

  /**
   * The account's saved formulas, newest first. Archived ones only with `status: 'archived'`.
   *
   * ```ts
   * for await (const saved of client.savedFormulas.list({ formulaId: 'job-order-hunter' })) { ... }
   * ```
   */
  list(params: SavedFormulaListParams = {}, options?: RequestOptions): PagePromise<SavedFormula> {
    const { formulaId, status, limit } = params;
    const query = { formula_id: formulaId, status, limit };
    const fetchPage = async (cursor: string | undefined): Promise<Page<SavedFormula>> => {
      const body = await this.client.request<SavedFormulaList>({
        method: 'GET',
        path: '/v1/saved-formulas',
        query: { ...query, cursor },
        ...options,
      });
      return new Page(body.saved_formulas, body.next_cursor, fetchPage);
    };
    return new PagePromise(() => fetchPage(params.cursor));
  }

  /** One saved formula, with its schedule and next run, its last run, and what its runs spent in the last 30 days. */
  get(savedFormulaId: string, options?: RequestOptions): Promise<SavedFormula> {
    return this.client.request<SavedFormula>({ method: 'GET', path: path(savedFormulaId), ...options });
  }

  /**
   * Change a saved formula. Only what is given changes; `null` removes the schedule (`schedule`), the monthly cap
   * (`monthlyUnitCap`), or a name of your own (`name`: back to one made from the parameters).
   *
   * ```ts
   * await client.savedFormulas.update(saved.id, { name: 'Java in London', monthlyUnitCap: 20_000 });
   * await client.savedFormulas.update(saved.id, { schedule: null });
   * ```
   *
   * @typeParam F - The saved formula's formula id, for `params` to have that formula's type.
   */
  update<F extends string = string>(savedFormulaId: string, change: SavedFormulaChange<F>, options?: RequestOptions): Promise<SavedFormula> {
    const body = given({
      name: change.name,
      params: change.params,
      reset_seen: change.resetSeen,
      unit_cap: change.unitCap,
      row_cap: change.rowCap,
      monthly_unit_cap: change.monthlyUnitCap,
      schedule: change.schedule,
      notify: change.notify,
    });
    if (Object.keys(body).length === 0) {
      return Promise.reject(
        new TypeError('Nothing to change: give at least one of name, params, resetSeen, unitCap, rowCap, monthlyUnitCap, schedule, notify.'),
      );
    }
    return this.client.request<SavedFormula>({
      method: 'PATCH',
      path: path(savedFormulaId),
      body,
      idempotent: true, // the same change twice is the change once
      ...options,
    });
  }

  /** Archive a saved formula: it stops running and can no longer change; its rows stay. Returns it, archived. */
  archive(savedFormulaId: string, options?: RequestOptions): Promise<SavedFormula> {
    return this.client.request<SavedFormula>({
      method: 'DELETE',
      path: path(savedFormulaId),
      idempotent: true, // archiving twice is archiving once
      ...options,
    });
  }

  /**
   * A copy of a saved formula, with the same formula, parameters and caps. Not sent again after a connection error, a
   * timeout or a `5xx`: the copy may exist.
   */
  duplicate(savedFormulaId: string, options: SavedFormulaDuplicateOptions = {}): Promise<SavedFormula> {
    const { name, copySeen, schedule, ...request } = options;
    return this.client.request<SavedFormula>({
      method: 'POST',
      path: `${path(savedFormulaId)}/duplicate`,
      body: given({ name, copy_seen: copySeen, schedule }),
      idempotent: false,
      ...request,
    });
  }

  /**
   * Run a saved formula now, by hand. It delivers only rows it has not delivered before, unless `includeSeen`.
   * `wait` and the `Idempotency-Key` work as on `client.formulas.run()`.
   */
  run(savedFormulaId: string, options: SavedFormulaRunOptions = {}): Promise<FormulaRun> {
    const { preview, includeSeen, ...start } = options;
    return startFormulaRun(this.client, `${path(savedFormulaId)}/runs`, {
      ...(preview ? { mode: 'preview' } : {}),
      ...(includeSeen ? { include_seen: true } : {}),
    }, start);
  }

  /** Pause its schedule. */
  pause(savedFormulaId: string, options?: RequestOptions): Promise<SavedFormula> {
    return this.client.request<SavedFormula>({
      method: 'POST',
      path: `${path(savedFormulaId)}/pause`,
      idempotent: true, // pausing twice is pausing once
      ...options,
    });
  }

  /** Resume its schedule, whatever paused it. */
  resume(savedFormulaId: string, options?: RequestOptions): Promise<SavedFormula> {
    return this.client.request<SavedFormula>({
      method: 'POST',
      path: `${path(savedFormulaId)}/resume`,
      idempotent: true, // resuming twice is resuming once
      ...options,
    });
  }

  /** Forget what it delivered, so its next run delivers those rows again. Owners and admins only. */
  resetSeen(savedFormulaId: string, options?: RequestOptions): Promise<SeenReset> {
    return this.client.request<SeenReset>({ method: 'POST', path: `${path(savedFormulaId)}/seen/reset`, ...options });
  }

  /**
   * Its rows, across its runs, in the order they were written (`order: 'desc'`: newest first). Rows the account's
   * suppression list now holds are left out. To pick up what is new each day, keep the time you last read and pass it
   * as `since`.
   *
   * ```ts
   * for await (const row of client.savedFormulas.rows(saved.id, { since: lastRead })) { ... }
   * ```
   *
   * @typeParam TData - The shape of a row's `data`: the formula's columns.
   */
  rows<TData = JSONObject>(savedFormulaId: string, params: SavedFormulaRowListParams = {}, options?: RequestOptions): PagePromise<FormulaRow<TData>> {
    const { since, order, fields, minScore, limit } = params;
    return rowPages<TData>(this.client, `${path(savedFormulaId)}/rows`, { since, order, fields, min_score: minScore, limit }, params.cursor, options);
  }

  /** One page of its rows written by the API, as `csv` or `ndjson`; {@link SavedFormulas.exportAll} follows the cursor. */
  export(savedFormulaId: string, params: SavedFormulaRowExportParams, options?: RequestOptions): Promise<RowsExport> {
    const { format, since, order, fields, minScore, limit, cursor } = params;
    return exportRows(this.client, `${path(savedFormulaId)}/rows`, format, { since, order, fields, min_score: minScore, limit, cursor }, options);
  }

  /** Every row of it, as `csv` or `ndjson`, page by page: written one after the other, one file (a CSV's header once). */
  async *exportAll(savedFormulaId: string, params: Omit<SavedFormulaRowExportParams, 'cursor'>, options?: RequestOptions): AsyncGenerator<Uint8Array> {
    for await (const piece of exportAllPages((cursor) => this.export(savedFormulaId, { limit: EXPORT_PAGE, ...params, cursor }, options))) {
      yield piece;
    }
  }

  /**
   * For a formula that watches entities (prices, stock, sellers): one entry each time an entity's tracked values
   * changed, newest first. `entityKey` keeps one entity: its history. Kept 13 months.
   */
  async snapshots(savedFormulaId: string, params: SnapshotListParams = {}, options?: RequestOptions): Promise<Snapshot[]> {
    const body = await this.client.request<SnapshotList>({
      method: 'GET',
      path: `${path(savedFormulaId)}/snapshots`,
      query: { entity_key: params.entityKey, limit: params.limit },
      ...options,
    });
    return body.snapshots;
  }

  /** What the account's plan allows of saved formulas: schedules at once, the shortest interval, how long rows are kept. */
  limits(options?: RequestOptions): Promise<PlanLimits> {
    return this.client.request<PlanLimits>({ method: 'GET', path: '/v1/saved-formulas/limits', ...options });
  }
}

function path(savedFormulaId: string): string {
  return `/v1/saved-formulas/${encodeURIComponent(savedFormulaId)}`;
}
