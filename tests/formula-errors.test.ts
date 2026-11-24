import { describe, expect, it } from 'vitest';

import {
  APIError,
  AttestationRequiredError,
  ConflictError,
  EnrichedNowError,
  FormulaUnavailableError,
  LimitReachedError,
  NotFoundError,
  PermissionDeniedError,
  PlanLimitReachedError,
  QuotaExceededError,
  RequirementMissingError,
  SavedFormulaArchivedError,
  ValidationError,
} from '../src';
import type { EnrichedNow, JobOrderHunterParams } from '../src';
import { apiError, makeClient, mockFetch, replay } from './helpers';

const PARAMS = {
  job_titles: ['Java Developer'],
  locations: ['London'],
  posted_within_days: 2,
  title_exclude_keywords: ['intern'],
  exclude_companies: ['Blocked By Us Inc'],
  company_size: { min: 11, max: 5000 },
} satisfies JobOrderHunterParams;

/**
 * The error a recorded exchange makes a call throw. The call sends the recorded request, and none of these is sent
 * again: the same request gets the same answer.
 */
async function thrownBy(name: string, call: (client: EnrichedNow) => Promise<unknown>): Promise<APIError> {
  const mock = replay(name);
  const error = await call(makeClient(mock.fetch)).catch((e: unknown) => e);
  mock.expectRequests();
  expect(error).toBeInstanceOf(APIError);
  expect(error).toBeInstanceOf(EnrichedNowError);
  const { code, message, details } = (mock.exchanges[0]!.response.body as { error: { code: string; message: string; details: object } }).error;
  expect(error).toMatchObject({ status: mock.exchanges[0]!.response.status, code, message, details });
  return error as APIError;
}

