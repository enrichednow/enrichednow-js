import type { ErrorCode, FailedRunStatus, FieldError, FormulaRun, JSONObject, Run, RunStatus } from './types';

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
    if (status === 402) return code === 'limit_reached' ? new LimitReachedError(message, init) : new QuotaExceededError(message, init);
    if (status === 403) return code === 'plan_limit_reached' ? new PlanLimitReachedError(message, init) : new PermissionDeniedError(message, init);
    if (status === 404) return new NotFoundError(message, init);
    if (status === 409) return conflictError(code, message, init);
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

/**
 * `403 plan_limit_reached`: what a saved formula asked for is past what the account's plan allows: more schedules at
 * once, a shorter interval between runs, or more destinations. A {@link PermissionDeniedError}.
 */
export class PlanLimitReachedError extends PermissionDeniedError {
  /** Which limit: `schedules`, `min_interval_minutes` or `destinations`. */
  readonly limit: string | undefined;
  /** What the plan allows of it. */
  readonly allowed: number | undefined;
  /** For `schedules` and `destinations`: how many there are now. */
  readonly current: number | undefined;
  /** For `min_interval_minutes`: the interval asked for, in minutes. */
  readonly asked: number | undefined;

  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'PlanLimitReachedError';
    this.limit = stringOrUndefined(this.details['limit']);
    this.allowed = numberOrUndefined(this.details['allowed']);
    this.current = numberOrUndefined(this.details['current']);
    this.asked = numberOrUndefined(this.details['asked']);
  }
}

/** `404 not_found`, or `formula_not_found`: there is no such scraper, run, formula, posting or company. */
export class NotFoundError extends APIError {
  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'NotFoundError';
  }
}

/**
 * `409`: the request conflicts with what is there. With the code `idempotency_conflict`, the idempotency key was
 * already used, in the last 24 hours, for a different request (`details.run_id` is the run that key started). The
 * conflicts of formulas have classes of their own, each a `ConflictError`: {@link AttestationRequiredError},
 * {@link FormulaUnavailableError}, {@link RequirementMissingError} and {@link SavedFormulaArchivedError}.
 */
export class ConflictError extends APIError {
  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'ConflictError';
  }
}

/**
 * `409 attestation_required`: the formula returns people, and an owner or an admin of the account must first accept
 * the terms for it, in the console. A key cannot accept them; `client.attestations.list()` says what is accepted.
 */
export class AttestationRequiredError extends ConflictError {
  /** The terms to accept, e.g. `personal_data`. */
  readonly kind: string | undefined;
  /** The version of their text that must be accepted. */
  readonly textVersion: string | undefined;

  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'AttestationRequiredError';
    this.kind = stringOrUndefined(this.details['kind']);
    this.textVersion = stringOrUndefined(this.details['text_version']);
  }
}

/**
 * `409 formula_unavailable`: the formula cannot be run now: it is deprecated, formulas are not available at the
 * moment, or the version a saved formula was made from is no longer offered.
 */
export class FormulaUnavailableError extends ConflictError {
  /** The formula's status, when that is the reason, e.g. `deprecated`. */
  readonly formulaStatus: string | undefined;
  /** For a saved formula: the formula whose version is no longer offered. */
  readonly formulaId: string | undefined;
  /** For a saved formula: the major version it was made from. */
  readonly major: number | undefined;

  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'FormulaUnavailableError';
    this.formulaStatus = stringOrUndefined(this.details['status']);
    this.formulaId = stringOrUndefined(this.details['formula_id']);
    this.major = numberOrUndefined(this.details['major']);
  }
}

/** `409 requirement_missing`: the formula needs something the account does not have. */
export class RequirementMissingError extends ConflictError {
  /** What is missing: a product (`product:data`), a scraper id, a capability. */
  readonly missing: string[];

  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'RequirementMissingError';
    const missing = this.details['missing'];
    this.missing = Array.isArray(missing) ? missing.map(String) : [];
  }
}

/** `409 saved_formula_archived`: the saved formula is archived: it neither runs nor changes. Duplicate it to use it again. */
export class SavedFormulaArchivedError extends ConflictError {
  /** The saved formula, when the API named it. */
  readonly savedFormulaId: string | undefined;

  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'SavedFormulaArchivedError';
    this.savedFormulaId = stringOrUndefined(this.details['saved_formula_id']);
  }
}

/**
 * `422 invalid_input`: the request does not fit. {@link ValidationError.fields} lists every problem. Also
 * `unit_cap_too_low`: a formula run's unit cap is below the least that returns something useful
 * ({@link ValidationError.minUnitCap}).
 */
export class ValidationError extends APIError {
  /** One entry per problem, each with the `path` of the field as you wrote it (`input.board_url`, `limit`). */
  readonly fields: FieldError[];
  /** For `unit_cap_too_low`: the least unit cap the formula takes. */
  readonly minUnitCap: number | undefined;

  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'ValidationError';
    const fields = this.details['fields'];
    this.fields = Array.isArray(fields)
      ? fields.filter(isObject).map((field) => ({ path: String(field['path'] ?? ''), message: String(field['message'] ?? '') }))
      : [];
    this.minUnitCap = numberOrUndefined(this.details['min_unit_cap']);
  }
}

