import type { ErrorCode, FailedRunStatus, FieldError, Run } from './types';

/** The base of every error this library throws. */
export class EnrichedNowError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'EnrichedNowError';
  }
}

/** What an {@link APIError} is built from. */
export interface APIErrorInit {
  status?: number | undefined;
  code?: string | undefined;
  details?: Record<string, unknown> | undefined;
  requestId?: string | undefined;
  headers?: Headers | undefined;
  body?: unknown;
  cause?: unknown;
}

/**
 * A request that did not succeed: the API answered with an error, or it could not be reached.
 *
 * Match on {@link APIError.code}; the `message` is a sentence for a person and its wording can change.
 */
export class APIError extends EnrichedNowError {
  /** The HTTP status; `undefined` when no response was received. */
  readonly status: number | undefined;
  /** The API's stable error code, e.g. `invalid_input`; `undefined` when the response carried none. */
  readonly code: ErrorCode | (string & {}) | undefined;
  /** The API's `details` for this error. Always an object; empty for most codes. */
  readonly details: Record<string, unknown>;
  /** The request id of the response (`X-Request-Id`), when the API sent one. */
  readonly requestId: string | undefined;
  /** The response's headers; `undefined` when no response was received. */
  readonly headers: Headers | undefined;
  /** The response's body as it was parsed. */
  readonly body: unknown;

  constructor(message: string, init: APIErrorInit = {}) {
    super(message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = 'APIError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? {};
    this.requestId = init.requestId;
    this.headers = init.headers;
    this.body = init.body;
  }

  /** `details.reason`, when the API gave one: `email_not_verified` for a `forbidden` that waits on the account's email address. */
  get reason(): string | undefined {
    const reason = this.details['reason'];
    return typeof reason === 'string' ? reason : undefined;
  }

  /** The error for a response that is not a success, by its HTTP status. */
  static fromResponse(status: number, body: unknown, headers: Headers): APIError {
    const error = isObject(body) && isObject(body['error']) ? body['error'] : undefined;
    const code = typeof error?.['code'] === 'string' ? error['code'] : undefined;
    const details = isObject(error?.['details']) ? error['details'] : {};
    const message =
      typeof error?.['message'] === 'string' && error['message']
        ? error['message']
        : `The API answered with HTTP status ${status}.`;
    const init: APIErrorInit = {
      status,
      code,
      details,
      headers,
      body,
      requestId: headers.get('x-request-id') ?? undefined,
    };

    if (status === 401) return new AuthenticationError(message, init);
    if (status === 402) return new QuotaExceededError(message, init);
    if (status === 403) return new PermissionDeniedError(message, init);
    if (status === 404) return new NotFoundError(message, init);
    if (status === 409) return new ConflictError(message, init);
    if (status === 400 || status === 422) return new ValidationError(message, init);
    if (status === 429) return new RateLimitError(message, init);
    if (status >= 500) return new ServerError(message, init);
    return new APIError(message, init);
  }
}

/** `401 unauthorized`: the API key is missing, mistyped or revoked. */
export class AuthenticationError extends APIError {
  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'AuthenticationError';
  }
}

/**
 * `403 forbidden`: the account may not do this. For a data request, the account does not have the datasets product;
 * with {@link APIError.reason} `email_not_verified`, the account must confirm its email address first.
 */
export class PermissionDeniedError extends APIError {
  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'PermissionDeniedError';
  }
}

/** `404 not_found`: there is no such scraper, run, posting or company. */
export class NotFoundError extends APIError {
  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'NotFoundError';
  }
}

/**
 * `409 idempotency_conflict`: the idempotency key was already used, in the last 24 hours, for a different request.
 * `details.run_id` is the run that key started.
 */
export class ConflictError extends APIError {
  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'ConflictError';
  }
}

/** `422 invalid_input`: the request does not fit. {@link ValidationError.fields} lists every problem. */
export class ValidationError extends APIError {
  /** One entry per problem, each with the `path` of the field as you wrote it (`input.board_url`, `limit`). */
  readonly fields: FieldError[];

  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'ValidationError';
    const fields = this.details['fields'];
    this.fields = Array.isArray(fields)
      ? fields.filter(isObject).map((field) => ({ path: String(field['path'] ?? ''), message: String(field['message'] ?? '') }))
      : [];
  }
}

/** `402 quota_exceeded`: this month's allowance of the product that was asked is used up. */
export class QuotaExceededError extends APIError {
  /** Units used this month. */
  readonly usedUnits: number | undefined;
  /** The month's allowance. */
  readonly allowanceUnits: number | undefined;

  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'QuotaExceededError';
    this.usedUnits = numberOrUndefined(this.details['used_units']);
    this.allowanceUnits = numberOrUndefined(this.details['allowance_units']);
  }
}

