import type { EnrichedNow, RequestOptions } from '../client';
import type { JSONObject, Run, Scraper, ScraperDetail, ScraperList } from '../types';

/** Above `wait`, how much longer the request itself may take, in milliseconds. */
const WAIT_MARGIN = 30_000;

export interface RunStartOptions extends RequestOptions {
  /**
   * Seconds the request stays open for the run to end, 0 to 300; fractions are accepted. Default 0: the run comes back
   * as soon as it is queued. When the time runs out the run carries on, and comes back `queued` or `running`.
   */
  wait?: number | undefined;
  /**
   * An `https` URL that is sent a signed `POST` when this run ends, whichever way it ends, beside the account's webhook
   * endpoints. Sent to the API as `webhook_url`. The account needs a signing secret for these first:
   * `client.webhooks.createRunSecret()`.
   */
  webhookUrl?: string | undefined;
  /**
   * Names this call so that it can be repeated without starting a second run: for 24 hours the same key with the same
   * request gives the run the first call started. Any text of yours, up to 255 characters, no spaces. Default: a new
   * key for each call, which is what makes its retries safe.
   */
  idempotencyKey?: string | undefined;
}

/**
 * What a scraper costs, a run or a record by its billing unit: `units_per_request` for one billed per request,
 * `units_per_record` (each record) for one billed per record. `1` when the API did not say.
 *
 * ```ts
 * const scraper = await client.scrapers.get('ats.board');
 * console.log(`${unitCost(scraper)} unit(s) a ${scraper.billing_unit}`);
 * ```
 */
export function unitCost(scraper: Pick<Scraper, 'billing_unit' | 'units_per_request' | 'units_per_record'>): number {
  const cost = scraper.billing_unit === 'record' ? scraper.units_per_record : scraper.units_per_request;
  return cost ?? 1;
}

/** A key of our own for one call: a UUID where the runtime makes one, else random hex of the same length. */
function newIdempotencyKey(): string {
  const made = globalThis.crypto?.randomUUID?.();
  if (made) return made;
  let hex = '';
  for (let i = 0; i < 32; i++) hex += Math.floor(Math.random() * 16).toString(16);
  return hex;
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
   * The request carries an `Idempotency-Key`, so it is safe to send again: after a connection error, a timeout or a
   * `5xx` it is retried with the same key, and the API answers with the run the first attempt started, never a
   * second one. Pass {@link RunStartOptions.idempotencyKey} to make a call of yours repeatable across processes.
   *
   * @typeParam TInput - The shape of the scraper's input; its `input_schema` describes it.
   */
  run<TInput extends object = JSONObject>(scraperId: string, input: TInput, options: RunStartOptions = {}): Promise<Run<TInput>> {
    const { wait, webhookUrl, idempotencyKey, ...request } = options;
    return this.client.request<Run<TInput>>({
      method: 'POST',
      path: `/v1/scrapers/${encodeURIComponent(scraperId)}/runs`,
      query: { wait },
      body: webhookUrl === undefined ? { input } : { input, webhook_url: webhookUrl },
      idempotent: true,
      ...request,
      headers: { ...request.headers, 'Idempotency-Key': idempotencyKey ?? newIdempotencyKey() },
      // The request must outlast the time the API is asked to hold it open.
      timeout: request.timeout ?? Math.max(this.client.timeout, (wait ?? 0) * 1000 + WAIT_MARGIN),
    });
  }
}