/** `402 quota_exceeded`: this month's allowance of the product that was asked is used up. */
export class QuotaExceededError extends APIError {
  /** Units used this month. */
  readonly usedUnits: number | undefined;
  /** The month's allowance. */
  readonly allowanceUnits: number | undefined;
  /** When starting a run was refused: the top-up units left (`0`: spent too). */
  readonly topupUnits: number | undefined;
  /** When starting a run was refused: the least the run would have cost, its units a request, or a record for one. */
  readonly unitsNeeded: number | undefined;

  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'QuotaExceededError';
    this.usedUnits = numberOrUndefined(this.details['used_units']);
    this.allowanceUnits = numberOrUndefined(this.details['allowance_units']);
    this.topupUnits = numberOrUndefined(this.details['topup_units']);
    this.unitsNeeded = numberOrUndefined(this.details['units_needed']);
  }
}

/**
 * `402 limit_reached`: the run would go past a spend limit set on purpose: the account's monthly limit (`scope`
 * `'account'`), the API key's (`scope` `'key'`, with `keyId`), or a saved formula's monthly cap (`scope`
 * `'saved_formula'`, with `savedFormulaId`). `scope` `'formula_run'`: a price changed while a formula was running.
 * Units may be left on the plan: raising the limit is what helps. Nothing was created or charged. A
 * {@link QuotaExceededError}, so code that catches that one catches this too.
 */
export class LimitReachedError extends QuotaExceededError {
  /** Whose limit was reached: `'account'`, `'key'`, `'saved_formula'` or `'formula_run'`. */
  readonly scope: 'account' | 'key' | 'saved_formula' | 'formula_run' | (string & {}) | undefined;
  /** The API key whose limit was reached, when `scope` is `'key'`. */
  readonly keyId: string | undefined;
  /** The saved formula whose monthly cap was reached, when `scope` is `'saved_formula'`. */
  readonly savedFormulaId: string | undefined;
  /** The limit, in units a calendar month. */
  readonly limitUnits: number | undefined;

  constructor(message: string, init?: APIErrorInit) {
    super(message, init);
    this.name = 'LimitReachedError';
    this.scope = stringOrUndefined(this.details['scope']);
    this.keyId = stringOrUndefined(this.details['key_id']);
    this.savedFormulaId = stringOrUndefined(this.details['saved_formula_id']);
    this.limitUnits = numberOrUndefined(this.details['limit_units']);
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

/** What the errors about a run read of it: a scraper's run and a formula's both have these. */
export interface RunLike {
  id: string;
  status: RunStatus;
  reason: string | null;
}

/**
 * A run ended `failed`, `unsupported` or `cancelled`. The request itself worked; the run did not.
 * {@link RunFailedError.reason} says why, and {@link RunFailedError.run} is the run as it ended. A formula's run
 * throws its subclass, {@link FormulaRunFailedError}.
 *
 * @typeParam TInput - The scraper's input, as sent.
 * @typeParam TRun - The run: a scraper's {@link Run} unless said otherwise.
 */
export class RunFailedError<TInput = Record<string, unknown>, TRun extends RunLike = Run<TInput>> extends EnrichedNowError {
  /** The run as it ended. */
  readonly run: TRun;
  readonly runId: string;
  /** `failed`, `unsupported` or `cancelled`. */
  readonly status: FailedRunStatus;
  /** The run's stable reason code, e.g. `render_required`, `fetch_failed`, `cancelled`. */
  readonly reason: string | null;

  constructor(run: TRun, message?: string) {
    const of = 'scraper_id' in run ? ` of ${String(run.scraper_id)}` : '';
    super(message ?? `Run ${run.id}${of} ended ${run.status}${run.reason ? ` (${run.reason})` : ''}.`);
    this.name = 'RunFailedError';
    this.run = run;
    this.runId = run.id;
    this.status = run.status as FailedRunStatus;
    this.reason = run.reason;
  }
}

/**
 * A formula run ended `failed`, `unsupported` or `cancelled` (thrown by `runFormula()`). A {@link RunFailedError}, so
 * code that catches that one catches this too. A run that ended `partial` is not one: it has rows.
 */
export class FormulaRunFailedError extends RunFailedError<JSONObject, FormulaRun> {
  /** The formula the run was of. */
  readonly formulaId: string;

  constructor(run: FormulaRun) {
    super(run, `Formula run ${run.id} of ${run.formula_id} ended ${run.status}${run.reason ? ` (${run.reason})` : ''}.`);
    this.name = 'FormulaRunFailedError';
    this.formulaId = run.formula_id;
  }
}

/**
 * Waiting for a run took longer than the `timeout` given. The run itself carries on: pick it up again with
 * `client.runs.wait(error.runId)` (`client.formulaRuns.wait` for a formula run), or stop it with `cancel`.
 *
 * @typeParam TInput - The scraper's input, as sent.
 * @typeParam TRun - The run: a scraper's {@link Run}, or a {@link FormulaRun} when `formulaRuns.wait()` or
 * `runFormula()` threw it.
 */
export class RunTimeoutError<TInput = Record<string, unknown>, TRun extends RunLike = Run<TInput>> extends EnrichedNowError {
  /** The run as it was last seen: still `queued` or `running`. */
  readonly run: TRun;
  readonly runId: string;

  constructor(run: TRun, timeoutMs: number) {
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

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** The error for a `409`, by its code. */
function conflictError(code: string | undefined, message: string, init: APIErrorInit): ConflictError {
  switch (code) {
    case 'attestation_required':
      return new AttestationRequiredError(message, init);
    case 'formula_unavailable':
      return new FormulaUnavailableError(message, init);
    case 'requirement_missing':
      return new RequirementMissingError(message, init);
    case 'saved_formula_archived':
      return new SavedFormulaArchivedError(message, init);
    default:
      return new ConflictError(message, init);
  }
}
