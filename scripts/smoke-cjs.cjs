// Checks that the built package can be required as CommonJS, by its own name (through the `exports` map).
// Run `pnpm build` first.
const assert = require('node:assert/strict');

const sdk = require('enrichednow');
const { EnrichedNow, APIError, PagePromise, RunFailedError, VERSION, parseWebhook, verifyWebhook } = sdk;

assert.equal(sdk.default, EnrichedNow);
assert.equal(typeof VERSION, 'string');
assert.ok(RunFailedError.prototype instanceof Error);
assert.ok(APIError.prototype instanceof Error);

// A webhook request signed with Node's own crypto verifies with the built package.
const { createHmac } = require('node:crypto');
const timestamp = String(Math.floor(Date.now() / 1000));
const body = Buffer.from(JSON.stringify({ id: 'evt_smoke', type: 'run.succeeded', data: { run: { id: 'run_1' } } }));
const signature = `v1=${createHmac('sha256', 'whsec_smoke').update(`${timestamp}.`).update(body).digest('hex')}`;
assert.equal(verifyWebhook('whsec_smoke', timestamp, body, signature), true);
assert.equal(verifyWebhook('whsec_other', timestamp, body, signature), false);
assert.equal(parseWebhook('whsec_smoke', timestamp, body, signature).id, 'evt_smoke');

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
  assert.ok(client.webhooks.deliveries.list() instanceof PagePromise);
  console.log(`cjs ok: enrichednow ${VERSION}`);
});
