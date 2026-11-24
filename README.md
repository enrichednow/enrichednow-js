# EnrichedNow JavaScript and TypeScript library

[![CI](https://github.com/enrichednow/enrichednow-js/actions/workflows/ci.yml/badge.svg)](https://github.com/enrichednow/enrichednow-js/actions/workflows/ci.yml)

The official library for the [EnrichedNow API](https://docs.enrichednow.com): run scrapers and formulas, read their
records and rows, and query the job-postings datasets, from Node, Bun, Deno and edge runtimes.

- Zero dependencies. Uses the runtime's own `fetch`.
- Written in TypeScript: every request and response is typed.
- Retries, timeouts, cancellation with `AbortSignal`, and pagination are built in.
- Ships ES modules and CommonJS.

## Install

```bash
npm install enrichednow
# or: pnpm add enrichednow / yarn add enrichednow / bun add enrichednow
```

Needs Node 18 or later (or any runtime with a global `fetch`).

## Quickstart

Create a key in the console under **API keys**, and put it in the environment:

```bash
export ENRICHEDNOW_API_KEY="en_live_..."
```

Then run a scraper and read what it found:

```ts
import EnrichedNow from 'enrichednow';

const client = new EnrichedNow(); // reads ENRICHEDNOW_API_KEY

const { run, records } = await client.scrape('ats.board', {
  board_url: 'https://boards.greenhouse.io/acme',
});

console.log(run.status, run.record_count);

for await (const record of records) {
  console.log(record.title);
}
```

`scrape()` starts a run, waits for it to end, and hands back the run with its records. The records are fetched as
you iterate, page after page; `await records.toArray()` collects them all.

CommonJS works the same way:

```js
const { EnrichedNow } = require('enrichednow');
```

## The client

```ts
const client = new EnrichedNow({
  apiKey: 'en_live_...',                    // default: process.env.ENRICHEDNOW_API_KEY
  baseURL: 'https://api.enrichednow.com',   // the default
  timeout: 60_000,                          // milliseconds for one request; the default
  maxRetries: 2,                            // the default; 0 turns retries off
  fetch: myFetch,                           // default: the global fetch
  defaultHeaders: { 'X-My-App': 'crawler' } // sent with every request
});
```

Without a key — neither the option nor the environment variable — the constructor throws an `EnrichedNowError` that
says so.

Every method takes request options as its last argument:

```ts
await client.runs.get(runId, {
  signal: controller.signal, // cancel it
  timeout: 10_000,           // for this request
  maxRetries: 0,             // for this request
  headers: { 'X-Trace': '1' },
});
```

Keep your key on a server. Code that runs in a browser shows its key to everyone who opens the page.

## Running a scraper

### In one call

```ts
const { run, records } = await client.scrape('careers.company', { domain: 'acme.com' });
const all = await records.toArray();
```

| Option | Default | Meaning |
| --- | --- | --- |
| `wait` | `60` | Seconds the first request stays open for the run to end (0 to 60). |
| `timeout` | `600_000` | Milliseconds to wait for the run to end, in all. |
| `pollInterval` | `2_000` | Milliseconds between two looks at a run that is still going. |
| `throwOnFailure` | `true` | Throw `RunFailedError` when the run ends `failed`, `unsupported` or `cancelled`. |
| `pageSize` | the API's, `100` | Records per page when the records are read (1 to 1000). |
| `webhookUrl` | | An `https` URL that is also told when the run ends. See [Webhooks](#webhooks). |
| `signal`, `maxRetries`, `headers` | | As for every request. |

How a run can end, and what `scrape()` does with it:

| The run ended | `scrape()` |
| --- | --- |
| `ok` | Returns `{ run, records }`. `record_count` `0` is a real answer: the pages were read and nothing was there. |
| `partial` | Returns `{ run, records }`. There are records; `run.reason` says what is missing. |
| `failed`, `unsupported`, `cancelled` | Throws `RunFailedError`, with `status`, `reason` and the `run`. |
| still going after `timeout` | Throws `RunTimeoutError`, with the `run`. The run carries on. |

```ts
import { RunFailedError, RunTimeoutError } from 'enrichednow';

try {
  const { records } = await client.scrape('careers.company', { domain: 'acme.com' });
  console.log(await records.toArray());
} catch (error) {
  if (error instanceof RunFailedError) {
    console.log(error.status, error.reason, error.runId); // 'unsupported' 'render_required' 'run_…'
  } else if (error instanceof RunTimeoutError) {
    const run = await client.runs.wait(error.runId);      // wait on, or client.runs.cancel(error.runId)
  } else {
    throw error;
  }
}
```

To read `status` and `reason` yourself instead of catching, pass `throwOnFailure: false`.

### Step by step

```ts
// Start. With `wait`, the request stays open for up to that many seconds for the run to end.
let run = await client.scrapers.run('ats.board', { board_url: 'https://boards.greenhouse.io/acme' }, { wait: 60 });

// Still queued or running? Wait until it has ended.
if (run.status === 'queued' || run.status === 'running') {
  run = await client.runs.wait(run.id, { timeout: 300_000 });
}

// Read the result.
console.log(run.status, run.reason, run.record_count, run.units);
const records = await client.runs.records(run.id).toArray();
```

`runs.wait()` returns the run whatever its final status; it does not throw for a failed run.

## Formulas

A formula is a ready-made recipe: give it a few parameters and it does the searching, matching and checking, and hands
back a finished, deduplicated list of rows, best first. A run spends units, and never more than its unit cap.

### In one call

```ts
const { run, rows } = await client.runFormula('job-order-hunter', {
  job_titles: ['Java Developer'],
  locations: ['London'],
});

console.log(run.status, run.rows_total, run.units_spent);

for await (const row of rows) {
  console.log(row.score, row.data.company_name, row.data.contact_email);
}
```

`runFormula()` starts a run, waits for it to end, and hands back the run with its rows. The rows are fetched as you
iterate, a thousand a page; `await rows.toArray()` collects them all. The whole run as one file:

```ts
import { writeFile } from 'node:fs/promises';

const result = await client.runFormula('job-order-hunter', params);
await writeFile('job-orders.csv', result.export('csv')); // or 'ndjson'; a CSV has its header row once
```

| Option | Default | Meaning |
| --- | --- | --- |
| `preview` | `false` | At most 10 rows and 50 units, charged as usual; nothing is remembered as delivered. |
| `unitCap` | the formula's | The most the run may spend. At the cap it stops, keeps what it has and ends `partial`. |
| `rowCap` | the formula's | The most rows it may produce. |
| `timeout` | `600_000` | Milliseconds to wait for the run to end, in all. |
| `pollInterval` | `2_000` | Milliseconds between two looks at a run that is still going, when the API answers sooner. |
| `throwOnFailure` | `true` | Throw `FormulaRunFailedError` when the run ends `failed`, `unsupported` or `cancelled`. |
| `fields`, `minScore`, `view` | | Only these columns; only rows scored at least this; `view: 'company'` for one row per company. |
| `pageSize` | `1000` | Rows per page when the rows are read or exported (1 to 1000). |
| `idempotencyKey` | | Names this call so that it can be repeated without a second run. See [Retries](#retries). |
| `signal`, `maxRetries`, `headers` | | As for every request. |

| The run ended | `runFormula()` |
| --- | --- |
| `ok` | Returns `{ run, rows, export }`. |
| `partial` | Returns `{ run, rows, export }`. There are rows; `run.reason` and `run.reasons` say what is missing (`unit_cap_reached`, `contacts_not_connected`, `source_failed:<source>`, …). |
| `failed`, `unsupported`, `cancelled` | Throws `FormulaRunFailedError`, with `status`, `reason` and the `run`. |
| still going after `timeout` | Throws `RunTimeoutError`, with the `run`. The run carries on. |

### Typed parameters

Each formula this version of the library knows has a type for its parameters, and the id picks it: a missing or
misspelt parameter does not compile. A formula without one takes any JSON object, so a formula added after this release
works too.

```ts
import type { JobOrderHunterParams } from 'enrichednow';

const params: JobOrderHunterParams = { job_titles: ['Java Developer'], locations: ['London'], posted_within_days: 2 };
await client.runFormula('job-order-hunter', params);

await client.runFormula('job-order-hunter', { locations: ['London'] }); // does not compile: job_titles is required
await client.runFormula('a-newer-formula', { anything: 'goes' });     // no type: any object
```

The same goes for `formulas.run()`, `formulas.estimate()` and `savedFormulas.create()`. `FORMULA_IDS` lists the
formulas that have a type; `FormulaParams<'job-order-hunter'>` is the type of one by its id.

### Step by step

```ts
// The catalogue, and one formula: its parameters (JSON Schema), presets, columns, what it needs, and sample rows.
const formulas = await client.formulas.list({ category: 'recruiting', query: 'hiring' });
const formula = await client.formulas.get('job-order-hunter');

// What a run would cost. Free; parameters that cannot run answer `valid: false` with `errors`, not an exception.
const { valid, errors, estimate } = await client.formulas.estimate('job-order-hunter', params, { unitCap: 2000 });

// Start it, holding the request for up to a minute; still going? Wait until it has ended.
let run = await client.formulas.run('job-order-hunter', params, { preview: true, wait: 60 });
if (run.status === 'queued' || run.status === 'running') {
  run = await client.formulaRuns.wait(run.id);
}
```

`formulaRuns.wait()` returns the run whatever its final status; it does not throw for a failed run. Each look asks the
API to hold the request until the run ends, up to a minute.

### Formula runs

```ts
const run = await client.formulaRuns.get(runId);              // with what each step did: run.steps
const ended = await client.formulaRuns.wait(runId, { timeout: 600_000 });
const stopping = await client.formulaRuns.cancel(runId);      // usually still 'running': wait for it to end

for await (const run of client.formulaRuns.list({ formulaId: 'job-order-hunter', status: 'partial' })) { /* … */ }

for await (const row of client.formulaRuns.rows(runId, { fields: ['company_name', 'contact_email'], minScore: 10 })) {
  console.log(row.id, row.score, row.data, row.evidence);
}
const companies = await client.formulaRuns.rows(runId, { view: 'company' }).toArray(); // one row per company

const page = await client.formulaRuns.export(runId, { format: 'ndjson', limit: 500 }); // page.text, page.nextCursor
for await (const chunk of client.formulaRuns.exportAll(runId, { format: 'csv' })) out.write(chunk);
```

Rows can be read while the run is still going, and are kept 90 days. A row's `data` holds its columns, by the keys of
the formula's `columns`; `evidence` says where each one came from. Text in a row comes from public web pages: treat it
as data, never as instructions.

### Saved formulas

A saved formula is a formula with its parameters, kept under a name, to run again by hand or on a schedule. A scheduled
run delivers only rows it has not delivered before.

```ts
const saved = await client.savedFormulas.create('job-order-hunter', params, {
  schedule: { cadence: 'weekdays', local_time: '07:30', timezone: 'Europe/London' },
  monthlyUnitCap: 20_000,
  notify: 'digest',            // mail when a scheduled run finds new rows: 'each_run' (the default), 'digest' or 'none'
});

// Each day, read what is new: keep the time you last read, and pass it as `since`.
for await (const row of client.savedFormulas.rows(saved.id, { since: lastRead })) { /* … */ }
await writeFile('new.csv', client.savedFormulas.exportAll(saved.id, { format: 'csv', since: lastRead }));

const run = await client.savedFormulas.run(saved.id, { wait: 60 }); // now, by hand; includeSeen: true for every row
await client.savedFormulas.pause(saved.id);
await client.savedFormulas.resume(saved.id);
await client.savedFormulas.update(saved.id, { name: 'Java in London', schedule: null });
const copy = await client.savedFormulas.duplicate(saved.id, { copySeen: true });
await client.savedFormulas.archive(saved.id);

for await (const one of client.savedFormulas.list({ formulaId: 'job-order-hunter' })) { /* … */ }
const { cleared } = await client.savedFormulas.resetSeen(saved.id); // deliver everything again; owners and admins
const history = await client.savedFormulas.snapshots(saved.id, { entityKey: 'https://example.com/jobs/1' });
const { schedules, schedules_active, min_interval_minutes } = await client.savedFormulas.limits();
```

`schedule.cadence` is `hourly`, `daily`, `weekdays`, `weekly` (with `day_of_week`, 0 is Monday) or `monthly` (with
`day_of_month`); `local_time` is `HH:MM` in `timezone`, an IANA time zone. `update()` changes only what it is given,
and `null` removes:

| `update()` | `undefined`, or left out | `null` |
| --- | --- | --- |
| `schedule` | kept | the schedule is removed |
| `monthlyUnitCap` | kept | the monthly cap is removed |
| `name` | kept | back to a name made from the parameters, which follows them |

An update with nothing in it throws a `TypeError` before anything is sent. To give `params` its formula's type, name
the formula: `client.savedFormulas.update<'job-order-hunter'>(saved.id, { params })`.

### Suppressions

Companies (by domain or by name) and addresses on the suppression list are left out of every formula run, before any
paid step, and never sent anywhere.

```ts
import { readFile } from 'node:fs/promises';

const added = await client.suppressions.add([
  { kind: 'domain', value: 'our-client.example' },
  { kind: 'email', value: 'ana@initech.example' },
  { kind: 'company_name', value: 'Umbrella, Inc.' },
]);

// A CSV file: with a `kind,value` header, or one column of values (pass `kind`, or each is guessed).
const { added: fromFile, already, invalid } = await client.suppressions.upload(await readFile('do-not-contact.csv'));

for await (const entry of client.suppressions.list({ kind: 'domain' })) console.log(entry.value);
await client.suppressions.delete('domain', 'our-client.example');
```

`upload()` takes the file's text, its bytes, a `Blob`, or a stream of its pieces (`fs.createReadStream(path)`).

### Row feedback, and the terms some formulas need

```ts
await client.formulaRows.feedback(row.id, 'wrong_company', { correctDomain: 'corvid.example' });
// 'good', 'wrong_company', 'wrong_contact' or 'not_relevant'

const attestations = await client.attestations.list(); // [{ kind: 'personal_data', accepted: true, … }]
```

`wrong_company` also corrects the match: this account's runs match that company to `correctDomain` from now on. A
formula that returns people (`needs_attestation` on the formula) runs only once an owner or an admin of the account has
accepted its terms, in the console; a key cannot accept them. Until then its runs throw `AttestationRequiredError`.

## Resources

### Scrapers

```ts
const scrapers = await client.scrapers.list();        // Scraper[] — the catalogue
const scraper = await client.scrapers.get('ats.board'); // with input_schema and record_schema (JSON Schema)
const run = await client.scrapers.run('ats.board', input, { wait: 60 });
```

What a scraper costs is `units_per_request` for one billed per request, `units_per_record` (each record) for one
billed per record; `unitCost(scraper)` reads the right one. A run carries the same two, fixed when it started.

```ts
import { unitCost } from 'enrichednow';

console.log(`${scraper.id}: ${unitCost(scraper)} unit(s) a ${scraper.billing_unit}`);
```

### Runs

```ts
const run = await client.runs.get(runId);
const ended = await client.runs.wait(runId, { timeout: 600_000, pollInterval: 2_000 });
const cancelled = await client.runs.cancel(runId);

for await (const run of client.runs.list({ scraper_id: 'careers.company', status: 'partial' })) { /* … */ }

for await (const record of client.runs.records(runId)) { /* … */ }
```

Cancelling is cooperative. A queued run ends `cancelled` at once; a running one is asked to stop and usually still
comes back `running` — follow it with `runs.wait()` to see how it ended.

A run's records are kept for 7 days after the run ended. After that the list is empty and the page's `expired` is
`true`; the run itself stays.

`runs.get(runId, { wait: 120 })` holds the request until the run has ended, up to 300 seconds; so does `wait` on
`scrapers.run`. `runs.list` also takes `api_key_id`, `from` and `to`.

#### CSV and NDJSON, written by the API

```ts
import { createWriteStream } from 'node:fs';

const out = createWriteStream('jobs.csv');
for await (const chunk of client.runs.exportAll(run.id, { format: 'csv' })) out.write(chunk); // the header row once

const page = await client.runs.export(run.id, { format: 'ndjson', limit: 500 }); // page.text, page.nextCursor, page.expired
```

The CSV has a column for each field of the scraper's record schema, in its order; a nested object becomes
`parent.child` columns, a list one cell of JSON, and a cell a spreadsheet would run as a formula starts with an
apostrophe. A file a run made (a screenshot) is `await client.runs.file(run.id, 'screenshot.png')`, as bytes.

### Usage

```ts
const usage = await client.usage.get(); // this calendar month (UTC), a row a day
const byScraper = await client.usage.get({
  from: '2026-11-01',
  to: '2026-11-30',          // a Date works too
  group_by: 'scraper',       // 'day' | 'scraper' | 'product'
  product: 'scrapers',       // 'scrapers' | 'data'
});
console.log(byScraper.total_units, byScraper.allowance_units, byScraper.rows);
```

`usage.unmetered` is `true` for an account with no unit limit.

Every answer about runs carries the account's units and runs in progress in its headers. `client.standing` is the
last one seen; `client.usage.standing()` asks for it:

```ts
const { unitsRemaining, unitsTopup, unitsReset, runsRemaining, unmetered } = await client.usage.standing();
```

### Datasets

Job postings and the companies they belong to. Datasets is a product of its own, by early access: without it these
calls throw `PermissionDeniedError`.

```ts
// Search postings, newest first
for await (const posting of client.data.postings.list({
  title: 'data engineer',
  country: 'US',
  remote: true,
  status: 'open',
  seniority: 'senior',
  posted_from: '2026-11-01',
})) {
  console.log(posting.title, posting.company.name, posting.url);
}

const posting = await client.data.postings.get(postingId);   // with description and history

const companies = await client.data.companies.list({ q: 'acme', ats: 'greenhouse' });
const company = await client.data.companies.get('acme.com'); // any host of the domain will do
const postings = await client.data.companies.postings('acme.com', { status: 'open' });
```

Each record returned costs one data unit, so iterating a whole list costs as many units as the list has records.
Narrow the search, and stop when you have enough:

```ts
// two pages of 200: 400 postings, 400 data units
const first400 = await client.data.postings.list({ title: 'nurse', limit: 200 }).toArray({ maxItems: 400 });
```

### Health

```ts
await client.health(); // { status: 'ok' }
```

### Webhooks

Instead of polling, have a URL of yours told when a run ends. An endpoint is an `https` URL and the events it
wants: `run.succeeded` (the status `ok`), `run.partial`, `run.failed`, `run.unsupported`, `run.cancelled`.

```ts
const endpoint = await client.webhooks.create({
  url: 'https://example.com/hooks/enrichednow',
  events: ['run.succeeded', 'run.partial', 'run.failed'],
  description: 'production',
});
endpoint.secret; // the signing secret (whsec_…) is shown only here: store it

const { endpoints, run_secret_set } = await client.webhooks.list();
await client.webhooks.get(endpoint.id);
await client.webhooks.update(endpoint.id, { enabled: false });  // any of url, events, description, enabled
await client.webhooks.rotateSecret(endpoint.id);                // a new secret; the old one stops at once
await client.webhooks.delete(endpoint.id);

for await (const delivery of client.webhooks.deliveries.list({ status: 'failed' })) { /* the delivery log, newest first */ }
await client.webhooks.deliveries.resend(deliveryId);            // send one again
```

For one run, name a URL when you start it. It is told when that run ends, whichever way it ends, beside your
endpoints. What is sent there is signed with the account's run secret, which you make once:

```ts
const { secret } = await client.webhooks.createRunSecret();     // shown only here
const run = await client.scrapers.run('careers.company', { domain: 'acme.com' }, {
  webhookUrl: 'https://example.com/hooks/run-done',             // scrape() takes it too
});
```

## Receiving a webhook

Anybody who learns your URL can post to it, so check the signature before you act on a request. `verifyWebhook`
and `parseWebhook` need no client and make no request. Give them the body exactly as it arrived, as raw bytes,
before any JSON parsing:

```ts
import express from 'express';
import { WebhookVerificationError, parseWebhook } from 'enrichednow';

const app = express();

app.post('/hooks/enrichednow', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = parseWebhook(
      process.env.ENRICHEDNOW_WEBHOOK_SECRET!,
      req.get('X-Webhook-Timestamp'),
      req.body,                              // a Buffer: the raw bytes
      req.get('X-Webhook-Signature'),
    );
    console.log(event.id, event.type, event.data.run.id, event.data.run.record_count);
    res.sendStatus(204);
  } catch (error) {
    if (!(error instanceof WebhookVerificationError)) throw error;
    res.sendStatus(400);
  }
});
```

| | |
| --- | --- |
| `verifyWebhook(secret, timestamp, body, signature, { toleranceSeconds })` | `true` or `false`. Never throws for what a request can carry. |
| `parseWebhook(secret, timestamp, body, signature, { toleranceSeconds })` | The `WebhookEvent` (`id`, `type`, `created_at`, `data.run`); throws `WebhookVerificationError` for a request that does not verify. |

`body` is a `Buffer`, `Uint8Array` or `ArrayBuffer`; a string is taken as UTF-8. Both compare in constant time and
refuse a timestamp more than 5 minutes from now (`toleranceSeconds`, default `300`).

Both are synchronous. They compute the HMAC with the runtime's own `node:crypto` (Node, Bun, Deno). On an edge
runtime (Cloudflare Workers, Vercel Edge) there is no synchronous HMAC, only Web Crypto's, which is asynchronous:
use `verifyWebhookAsync` and `parseWebhookAsync` there. They take the same arguments, return a promise, and use
`crypto.subtle`, which every runtime has; read the body with `await request.arrayBuffer()`.

```ts
// a Cloudflare Worker
const event = await parseWebhookAsync(env.ENRICHEDNOW_WEBHOOK_SECRET, request.headers.get('X-Webhook-Timestamp'),
  await request.arrayBuffer(), request.headers.get('X-Webhook-Signature'));
```

An event can arrive more than once, and is sent again when you resend a delivery; `event.id` is the same every
time, so use it to ignore a repeat. Answer with a 2xx quickly and do the work afterwards.

### Anything else

```ts
const body = await client.request<MyShape>({ method: 'GET', path: '/v1/runs', query: { limit: 5 } });
```

## Pagination

Every list — `runs.list()`, `runs.records()`, `data.postings.list()`, `data.companies.list()`,
`data.companies.postings()`, `formulaRuns.list()`, `formulaRuns.rows()`, `savedFormulas.list()`,
`savedFormulas.rows()`, `suppressions.list()` — works the same way. Nothing is requested until you use it.

Iterate every item; pages are fetched as they are needed, and a `break` stops fetching:

```ts
for await (const record of client.runs.records(runId, { limit: 1000 })) {
  if (enough(record)) break;
}
```

Collect them:

```ts
const records = await client.runs.records(runId).toArray();
const some = await client.runs.records(runId).toArray({ maxItems: 250 });
```

Or go page by page:

```ts
let page = await client.runs.records(runId, { limit: 100 });
console.log(page.data, page.nextCursor, page.expired);

while (page.hasNextPage()) {
  page = await page.getNextPage();
}

// the same, as a loop over pages
for await (const page of client.runs.records(runId).pages()) {
  console.log(page.data.length);
}
```

A cursor is an opaque string. To resume later, keep `page.nextCursor` and pass it back as `cursor`:

```ts
const next = await client.runs.records(runId, { cursor: savedCursor });
```

## Errors

Two different things can go wrong, and they are reported differently:

- **The request failed** — the API answered with an error, or could not be reached. An `APIError` is thrown.
- **The run failed** — the request worked, and the run ended `failed`, `unsupported` or `cancelled`.
  `scrape()` throws `RunFailedError` and `runFormula()` throws `FormulaRunFailedError`; `runs.get()`, `runs.wait()`,
  `formulaRuns.get()` and `formulaRuns.wait()` return the run for you to read.

```ts
import { APIError, RateLimitError, ValidationError } from 'enrichednow';

try {
  await client.scrapers.run('ats.board', { board: 'https://boards.greenhouse.io/acme' });
} catch (error) {
  if (error instanceof ValidationError) {
    for (const field of error.fields) console.log(field.path, field.message); // input.board_url Field required
  } else if (error instanceof RateLimitError && error.code === 'too_many_runs') {
    console.log(`${error.activeRuns} of ${error.maxConcurrentRuns} runs in progress`);
  } else if (error instanceof APIError) {
    console.log(error.status, error.code, error.message, error.details);
  } else {
    throw error;
  }
}
```

Every `APIError` carries `status`, `code` (the API's stable code — match on this), `message` (a sentence for a
person; its wording can change), `details`, `headers`, `body`, and `requestId` when the response has one.

| Class | HTTP | `code` | Extra |
| --- | --- | --- | --- |
| `AuthenticationError` | 401 | `unauthorized` | |
| `QuotaExceededError` | 402 | `quota_exceeded` | `usedUnits`, `allowanceUnits` |
| `LimitReachedError` | 402 | `limit_reached` | A spend limit set on purpose: `scope` (`account`, `key`, `saved_formula` for a saved formula's monthly cap, or `formula_run`), `keyId`, `savedFormulaId`, `limitUnits`, `usedUnits`, `unitsNeeded`. Extends `QuotaExceededError`. |
| `PermissionDeniedError` | 403 | `forbidden` | `reason` — `email_not_verified` when the account must confirm its email address first |
| `PlanLimitReachedError` | 403 | `plan_limit_reached` | A saved formula asked for more than the plan allows: `limit` (`schedules`, `min_interval_minutes` or `destinations`), `allowed`, `current`, `asked`. Extends `PermissionDeniedError`. |
| `NotFoundError` | 404 | `not_found`, `formula_not_found` | |
| `ConflictError` | 409 | `idempotency_conflict` | The idempotency key was used for a different request; `details.run_id` is the run it started. |
| `AttestationRequiredError` | 409 | `attestation_required` | The formula returns people, and its terms must be accepted in the console first: `kind`, `textVersion`. Extends `ConflictError`, as do the three below. |
| `FormulaUnavailableError` | 409 | `formula_unavailable` | The formula cannot run now: `formulaStatus` (`deprecated`), or `formulaId` and `major` for a saved formula whose version is no longer offered. |
| `RequirementMissingError` | 409 | `requirement_missing` | The account lacks what the formula needs: `missing` (`product:data`, a scraper id). |
| `SavedFormulaArchivedError` | 409 | `saved_formula_archived` | The saved formula is archived: duplicate it to use it again. `savedFormulaId`. |
| `ValidationError` | 422 | `invalid_input`, `unit_cap_too_low` | `fields`: `{ path, message }[]`; `minUnitCap`, the least unit cap the formula takes, for `unit_cap_too_low` |
| `RateLimitError` | 429 | `too_many_runs`, `rate_limited` | `retryAfter` (seconds), `activeRuns`, `maxConcurrentRuns` |
| `ServerError` | 5xx | `internal`, `data_unavailable` | |
| `APIConnectionError` | — | — | The API could not be reached; `cause` has the reason. |
| `APIConnectionTimeoutError` | — | — | The request took longer than `timeout`. Extends `APIConnectionError`. |
| `APIUserAbortError` | — | — | You aborted the request through its `signal`. |

All of these extend `APIError`, which extends `EnrichedNowError`. These errors are not about a request and extend
`EnrichedNowError`:

| Class | When | Carries |
| --- | --- | --- |
| `RunFailedError` | A run ended `failed`, `unsupported` or `cancelled` (thrown by `scrape()`). | `status`, `reason`, `runId`, `run` |
| `FormulaRunFailedError` | A formula run ended `failed`, `unsupported` or `cancelled` (thrown by `runFormula()`). Extends `RunFailedError`. | `status`, `reason`, `runId`, `formulaId`, `run` |
| `RunTimeoutError` | A run was still going after the `timeout` of `scrape()`, `runs.wait()`, `runFormula()` or `formulaRuns.wait()`. | `runId`, `run` (a scraper's run or a formula's) |
| `WebhookVerificationError` | A webhook request did not verify (thrown by `parseWebhook()`). | |

```ts
import { AttestationRequiredError, FormulaRunFailedError, PlanLimitReachedError } from 'enrichednow';

try {
  await client.runFormula('job-order-hunter', params);
} catch (error) {
  if (error instanceof AttestationRequiredError) {
    console.log(`Accept the ${error.kind} terms in the console first (version ${error.textVersion}).`);
  } else if (error instanceof FormulaRunFailedError) {
    console.log(error.status, error.reason, error.run.reasons);
  } else {
    throw error;
  }
}
```

## Retries

A request that fails in a way worth trying again is sent again, up to `maxRetries` times (default 2), with a pause
that doubles each time — 0.5 s, 1 s, 2 s, up to 8 s — shortened at random by up to a quarter.

| What happened | Retried |
| --- | --- |
| The connection failed, or the request timed out | Yes |
| `500`, `503` and other `5xx`; `408` | Yes |
| `429` | Yes, after the seconds in `Retry-After` when the response has the header. A wait of more than a minute is not sat out: the error is thrown, with `retryAfter` on it. |
| `401`, `402`, `403`, `404`, `422` | No. The same request gets the same answer. |

**Starting a run is safe to repeat too.** `scrapers.run()` and `scrape()` send an `Idempotency-Key` with the
request, a new one for each call, so a retry after a connection error, a timeout or a `5xx` gets the run the first
attempt started and never a second one. To make a call of your own repeatable (a job that may be restarted, say),
pass your own key: `client.scrape('ats.board', input, { idempotencyKey: 'import-2026-11-19-acme' })`. For 24 hours
the same key with the same request gives the same run; the same key with a different request throws `ConflictError`.

Starting a formula run is the same: `formulas.run()`, `savedFormulas.run()` and `runFormula()` send an
`Idempotency-Key`, and take `idempotencyKey`. These are safe to repeat as they are, and are retried: an estimate,
cancelling a formula run, changing, pausing, resuming or archiving a saved formula, adding to the suppression list or
removing from it, and row feedback.

`webhooks.create()`, `webhooks.deliveries.resend()`, `savedFormulas.create()`, `savedFormulas.duplicate()`,
`savedFormulas.resetSeen()` and `suppressions.upload()` are the exception: they are not sent again after a connection
error, a timeout or a `5xx`, because a repeat would add a second endpoint or saved formula, or do the work twice.

```ts
const client = new EnrichedNow({ maxRetries: 5 });
await client.runs.get(runId, { maxRetries: 0 });
```

## Timeouts and cancellation

`timeout` is the milliseconds one request may take, each attempt on its own. Past it the request throws
`APIConnectionTimeoutError` (after its retries). A request that starts a run with `wait` is given at least `wait`
plus 30 seconds.

Pass an `AbortSignal` to stop a request, a `runs.wait()`, a `scrape()`, a `formulaRuns.wait()`, a `runFormula()` or
an iteration — including the pauses between attempts and polls. It throws `APIUserAbortError`.

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 30_000);

const { run } = await client.scrape('careers.company', { domain: 'acme.com' }, { signal: controller.signal });
```

Aborting stops the waiting, not the run. To stop the run, call `client.runs.cancel(runId)` (or
`client.formulaRuns.cancel(runId)`).

## TypeScript

Every response type is exported, with the API's own field names:

```ts
import type { Run, Scraper, Posting, Company, Usage, RunStatus, Formula, FormulaRun, FormulaRow, SavedFormula } from 'enrichednow';
```

What a scraper takes and returns depends on the scraper, so runs and records are generic. Records are
`Record<string, unknown>` unless you say what they are:

```ts
interface Job {
  title: string;
  url: string;
  location: { raw: string | null; city: string | null };
}

interface BoardInput {
  board_url: string;
  max_detail_pages?: number;
}

const { run, records } = await client.scrape<Job, BoardInput>('ats.board', {
  board_url: 'https://boards.greenhouse.io/acme',
});

run.input.board_url;                 // string
for await (const job of records) {
  job.title;                         // string
}

const page = await client.runs.records<Job>(run.id); // RecordsPage<Job>
```

Each scraper's `input_schema` and `record_schema` — from `client.scrapers.get(id)` or its page in the docs — say
what the shapes are.

A formula's parameters are typed by its id (see [Typed parameters](#typed-parameters)). Its rows are
`FormulaRow<Record<string, unknown>>` unless you say what their `data` is:

```ts
interface JobOrder {
  company_name: string;
  contact_email: string | null;
}

for await (const row of client.formulaRuns.rows<JobOrder>(run.id)) {
  row.data.contact_email;            // string | null
}

const { rows } = await client.runFormula<'job-order-hunter', JobOrder>('job-order-hunter', params);
```

A formula's `columns` — from `client.formulas.get(id)` — name the keys of `data`.

## Requirements

Node 18+, Bun, Deno, Cloudflare Workers, Vercel Edge and other runtimes with a global `fetch`. For anything else,
pass a `fetch` to the client.

## Development

```bash
pnpm install
pnpm typecheck       # tsc
pnpm test            # vitest
pnpm build           # ES modules, CommonJS and type declarations, into dist/
pnpm smoke           # import and require the built package
pnpm check           # all four
```

The tests run against a mocked `fetch` and make no network calls. The formula tests answer with exchanges recorded
from the API, in `tests/fixtures/formulas/`. `examples/formulas.ts` is type-checked with the rest.

## Licence

MIT. See [LICENSE](LICENSE). To report a security problem, see [SECURITY.md](SECURITY.md).
