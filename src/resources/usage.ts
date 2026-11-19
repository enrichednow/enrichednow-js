import type { EnrichedNow, RequestOptions } from '../client';
import type { Standing, Usage, UsageParams } from '../types';

const NO_STANDING: Standing = {
  unitsLimit: null,
  unitsUsed: null,
  unitsRemaining: null,
  unitsTopup: null,
  unitsReset: null,
  runsLimit: null,
  runsRemaining: null,
  unmetered: false,
};

export class UsageResource {
  constructor(private readonly client: EnrichedNow) {}

  /**
   * Units charged over a period. Default: the current calendar month (UTC) up to today, one row a day.
   * A period is at most 366 days.
   *
   * ```ts
   * const usage = await client.usage.get({ from: '2026-11-01', to: '2026-11-30', group_by: 'scraper' });
   * ```
   */
  get(params: UsageParams = {}, options?: RequestOptions): Promise<Usage> {
    return this.client.request<Usage>({
      method: 'GET',
      path: '/v1/usage',
      query: { ...params, from: dateParam(params.from), to: dateParam(params.to) },
      ...options,
    });
  }

  /**
   * Where the account stands now: the month's units used and left, the top-up units, when the allowance starts
   * again, and runs in progress. Read from the headers of the smallest call that carries them.
   */
  async standing(options?: RequestOptions): Promise<Standing> {
    await this.client.request({ method: 'GET', path: '/v1/runs', query: { limit: 1 }, ...options });
    return this.client.standing ?? NO_STANDING;
  }
}

/** A day as the API reads it: `YYYY-MM-DD`. A `Date` gives its UTC day. */
export function dateParam(value: string | Date | undefined): string | undefined {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}
