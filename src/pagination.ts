import { EnrichedNowError } from './errors';

type FetchPage<P> = (cursor: string) => Promise<P>;

/**
 * One page of a list.
 *
 * @typeParam T - What the list holds.
 */
export class Page<T> {
  /** The items of this page, in the API's order. */
  readonly data: T[];
  /** The cursor of the page after this one; `null` on the last page. Opaque: pass it back unchanged. */
  readonly nextCursor: string | null;
  private readonly fetchPage!: FetchPage<this>;

  constructor(data: T[], nextCursor: string | null, fetchPage: FetchPage<Page<T>>) {
    this.data = data;
    this.nextCursor = nextCursor;
    // Not enumerable: a page logs and serialises as its data.
    Object.defineProperty(this, 'fetchPage', { value: fetchPage, enumerable: false });
  }

  /** Whether there is a page after this one. */
  hasNextPage(): boolean {
    return this.nextCursor !== null;
  }

  /** Fetch the page after this one. Throws when this is the last page: ask {@link Page.hasNextPage} first. */
  async getNextPage(): Promise<this> {
    if (this.nextCursor === null) {
      throw new EnrichedNowError('There is no next page: this is the last one. Check hasNextPage() first.');
    }
    return this.fetchPage(this.nextCursor);
  }

  /** This page and every page after it, fetched as they are asked for. */
  async *iterPages(): AsyncGenerator<this, void, undefined> {
    let page: this = this;
    yield page;
    while (page.hasNextPage()) {
      page = await page.getNextPage();
      yield page;
    }
  }

  /** The items of this page and of every page after it. */
  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
    for await (const page of this.iterPages()) {
      yield* page.data;
    }
  }
}

/** One page of a run's records. */
export class RecordsPage<T> extends Page<T> {
  /** `true` when the records are gone: they are kept 7 days after the run ended. The page is then empty. */
  readonly expired: boolean;

  constructor(data: T[], nextCursor: string | null, expired: boolean, fetchPage: FetchPage<RecordsPage<T>>) {
    super(data, nextCursor, fetchPage as FetchPage<Page<T>>);
    this.expired = expired;
  }
}

/**
 * A list that has not been fetched yet. Nothing is requested until it is used, in one of two ways:
 *
 * ```ts
 * // every item, page after page
 * for await (const record of client.runs.records(run.id)) { ... }
 *
 * // one page at a time
 * const page = await client.runs.records(run.id, { limit: 1000 });
 * page.data; page.nextCursor; page.hasNextPage(); await page.getNextPage();
 * ```
 *
 * @typeParam T - What the list holds.
 * @typeParam P - The page class.
 */
export class PagePromise<T, P extends Page<T> = Page<T>> implements PromiseLike<P>, AsyncIterable<T> {
  private readonly fetchFirst: () => Promise<P>;
  private first: Promise<P> | undefined;

  constructor(fetchFirst: () => Promise<P>) {
    this.fetchFirst = fetchFirst;
  }

  private firstPage(): Promise<P> {
    return (this.first ??= this.fetchFirst());
  }

  /** Resolves to the first page. */
  then<TResult1 = P, TResult2 = never>(
    onfulfilled?: ((page: P) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.firstPage().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null): Promise<P | TResult> {
    return this.firstPage().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<P> {
    return this.firstPage().finally(onfinally);
  }

  /** Every page, fetched as they are asked for. */
  async *pages(): AsyncGenerator<P, void, undefined> {
    const first = await this.firstPage();
    yield* first.iterPages();
  }

  /** Every item of every page. Stop early with `break`: no further page is fetched. */
  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
    for await (const page of this.pages()) {
      yield* page.data;
    }
  }

  /**
   * Collect the items of every page into one array.
   *
   * @param options.maxItems - Stop once this many items are collected; no further page is fetched after that.
   */
  async toArray(options: { maxItems?: number } = {}): Promise<T[]> {
    const max = options.maxItems ?? Infinity;
    const items: T[] = [];
    if (max <= 0) return items;
    for await (const page of this.pages()) {
      for (const item of page.data) {
        items.push(item);
        if (items.length >= max) return items;
      }
    }
    return items;
  }
}
