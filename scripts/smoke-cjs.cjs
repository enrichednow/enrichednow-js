// Checks that the built package can be required as CommonJS, by its own name (through the `exports` map).
// Run `pnpm build` first.
const assert = require('node:assert/strict');

const sdk = require('enrichednow');
const { EnrichedNow, APIError, PagePromise, RunFailedError, VERSION } = sdk;

assert.equal(sdk.default, EnrichedNow);
assert.equal(typeof VERSION, 'string');
assert.ok(RunFailedError.prototype instanceof Error);
assert.ok(APIError.prototype instanceof Error);

const calls = [];
const client = new EnrichedNow({
  apiKey: 'en_live_smoke',
  fetch: async (url, init) => {
    calls.push([url, init.headers['user-agent']]);
    return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
  },
});

client.health().then((health) => {
  assert.deepEqual(health, { status: 'ok' });
  assert.deepEqual(calls, [['https://api.enrichednow.com/v1/health', `enrichednow-js/${VERSION}`]]);
  assert.ok(client.runs.records('run_1') instanceof PagePromise);
  console.log(`cjs ok: enrichednow ${VERSION}`);
});
