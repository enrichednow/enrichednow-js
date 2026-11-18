import type { EnrichedNow, RequestOptions } from '../client';
import { Page, PagePromise } from '../pagination';
import type {
  WebhookDelivery,
  WebhookDeliveryList,
  WebhookDeliveryListParams,
  WebhookEndpoint,
  WebhookEndpointCreateParams,
  WebhookEndpointList,
  WebhookEndpointUpdateParams,
  WebhookEndpointWithSecret,
  WebhookSecret,
} from '../types';

/**
 * Webhooks: the endpoints that are told when a run ends, their signing secrets, and the delivery log.
 *
 * An endpoint is a URL of yours that is sent a signed `POST` when a run ends with one of the events it asked for.
 * Check each request with `verifyWebhook` or `parseWebhook` before acting on it.
 */
export class Webhooks {
  /** The delivery log, and sending a delivery again. */
  readonly deliveries: WebhookDeliveries;

  constructor(private readonly client: EnrichedNow) {
    this.deliveries = new WebhookDeliveries(client);
  }

  /** The account's endpoints, and whether it has a secret for a run's own `webhook_url`. A signing secret is never listed. */
  list(options?: RequestOptions): Promise<WebhookEndpointList> {
    return this.client.request<WebhookEndpointList>({ method: 'GET', path: '/v1/webhooks', ...options });
  }

  /**
   * Add an endpoint. Its signing secret is on the answer, and only there: store it.
   *
   * ```ts
   * const endpoint = await client.webhooks.create({
   *   url: 'https://example.com/hooks/enrichednow',
   *   events: ['run.succeeded', 'run.partial', 'run.failed'],
   * });
   * endpoint.secret; // 'whsec_…'
   * ```
   *
   * Like starting a run, this request is not sent again after a connection error, a timeout or a `5xx`: the endpoint
   * may exist. Look at `client.webhooks.list()` before adding it again.
   */
  create(params: WebhookEndpointCreateParams, options?: RequestOptions): Promise<WebhookEndpointWithSecret> {
    return this.client.request<WebhookEndpointWithSecret>({
      method: 'POST',
      path: '/v1/webhooks',
      body: params,
      idempotent: false,
      ...options,
    });
  }

  /** One endpoint. */
  get(endpointId: string, options?: RequestOptions): Promise<WebhookEndpoint> {
    return this.client.request<WebhookEndpoint>({
      method: 'GET',
      path: `/v1/webhooks/${encodeURIComponent(endpointId)}`,
      ...options,
    });
  }

  /**
   * Change an endpoint. Only what is given changes; give at least one of `url`, `events`, `description`, `enabled`.
   *
   * `enabled: false` switches it off: nothing more is queued for it, and what was waiting is cancelled.
   * `enabled: true` switches it on again, also after it was switched off for failing.
   */
  update(endpointId: string, params: WebhookEndpointUpdateParams, options?: RequestOptions): Promise<WebhookEndpoint> {
    return this.client.request<WebhookEndpoint>({
      method: 'PATCH',
      path: `/v1/webhooks/${encodeURIComponent(endpointId)}`,
      body: params,
      idempotent: true, // the same change twice is the change once
      ...options,
    });
  }

  /** Delete an endpoint. Nothing more is sent to it; what was waiting is cancelled. Its past deliveries stay in the log. */
  async delete(endpointId: string, options?: RequestOptions): Promise<void> {
    await this.client.request<void>({
      method: 'DELETE',
      path: `/v1/webhooks/${encodeURIComponent(endpointId)}`,
      idempotent: true, // deleting twice is deleting once
      ...options,
    });
  }

  /**
   * Replace an endpoint's signing secret. The new one is on the answer, and only there: store it. The old one stops
   * being used at once, for deliveries already queued too.
   */
  rotateSecret(endpointId: string, options?: RequestOptions): Promise<WebhookEndpointWithSecret> {
    return this.client.request<WebhookEndpointWithSecret>({
      method: 'POST',
      path: `/v1/webhooks/${encodeURIComponent(endpointId)}/rotate-secret`,
      idempotent: true, // sent again, the secret that comes back is the one in use, whichever attempt made it
      ...options,
    });
  }

  /**
   * Make, or replace, the secret that signs what is sent to a run's own `webhook_url` (the `webhookUrl` option of
   * `scrapers.run()` and `scrape()`). It is the account's, and it is on the answer only: store it. An account needs
   * one before a run can name a `webhook_url`. Asking again replaces it.
   */
  createRunSecret(options?: RequestOptions): Promise<WebhookSecret> {
    return this.client.request<WebhookSecret>({
      method: 'POST',
      path: '/v1/webhooks/run-secret',
      idempotent: true, // sent again, the secret that comes back is the one in use, whichever attempt made it
      ...options,
    });
  }
}

export class WebhookDeliveries {
  constructor(private readonly client: EnrichedNow) {}

  /**
   * The delivery log, newest first: one row for each event sent to each target, with how its last attempt went.
   * A delivery stays 30 days after it ended.
   *
   * ```ts
   * for await (const delivery of client.webhooks.deliveries.list({ status: 'failed' })) { ... }
   * const page = await client.webhooks.deliveries.list({ endpoint_id: 'whk_…', limit: 50 });
   * ```
   */
  list(params: WebhookDeliveryListParams = {}, options?: RequestOptions): PagePromise<WebhookDelivery> {
    const fetchPage = async (cursor: string | undefined): Promise<Page<WebhookDelivery>> => {
      const body = await this.client.request<WebhookDeliveryList>({
        method: 'GET',
        path: '/v1/webhooks/deliveries',
        query: { ...params, cursor },
        ...options,
      });
      return new Page(body.deliveries, body.next_cursor, fetchPage);
    };
    return new PagePromise(() => fetchPage(params.cursor));
  }

  /**
   * Send a delivery again. The answer is a new delivery of the same event (the same `event_id` and body) to where
   * the endpoint is now, with the full set of attempts.
   *
   * Not for a delivery that is still `pending`, nor for an endpoint that is switched off or deleted. Like starting
   * a run, this request is not sent again after a connection error, a timeout or a `5xx`: the delivery may be queued.
   */
  resend(deliveryId: string, options?: RequestOptions): Promise<WebhookDelivery> {
    return this.client.request<WebhookDelivery>({
      method: 'POST',
      path: `/v1/webhooks/deliveries/${encodeURIComponent(deliveryId)}/resend`,
      idempotent: false,
      ...options,
    });
  }
}
