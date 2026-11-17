# EnrichedNow JavaScript and TypeScript library

[![CI](https://github.com/enrichednow/enrichednow-js/actions/workflows/ci.yml/badge.svg)](https://github.com/enrichednow/enrichednow-js/actions/workflows/ci.yml)

The official library for the [EnrichedNow API](https://docs.enrichednow.com): run scrapers, read their records, and
query the job-postings datasets, from Node, Bun, Deno and edge runtimes.

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

> **Not on npm yet.** Until the first release is there, build it from this repository:
>
> ```bash
> git clone https://github.com/enrichednow/enrichednow-js && cd enrichednow-js
> pnpm install && pnpm build
> npm install /path/to/enrichednow-js      # in your project
> ```

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

## Resources

### Scrapers

```ts
const scrapers = await client.scrapers.list();        // Scraper[] — the catalogue
const scraper = await client.scrapers.get('ats.board'); // with input_schema and record_schema (JSON Schema)
const run = await client.scrapers.run('ats.board', input, { wait: 60 });
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

### Anything else

```ts
const body = await client.request<MyShape>({ method: 'GET', path: '/v1/runs', query: { limit: 5 } });
```

## Pagination

Every list — `runs.list()`, `runs.records()`, `data.postings.list()`, `data.companies.list()`,
`data.companies.postings()` — works the same way. Nothing is requested until you use it.

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
- **The scrape failed** — the request worked, and the run ended `failed`, `unsupported` or `cancelled`.
  `scrape()` throws `RunFailedError`; `runs.get()` and `runs.wait()` return the run for you to read.

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
| `PermissionDeniedError` | 403 | `forbidden` | `reason` — `email_not_verified` when the account must confirm its email address first |
| `NotFoundError` | 404 | `not_found` | |
| `ValidationError` | 422 | `invalid_input` | `fields`: `{ path, message }[]` |
| `RateLimitError` | 429 | `too_many_runs`, `rate_limited` | `retryAfter` (seconds), `activeRuns`, `maxConcurrentRuns` |
| `ServerError` | 5xx | `internal`, `data_unavailable` | |
| `APIConnectionError` | — | — | The API could not be reached; `cause` has the reason. |
| `APIConnectionTimeoutError` | — | — | The request took longer than `timeout`. Extends `APIConnectionError`. |
| `APIUserAbortError` | — | — | You aborted the request through its `signal`. |

All of these extend `APIError`, which extends `EnrichedNowError`. Two errors are not about a request and extend
`EnrichedNowError` directly:

| Class | When | Carries |
| --- | --- | --- |
| `RunFailedError` | A run ended `failed`, `unsupported` or `cancelled` (thrown by `scrape()`). | `status`, `reason`, `runId`, `run` |
| `RunTimeoutError` | A run was still going after the `timeout` of `scrape()` or `runs.wait()`. | `runId`, `run` |

## Retries

A request that fails in a way worth trying again is sent again, up to `maxRetries` times (default 2), with a pause
that doubles each time — 0.5 s, 1 s, 2 s, up to 8 s — shortened at random by up to a quarter.

| What happened | Retried |
| --- | --- |
| The connection failed, or the request timed out | Yes |
| `500`, `503` and other `5xx`; `408` | Yes |
| `429` | Yes, after the seconds in `Retry-After` when the response has the header. A wait of more than a minute is not sat out: the error is thrown, with `retryAfter` on it. |
| `401`, `402`, `403`, `404`, `422` | No. The same request gets the same answer. |

**Starting a run is the exception.** `scrapers.run()` and `scrape()` do not send the request again after a
connection error, a timeout or a `5xx`: starting a run is not idempotent, and the first run may exist. Look at
`client.runs.list()` before starting it again. Only a `429` is retried, because it says no run was created.

```ts
const client = new EnrichedNow({ maxRetries: 5 });
await client.runs.get(runId, { maxRetries: 0 });
```

## Timeouts and cancellation

`timeout` is the milliseconds one request may take, each attempt on its own. Past it the request throws
`APIConnectionTimeoutError` (after its retries). A request that starts a run with `wait` is given at least `wait`
plus 30 seconds.

Pass an `AbortSignal` to stop a request, a `runs.wait()`, a `scrape()` or an iteration — including the pauses
between attempts and polls. It throws `APIUserAbortError`.

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 30_000);

const { run } = await client.scrape('careers.company', { domain: 'acme.com' }, { signal: controller.signal });
```

Aborting stops the waiting, not the run. To stop the run, call `client.runs.cancel(runId)`.

## TypeScript

Every response type is exported, with the API's own field names:

```ts
import type { Run, Scraper, Posting, Company, Usage, RunStatus } from 'enrichednow';
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

The tests run against a mocked `fetch` and make no network calls.

## Licence

MIT. See [LICENSE](LICENSE). To report a security problem, see [SECURITY.md](SECURITY.md).
