import { describe, expect, it } from 'vitest';

import {
  APIConnectionError,
  APIError,
  AuthenticationError,
  EnrichedNowError,
  NotFoundError,
  PermissionDeniedError,
  QuotaExceededError,
  LimitReachedError,
  RateLimitError,
  ServerError,
  ValidationError,
} from '../src';
import { apiError, makeClient, mockFetch } from './helpers';
import type { Handler } from './helpers';

/** The error one call throws, with retries off. */
async function thrownBy(handler: Handler): Promise<APIError> {
  const mock = mockFetch(handler);
  const error = await makeClient(mock.fetch, { maxRetries: 0 })
    .runs.get('run_1')
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(APIError);
  expect(error).toBeInstanceOf(EnrichedNowError);
  expect(error).toBeInstanceOf(Error);
  return error as APIError;
}

describe('errors of the API', () => {
  it('401 unauthorized is an AuthenticationError', async () => {
    const error = await thrownBy(apiError(401, 'unauthorized', 'This API key is not valid.'));
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error).toMatchObject({
      name: 'AuthenticationError',
      status: 401,
      code: 'unauthorized',
      message: 'This API key is not valid.',
      details: {},
    });
    expect(error.body).toEqual({ error: { code: 'unauthorized', message: 'This API key is not valid.', details: {} } });
    expect(error.headers?.get('content-type')).toBe('application/json');
  });

  it('403 forbidden is a PermissionDeniedError, with the reason when there is one', async () => {
    const error = await thrownBy(apiError(403, 'forbidden', 'Confirm your email address first.', { reason: 'email_not_verified' }));
    expect(error).toBeInstanceOf(PermissionDeniedError);
    expect(error).toMatchObject({ status: 403, code: 'forbidden', reason: 'email_not_verified' });

    const plain = await thrownBy(apiError(403, 'forbidden', 'The datasets product is by early access.'));
    expect(plain.reason).toBeUndefined();
  });

  it('404 not_found is a NotFoundError', async () => {
    const error = await thrownBy(apiError(404, 'not_found', "There is no run 'run_1'."));
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ status: 404, code: 'not_found', message: "There is no run 'run_1'." });
  });

  it('422 invalid_input is a ValidationError with its fields', async () => {
    const fields = [
      { path: 'input.board_url', message: 'Field required' },
      { path: 'input.max_detail_pages', message: 'Input should be less than or equal to 200' },
    ];
    const error = await thrownBy(apiError(422, 'invalid_input', 'The input is not valid.', { fields }));
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ status: 422, code: 'invalid_input' });
    expect((error as ValidationError).fields).toEqual(fields);
  });

  it('402 quota_exceeded is a QuotaExceededError with where the account stands', async () => {
    const error = await thrownBy(apiError(402, 'quota_exceeded', "This month's units are used up.", { used_units: 1000, allowance_units: 1000 }));
    expect(error).toBeInstanceOf(QuotaExceededError);
    expect(error).toMatchObject({ status: 402, code: 'quota_exceeded', usedUnits: 1000, allowanceUnits: 1000 });
    expect((error as QuotaExceededError).unitsNeeded).toBeUndefined();
  });

  it('402 quota_exceeded on starting a run says what the run needed and the top-up left', async () => {
    const details = { used_units: 998, allowance_units: 1000, topup_units: 0, units_needed: 5 };
    const error = await thrownBy(apiError(402, 'quota_exceeded', "This month's units are used up.", details));
    expect(error).toMatchObject({ unitsNeeded: 5, topupUnits: 0 });
  });

  it('402 limit_reached is a LimitReachedError, and still a QuotaExceededError for code that catches that', async () => {
    const details = { scope: 'key', key_id: 'key_1', limit_units: 100, used_units: 100, units_needed: 1 };
    const error = await thrownBy(apiError(402, 'limit_reached', "This API key's monthly limit of 100 units is reached.", details));
    expect(error).toBeInstanceOf(LimitReachedError);
    expect(error).toBeInstanceOf(QuotaExceededError);
    expect(error).toMatchObject({ name: 'LimitReachedError', status: 402, code: 'limit_reached', scope: 'key', keyId: 'key_1', limitUnits: 100, usedUnits: 100, unitsNeeded: 1 });
    const account = await thrownBy(apiError(402, 'limit_reached', 'The spend limit is reached.', { scope: 'account', limit_units: 5 }));
    expect(account).toMatchObject({ scope: 'account', keyId: undefined, limitUnits: 5 });
    expect(await thrownBy(apiError(402, 'quota_exceeded', 'Used up.', {}))).not.toBeInstanceOf(LimitReachedError);
  });

  it('429 too_many_runs is a RateLimitError with the run counts', async () => {
    const error = await thrownBy(apiError(429, 'too_many_runs', 'Wait for one to end.', { active_runs: 2, max_concurrent_runs: 2 }));
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error).toMatchObject({ status: 429, code: 'too_many_runs', activeRuns: 2, maxConcurrentRuns: 2, retryAfter: undefined });
  });

  it('429 rate_limited is a RateLimitError with Retry-After in seconds', async () => {
    const error = await thrownBy(apiError(429, 'rate_limited', 'Too many attempts.', {}, { 'Retry-After': '60' }));
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error).toMatchObject({ status: 429, code: 'rate_limited', retryAfter: 60 });
  });

  it('500 internal and 503 data_unavailable are ServerErrors', async () => {
    const internal = await thrownBy(apiError(500, 'internal', 'Something went wrong on our side.'));
    expect(internal).toBeInstanceOf(ServerError);
    expect(internal).toMatchObject({ status: 500, code: 'internal' });

    const unavailable = await thrownBy(apiError(503, 'data_unavailable', 'The data API is not available at the moment.'));
    expect(unavailable).toBeInstanceOf(ServerError);
    expect(unavailable).toMatchObject({ status: 503, code: 'data_unavailable' });
  });

  it('carries the request id when the response has one', async () => {
    const error = await thrownBy(apiError(500, 'internal', 'Broken.', {}, { 'X-Request-Id': 'req_123' }));
    expect(error.requestId).toBe('req_123');
    expect((await thrownBy(apiError(500, 'internal'))).requestId).toBeUndefined();
  });

  it('copes with an error that is not in the API format', async () => {
    const error = await thrownBy(new Response('<html>Bad gateway</html>', { status: 502 }));
    expect(error).toBeInstanceOf(ServerError);
    expect(error).toMatchObject({ status: 502, code: undefined, details: {}, body: '<html>Bad gateway</html>' });
    expect(error.message).toMatch(/502/);

    const other = await thrownBy(new Response('', { status: 418 }));
    expect(other.constructor).toBe(APIError);
    expect(other.status).toBe(418);
  });

  it('a failed connection is an APIConnectionError with its cause', async () => {
    const cause = new TypeError('fetch failed');
    const error = await thrownBy(cause);
    expect(error).toBeInstanceOf(APIConnectionError);
    expect(error.status).toBeUndefined();
    expect(error.cause).toBe(cause);
  });
});