/**
 * `429`: either `too_many_runs` (the account is at its limit of runs going at the same time; wait for one to end)
 * or `rate_limited` (wait {@link RateLimitError.retryAfter} seconds). Tell them apart by {@link APIError.code}.
 */
export class RateLimitError extends APIError {
  /** The seconds the `Retry-After` header asks to wait; `undefined` when the response had none. */
  readonly retryAfter: number | undefined;
  /** For `too_many_runs`: the runs in progress. */
  readonly activeRuns: number | undefined;
  /** For `too_many_runs`: how many runs the account may have going at the same time. */
  readonly maxConcurrentRuns: number | undefined;

  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'RateLimitError';
    const ms = init?.headers ? retryAfterMs(init.headers) : undefined;
    this.retryAfter = ms === undefined ? undefined : ms / 1000;
    this.activeRuns = numberOrUndefined(this.details['active_runs']);
    this.maxConcurrentRuns = numberOrUndefined(this.details['max_concurrent_runs']);
  }
}

/** `5xx`: something went wrong on the API's side (`internal`, or `data_unavailable` for the datasets). */
export class ServerError extends APIError {
  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'ServerError';
  }
}

/** The API could not be reached: the connection failed before a response arrived. */
export class APIConnectionError extends APIError {
  constructor(message = 'The connection to the API failed.', init?: APIErrorInit) {
    super(message, init);
    this.name = 'APIConnectionError';
  }
}

/** The request took longer than its `timeout`. */
export class APIConnectionTimeoutError extends APIConnectionError {
  constructor(message = 'The request timed out.', init?: APIErrorInit) {
    super(message, init);
    this.name = 'APIConnectionTimeoutError';
  }
}

/** The request was aborted through its `AbortSignal`. */
export class APIUserAbortError extends APIError {
  constructor(message = 'The request was aborted.', init?: APIErrorInit) {
    super(message, init);
    this.name = 'APIUserAbortError';
  }
}

/**
 * A run ended `failed`, `unsupported` or `cancelled`. The request itself worked; the scrape did not.
 * {@link RunFailedError.reason} says why, and {@link RunFailedError.run} is the run as it ended.
 */
export class RunFailedError<TInput = Record<string, unknown>> extends EnrichedNowError {
  /** The run as it ended. */
  readonly run: Run<TInput>;
  readonly runId: string;
  /** `failed`, `unsupported` or `cancelled`. */
  readonly status: FailedRunStatus;
  /** The run's stable reason code, e.g. `render_required`, `fetch_failed`, `cancelled`. */
  readonly reason: string | null;

  constructor(run: Run<TInput>) {
    super(`Run ${run.id} of ${run.scraper_id} ended ${run.status}${run.reason ? ` (${run.reason})` : ''}.`);
    this.name = 'RunFailedError';
    this.run = run;
    this.runId = run.id;
    this.status = run.status as FailedRunStatus;
    this.reason = run.reason;
  }
}

/**
 * Waiting for a run took longer than the `timeout` given. The run itself carries on:
 * pick it up again with `client.runs.wait(error.runId)`, or stop it with `client.runs.cancel(error.runId)`.
 */
export class RunTimeoutError<TInput = Record<string, unknown>> extends EnrichedNowError {
  /** The run as it was last seen: still `queued` or `running`. */
  readonly run: Run<TInput>;
  readonly runId: string;

  constructor(run: Run<TInput>, timeoutMs: number) {
    super(`Run ${run.id} was still ${run.status} after ${timeoutMs} ms. It carries on; ask for it again later.`);
    this.name = 'RunTimeoutError';
    this.run = run;
    this.runId = run.id;
  }
}

/**
 * A webhook request did not verify: its signature is not this secret's over this timestamp and body, its timestamp
 * is too far from now, or what was signed is not an event. Thrown by `parseWebhook`. Answer `400` and do nothing
 * with the request.
 */
export class WebhookVerificationError extends EnrichedNowError {
  constructor(message = 'The webhook request did not verify.', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WebhookVerificationError';
  }
}

/** The milliseconds a `Retry-After` header asks to wait (seconds, or an HTTP date); `undefined` when there is none. */
export function retryAfterMs(headers: Headers, now: number = Date.now()): number | undefined {
  const value = headers.get('retry-after');
  if (value === null || value.trim() === '') return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