describe('the errors of formulas', () => {
  it('409 attestation_required is an AttestationRequiredError, a ConflictError, with the terms to accept', async () => {
    const error = await thrownBy('error_attestation_required', (client) =>
      client.formulas.run('job-order-hunter', PARAMS, { idempotencyKey: 'c0ffee-attest' }),
    );
    expect(error).toBeInstanceOf(AttestationRequiredError);
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ name: 'AttestationRequiredError', kind: 'personal_data', textVersion: '2026-11-24' });
  });

  it('409 formula_unavailable is a FormulaUnavailableError, with the formula status', async () => {
    const error = await thrownBy('error_formula_unavailable', (client) =>
      client.formulas.run('retired-formula', { terms: ['java'] }, { idempotencyKey: 'c0ffee-retired' }),
    );
    expect(error).toBeInstanceOf(FormulaUnavailableError);
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ name: 'FormulaUnavailableError', status: 409, formulaStatus: 'deprecated', formulaId: undefined, major: undefined });
  });

  it('409 formula_unavailable of a saved formula names the formula and its major version', async () => {
    const mock = mockFetch(apiError(409, 'formula_unavailable', 'No longer offered.', { formula_id: 'job-order-hunter', major: 1 }));
    const error = await makeClient(mock.fetch).savedFormulas.run('sf_1').catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'FormulaUnavailableError', formulaStatus: undefined, formulaId: 'job-order-hunter', major: 1 });
  });

  it('409 requirement_missing is a RequirementMissingError, with what is missing', async () => {
    const error = await thrownBy('error_requirement_missing', (client) =>
      client.formulas.run('data-formula', { terms: ['java'] }, { idempotencyKey: 'c0ffee-data' }),
    );
    expect(error).toBeInstanceOf(RequirementMissingError);
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as RequirementMissingError).missing).toEqual(['product:data']);
  });

  it('409 saved_formula_archived is a SavedFormulaArchivedError', async () => {
    const error = await thrownBy('error_saved_formula_archived', (client) =>
      client.savedFormulas.update('sf_000000000000000000000002', { notify: 'none' }),
    );
    expect(error).toBeInstanceOf(SavedFormulaArchivedError);
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as SavedFormulaArchivedError).savedFormulaId).toBeUndefined(); // this answer names none

    const named = mockFetch(apiError(409, 'saved_formula_archived', 'Archived.', { saved_formula_id: 'sf_1' }));
    const run = await makeClient(named.fetch).savedFormulas.run('sf_1').catch((e: unknown) => e);
    expect(run).toMatchObject({ name: 'SavedFormulaArchivedError', savedFormulaId: 'sf_1' });
  });

  it('409 idempotency_conflict is still a plain ConflictError', async () => {
    const mock = mockFetch(apiError(409, 'idempotency_conflict', 'Used.', { run_id: 'frun_1' }));
    const error = await makeClient(mock.fetch).formulas.run('job-order-hunter', PARAMS, { idempotencyKey: 'k' }).catch((e: unknown) => e);
    expect((error as object).constructor).toBe(ConflictError);
    expect(error).toMatchObject({ name: 'ConflictError', code: 'idempotency_conflict', details: { run_id: 'frun_1' } });
    expect(mock.calls).toHaveLength(1);
  });

  it('403 plan_limit_reached is a PlanLimitReachedError, a PermissionDeniedError, with the limit', async () => {
    const error = await thrownBy('error_plan_limit_reached', (client) =>
      client.savedFormulas.create('posting-watch', { terms: ['java'] }, {
        schedule: { cadence: 'hourly', local_time: '07:30', timezone: 'Europe/London' },
      }),
    );
    expect(error).toBeInstanceOf(PlanLimitReachedError);
    expect(error).toBeInstanceOf(PermissionDeniedError);
    expect(error).toMatchObject({ name: 'PlanLimitReachedError', limit: 'min_interval_minutes', allowed: 1440, asked: 60, current: undefined });

    const schedules = mockFetch(apiError(403, 'plan_limit_reached', 'Three at once.', { limit: 'schedules', allowed: 3, current: 3 }));
    const more = await makeClient(schedules.fetch).savedFormulas.resume('sf_1').catch((e: unknown) => e);
    expect(more).toMatchObject({ limit: 'schedules', allowed: 3, current: 3, asked: undefined });

    const forbidden = mockFetch(apiError(403, 'forbidden', 'No.'));
    const plain = await makeClient(forbidden.fetch).savedFormulas.get('sf_1').catch((e: unknown) => e);
    expect(plain).toBeInstanceOf(PermissionDeniedError);
    expect(plain).not.toBeInstanceOf(PlanLimitReachedError);
  });

  it('402 limit_reached of a saved formula is a LimitReachedError with its scope and the saved formula', async () => {
    const error = await thrownBy('error_limit_reached', (client) =>
      client.savedFormulas.run('sf_000000000000000000000001', { idempotencyKey: 'c0ffee-saved-cap' }),
    );
    expect(error).toBeInstanceOf(LimitReachedError);
    expect(error).toBeInstanceOf(QuotaExceededError);
    expect(error).toMatchObject({
      scope: 'saved_formula',
      savedFormulaId: 'sf_000000000000000000000001',
      keyId: undefined,
      limitUnits: 3,
      usedUnits: 4,
      unitsNeeded: 10,
    });
  });

  it('402 limit_reached with the scope formula_run says what was needed', async () => {
    const mock = mockFetch(apiError(402, 'limit_reached', 'The price changed.', { scope: 'formula_run', units_needed: 5 }));
    const error = await makeClient(mock.fetch).formulaRuns.get('frun_1').catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'LimitReachedError', scope: 'formula_run', unitsNeeded: 5, savedFormulaId: undefined });
  });

  it('404 formula_not_found is a NotFoundError', async () => {
    const error = await thrownBy('error_formula_not_found', (client) => client.formulas.get('no-such-formula'));
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ name: 'NotFoundError', code: 'formula_not_found' });
  });

  it('422 unit_cap_too_low is a ValidationError with the least unit cap', async () => {
    const error = await thrownBy('error_unit_cap_too_low', (client) =>
      client.formulas.run('job-order-hunter', PARAMS, { unitCap: 1, idempotencyKey: 'c0ffee-cap' }),
    );
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ name: 'ValidationError', minUnitCap: 20, fields: [] });
    expect(error.message).toBe('This formula needs a unit cap of at least 20 to return something useful.');
  });

  it('a ValidationError of invalid_input has no least unit cap', async () => {
    const mock = mockFetch(apiError(422, 'invalid_input', 'Not valid.', { fields: [{ path: 'params.job_titles', message: 'This is required.' }] }));
    const error = await makeClient(mock.fetch).formulas.run('job-order-hunter', PARAMS).catch((e: unknown) => e);
    expect(error).toMatchObject({ minUnitCap: undefined, fields: [{ path: 'params.job_titles', message: 'This is required.' }] });
  });
});
