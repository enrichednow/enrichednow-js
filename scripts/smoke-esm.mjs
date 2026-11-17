// Checks that the built package can be imported as an ES module, by its own name (through the `exports` map).
// Run `pnpm build` first.
import assert from 'node:assert/strict';

import EnrichedNow, { APIError, EnrichedNow as Named, PagePromise, RunFailedError, VERSION } from 'enrichednow';

assert.equal(EnrichedNow, Named);
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
assert.deepEqual(await client.health(), { status: 'ok' });
assert.deepEqual(calls, [['https://api.enrichednow.com/v1/health', `enrichednow-js/${VERSION}`]]);
assert.ok(client.runs.records('run_1') instanceof PagePromise);

console.log(`esm ok: enrichednow ${VERSION}`);
