import type { EnrichedNow, RequestOptions } from '../client';
import { Page, PagePromise } from '../pagination';
import type {
  Suppression,
  SuppressionEntry,
  SuppressionKind,
  SuppressionList,
  SuppressionListParams,
  SuppressionsAdded,
  SuppressionUpload,
} from '../types';

/**
 * A CSV file for {@link Suppressions.upload}: its text, its bytes, a `Blob` (a `File` is one), or a stream of its
 * pieces (a Node `ReadStream`, a web `ReadableStream`). It is read whole before it is sent: at most 2 MB.
 */
export type CSVInput = string | Uint8Array | ArrayBuffer | Blob | AsyncIterable<Uint8Array | string>;

export interface SuppressionAddOptions extends RequestOptions {
  /** `manual` (the default) or `upload`. */
  source?: 'manual' | 'upload' | undefined;
}

export interface SuppressionUploadOptions extends RequestOptions {
  /**
   * The kind of every value of the first column, for a file without a header row holding `kind` and `value`. Without
   * it, a value is read as an address when it holds `@`, a domain when it looks like one, and a company name otherwise.
   */
  kind?: SuppressionKind | undefined;
}

/**
 * The suppression list: companies (by domain or by name) and addresses that are never sent anywhere. A formula run
 * also leaves them out before any paid step and before its rows are written.
 */
export class Suppressions {
  constructor(private readonly client: EnrichedNow) {}

  /**
   * The list, a page at a time.
   *
   * ```ts
   * for await (const entry of client.suppressions.list({ kind: 'domain' })) console.log(entry.value);
   * ```
   */
  list(params: SuppressionListParams = {}, options?: RequestOptions): PagePromise<Suppression> {
    const { kind, limit } = params;
    const fetchPage = async (cursor: string | undefined): Promise<Page<Suppression>> => {
      const body = await this.client.request<SuppressionList>({
        method: 'GET',
        path: '/v1/suppressions',
        query: { kind, limit, cursor },
        ...options,
      });
      return new Page(body.suppressions, body.next_cursor, fetchPage);
    };
    return new PagePromise(() => fetchPage(params.cursor));
  }

  /**
   * Add entries, up to 10 000 at a time. A domain is kept as its bare host (`https://www.acme.com/` is `acme.com`), a
   * company name in the form formulas match it (`Acme, Inc.` is `acme`). Returns how many were new to the list.
   *
   * ```ts
   * await client.suppressions.add([{ kind: 'domain', value: 'acme.com' }, { kind: 'email', value: 'ana@initech.example' }]);
   * ```
   */
  async add(entries: SuppressionEntry[], options: SuppressionAddOptions = {}): Promise<number> {
    const { source, ...request } = options;
    const body = await this.client.request<SuppressionsAdded>({
      method: 'POST',
      path: '/v1/suppressions',
      body: source === undefined ? { entries } : { entries, source },
      idempotent: true, // an entry the list already holds is left as it is
      ...request,
    });
    return body.added;
  }

  /**
   * Add a CSV file: at most 2 MB and 50 000 lines. With a header row holding `kind` and `value`, each line says its
   * kind; otherwise every value of the first column is taken as `kind`, or guessed. Entries the list already holds
   * are left as they are; `invalid` gives each line that could not be read, and the rest are added.
   *
   * ```ts
   * import { readFile } from 'node:fs/promises';
   *
   * const { added, already, invalid } = await client.suppressions.upload(await readFile('do-not-contact.csv'));
   * ```
   *
   * Not sent again after a connection error, a timeout or a `5xx`; sending the same file twice adds nothing new.
   */
  async upload(csv: CSVInput, options: SuppressionUploadOptions = {}): Promise<SuppressionUpload> {
    const { kind, ...request } = options;
    return this.client.request<SuppressionUpload>({
      method: 'POST',
      path: '/v1/suppressions/upload',
      query: { kind },
      rawBody: await readCSV(csv),
      ...request,
      headers: { 'content-type': 'text/csv', ...request.headers },
    });
  }

  /** Remove one entry. The value is matched as the list keeps it: `acme.com` for a domain, `acme` for `Acme, Inc.`. */
  async delete(kind: SuppressionKind, value: string, options?: RequestOptions): Promise<void> {
    await this.client.request<void>({
      method: 'DELETE',
      path: `/v1/suppressions/${encodeURIComponent(kind)}/${encodeURIComponent(value)}`,
      idempotent: true, // removing twice is removing once
      ...options,
    });
  }
}

/** The file as text or bytes, read whole, so that it can be sent again on a retry. */
async function readCSV(csv: CSVInput): Promise<string | Uint8Array> {
  if (typeof csv === 'string' || csv instanceof Uint8Array) return csv;
  if (csv instanceof ArrayBuffer) return new Uint8Array(csv);
  if (typeof Blob !== 'undefined' && csv instanceof Blob) return new Uint8Array(await csv.arrayBuffer());
  if (typeof (csv as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const encoder = new TextEncoder();
    const pieces: Uint8Array[] = [];
    for await (const piece of csv as AsyncIterable<Uint8Array | string>) {
      pieces.push(typeof piece === 'string' ? encoder.encode(piece) : piece);
    }
    const whole = new Uint8Array(pieces.reduce((size, piece) => size + piece.length, 0));
    let at = 0;
    for (const piece of pieces) {
      whole.set(piece, at);
      at += piece.length;
    }
    return whole;
  }
  throw new TypeError('csv must be text, bytes, a Blob or a stream of pieces.');
}
