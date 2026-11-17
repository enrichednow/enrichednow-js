import type { EnrichedNow, RequestOptions } from '../client';
import type { JSONObject, Run, Scraper, ScraperDetail, ScraperList } from '../types';

/** Above `wait`, how much longer the request itself may take, in milliseconds. */
const WAIT_MARGIN = 30_000;

export interface RunStartOptions extends RequestOptions {
  /**
   * Seconds the request stays open for the run to end, 0 to 60; fractions are accepted. Default 0: the run comes back
   * as soon as it is queued. When the time runs out the run carries on, and comes back `queued` or `running`.
   */
  wait?: number | undefined;
}

export class Scrapers {
  constructor(private readonly client: EnrichedNow) {}

  /** The catalogue: every scraper the account can run. */
  async list(options?: RequestOptions): Promise<Scraper[]> {
    const body = await this.client.request<ScraperList>({ method: 'GET', path: '/v1/scrapers', ...options });
    return body.scrapers;
  }

  /** One scraper, with the JSON Schema of its input and of its records. */
  get(scraperId: string, options?: RequestOptions): Promise<ScraperDetail> {
    return this.client.request<ScraperDetail>({
      method: 'GET',
      path: `/v1/scrapers/${encodeURIComponent(scraperId)}`,
      ...options,
    });
  }

  /**
   * Start a run. The run comes back as it is when the request ends: with `wait`, finished if it ended in time;
   * otherwise `queued` or `running` — follow it with `client.runs.wait(run.id)`.
   *
   * Starting a run is not idempotent, so this request is not sent again after a connection error, a timeout or a
   * `5xx`: the first run may exist. Look at `client.runs.list()` before starting it again. It is sent again only
   * after a `429`, which says no run was created.
   *
   * @typeParam TInput - The shape of the scraper's input; its `input_schema` describes it.
   */
  run<TInput extends object = JSONObject>(scraperId: string, input: TInput, options: RunStartOptions = {}): Promise<Run<TInput>> {
    const { wait, ...request } = options;
    return this.client.request<Run<TInput>>({
      method: 'POST',
      path: `/v1/scrapers/${encodeURIComponent(scraperId)}/runs`,
      query: { wait },
      body: { input },
      idempotent: false,
      ...request,
      // The request must outlast the time the API is asked to hold it open.
      timeout: request.timeout ?? Math.max(this.client.timeout, (wait ?? 0) * 1000 + WAIT_MARGIN),
    });
  }
}
