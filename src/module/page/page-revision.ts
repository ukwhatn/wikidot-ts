import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { NoElementError, UnexpectedError, WikidotError } from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { omitFalsy, requireBody } from '../../connector';
import type { AMCRequestBody } from '../../connector/amc-types';
import { parseOdate, parseUser } from '../../util/parser';
import type { AbstractUser } from '../user';
import type { Page } from './page';
import type { PageSource } from './page-source';

/** The 7 change-type flags accepted by history/PageRevisionListModule's
 * `options` JSON. Distinct from changes/SiteChangesListModule's 8
 * (site.tools.getRecentChanges), which adds "new". */
export type HistoryOptionKey = 'all' | 'source' | 'title' | 'move' | 'tags' | 'files' | 'meta';

/**
 * Parse a history/PageRevisionListModule response body into PageRevision objects
 *
 * Shared by PageCollection.acquirePageRevisions (page.ts, the eager
 * full-history fetch behind Page.revisions) and
 * PageRevisionCollection.acquire (filtered/paginated fetch), so the
 * table-row parsing logic lives in one place.
 */
export function parseRevisionListHtml($: cheerio.CheerioAPI, page: Page): PageRevision[] {
  const revisions: PageRevision[] = [];

  $('table.page-history tr[id^="revision-row-"]').each((_j, revElement) => {
    const $rev = $(revElement);
    const revIdAttr = $rev.attr('id');
    if (!revIdAttr) return;

    const revId = Number.parseInt(revIdAttr.replace('revision-row-', ''), 10);
    if (Number.isNaN(revId)) return;

    const $tds = $rev.find('td');
    if ($tds.length < 7) return;

    const revNoText = $tds.eq(0).text().trim().replace(/\.$/, '');
    const revNo = Number.parseInt(revNoText, 10);
    if (Number.isNaN(revNo)) return;

    const $createdByElem = $tds.eq(4).find('span.printuser');
    if ($createdByElem.length === 0) return;
    const createdBy = parseUser(page.site.client, $createdByElem as cheerio.Cheerio<AnyNode>);

    const $createdAtElem = $tds.eq(5).find('span.odate');
    if ($createdAtElem.length === 0) return;
    const createdAt = parseOdate($createdAtElem as cheerio.Cheerio<AnyNode>) ?? new Date();

    const comment = $tds.eq(6).text().trim();

    revisions.push(
      new PageRevision({
        page,
        id: revId,
        revNo,
        createdBy,
        createdAt,
        comment,
      })
    );
  });

  return revisions;
}

/**
 * Page revision data
 */
export interface PageRevisionData {
  page: Page;
  id: number;
  revNo: number;
  createdBy: AbstractUser;
  createdAt: Date;
  comment: string;
}

/**
 * Page revision (version in edit history)
 */
export class PageRevision {
  /** Page this revision belongs to */
  public readonly page: Page;

  /** Revision ID */
  public readonly id: number;

  /** Revision number */
  public readonly revNo: number;

  /** Revision creator */
  public readonly createdBy: AbstractUser;

  /** Revision creation date */
  public readonly createdAt: Date;

  /** Edit comment */
  public readonly comment: string;

  /** Source code (internal cache) */
  private _source: PageSource | null = null;

  /** HTML display (internal cache) */
  private _html: string | null = null;

  constructor(data: PageRevisionData) {
    this.page = data.page;
    this.id = data.id;
    this.revNo = data.revNo;
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt;
    this.comment = data.comment;
  }

  /**
   * Whether source code has been acquired
   */
  isSourceAcquired(): boolean {
    return this._source !== null;
  }

  /**
   * Whether HTML display has been acquired
   */
  isHtmlAcquired(): boolean {
    return this._html !== null;
  }

  /**
   * Get source code (cached)
   */
  get source(): PageSource | null {
    return this._source;
  }

  /**
   * Set source code
   */
  set source(value: PageSource | null) {
    this._source = value;
  }

  /**
   * Get HTML display (cached)
   */
  get html(): string | null {
    return this._html;
  }

  /**
   * Set HTML display
   */
  set html(value: string | null) {
    this._html = value;
  }

  /**
   * Get revision source (REV-001)
   * @returns Source string
   */
  getSource(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        // Return cache if available
        if (this._source) {
          return this._source.wikiText;
        }

        const result = await this.page.site.amcRequest([
          {
            moduleName: 'history/PageSourceModule',
            revision_id: this.id,
          },
        ]);

        if (result.isErr()) {
          throw result.error;
        }

        const response = result.value[0];
        if (!response) {
          throw new NoElementError('Empty response from PageSourceModule');
        }

        const html = requireBody(response, 'history/PageSourceModule');
        const $ = cheerio.load(html);

        // Source code is inside <div class="page-source">
        const sourceElem = $('div.page-source');
        if (sourceElem.length === 0) {
          throw new NoElementError('Source element not found');
        }

        const sourceText = sourceElem.text();
        return sourceText;
      })(),
      (error) => {
        if (error instanceof NoElementError) {
          return error;
        }
        return new UnexpectedError(`Failed to get revision source: ${String(error)}`);
      }
    );
  }

  /**
   * Get revision HTML (REV-002)
   * @returns HTML string
   */
  getHtml(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        // Return cache if available
        if (this._html) {
          return this._html;
        }

        const result = await this.page.site.amcRequest([
          {
            moduleName: 'history/PageVersionModule',
            revision_id: this.id,
          },
        ]);

        if (result.isErr()) {
          throw result.error;
        }

        const response = result.value[0];
        if (!response) {
          throw new NoElementError('Empty response from PageVersionModule');
        }

        const html = requireBody(response, 'history/PageVersionModule');
        const $ = cheerio.load(html);

        // HTML content is inside <div id="page-content">
        const contentElem = $('#page-content');
        if (contentElem.length === 0) {
          // Return entire body if page-content doesn't exist
          this._html = html;
          return html;
        }

        const contentHtml = contentElem.html() ?? '';
        this._html = contentHtml;
        return contentHtml;
      })(),
      (error) => {
        if (error instanceof NoElementError) {
          return error;
        }
        return new UnexpectedError(`Failed to get revision HTML: ${String(error)}`);
      }
    );
  }

  /**
   * Revert the page to this revision (WikiPageAction/revert)
   *
   * @param options - force: force the revert despite an active edit lock held by someone else
   * @returns Raw response data. On a lock conflict (force not set, or set
   * but still refused), the response carries `locks` + `body` describing
   * the conflicting lock instead of completing the revert; the caller is
   * responsible for inspecting this rather than an exception being
   * thrown, since a lock conflict is reported as `status: "ok"` with
   * these extra keys
   */
  revert(options: { force?: boolean } = {}): WikidotResultAsync<Record<string, unknown>> {
    return fromPromise(
      (async () => {
        const loginResult = this.page.site.client.requireLogin();
        if (loginResult.isErr()) {
          throw loginResult.error ?? new UnexpectedError('Login required');
        }
        const body: AMCRequestBody = {
          action: 'WikiPageAction',
          event: 'revert',
          moduleName: 'Empty',
          pageId: this.page.id,
          revisionId: this.id,
          ...omitFalsy({ force: options.force ? 'yes' : undefined }),
        };
        const result = await this.page.site.amcRequest([body]);
        if (result.isErr()) {
          throw result.error;
        }
        const data = result.value[0];
        if (!data) {
          throw new UnexpectedError('Empty response from revert');
        }
        return data;
      })(),
      (error) => (error instanceof WikidotError ? error : new UnexpectedError(String(error)))
    );
  }

  toString(): string {
    return `PageRevision(id=${this.id}, revNo=${this.revNo})`;
  }
}

/**
 * Page revision collection
 */
export class PageRevisionCollection extends Array<PageRevision> {
  public readonly page: Page | null;

  constructor(page: Page | null, revisions?: PageRevision[]) {
    super();
    this.page = page;
    if (revisions) {
      this.push(...revisions);
    }
  }

  /**
   * Find by ID
   * @param id - Revision ID
   * @returns Revision (undefined if not found)
   */
  findById(id: number): PageRevision | undefined {
    return this.find((revision) => revision.id === id);
  }

  /**
   * Get sources for all revisions
   * @returns Array of source strings
   */
  getSources(): WikidotResultAsync<string[]> {
    return fromPromise(
      (async () => {
        const results = await Promise.all(
          this.map(async (revision) => {
            const result = await revision.getSource();
            if (result.isErr()) {
              throw result.error;
            }
            return result.value;
          })
        );
        return results;
      })(),
      (error) => {
        if (error instanceof NoElementError) {
          return error;
        }
        return new UnexpectedError(`Failed to get sources: ${String(error)}`);
      }
    );
  }

  /**
   * Get HTML for all revisions
   * @returns Array of HTML strings
   */
  getHtmls(): WikidotResultAsync<string[]> {
    return fromPromise(
      (async () => {
        const results = await Promise.all(
          this.map(async (revision) => {
            const result = await revision.getHtml();
            if (result.isErr()) {
              throw result.error;
            }
            return result.value;
          })
        );
        return results;
      })(),
      (error) => {
        if (error instanceof NoElementError) {
          return error;
        }
        return new UnexpectedError(`Failed to get HTMLs: ${String(error)}`);
      }
    );
  }

  /**
   * Get an HTML diff between two revisions (history/PageDiffModule)
   */
  static getDiff(
    page: Page,
    fromRevisionId: number,
    toRevisionId: number,
    showType = 'inline'
  ): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const result = await page.site.amcRequest([
          {
            moduleName: 'history/PageDiffModule',
            from_revision_id: fromRevisionId,
            to_revision_id: toRevisionId,
            show_type: showType,
          },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'history/PageDiffModule');
      })(),
      (error) => new UnexpectedError(`Failed to get revision diff: ${String(error)}`)
    );
  }

  /**
   * Get a page's revision history with server-side filtering (history/PageRevisionListModule)
   *
   * Unlike the eager full-history fetch behind `Page.getRevisions()`
   * (`PageCollection.acquirePageRevisions`, which always requests
   * `{all: true}` with a huge perpage to populate the whole collection),
   * this exposes the change-type filter and pagination Wikidot's own
   * history view uses.
   * @param options - options: change-type filter flags, defaults to
   * `{all: true}`. perpage: items per page (10/20/50/100/200 match
   * Wikidot's own choices). pageNo: 1-indexed page number
   */
  static acquire(
    page: Page,
    options: {
      options?: Partial<Record<HistoryOptionKey, boolean>>;
      perpage?: 20 | 50 | 100 | 200;
      pageNo?: number;
    } = {}
  ): WikidotResultAsync<PageRevisionCollection> {
    return fromPromise(
      (async () => {
        const body: AMCRequestBody = {
          moduleName: 'history/PageRevisionListModule',
          page_id: page.id,
          page: options.pageNo ?? 1,
          perpage: options.perpage ?? 20,
          options: JSON.stringify(options.options ?? { all: true }),
        };
        const result = await page.site.amcRequest([body]);
        if (result.isErr()) throw result.error;
        const responseBody = requireBody(result.value[0], 'history/PageRevisionListModule');
        const $ = cheerio.load(responseBody);
        return new PageRevisionCollection(page, parseRevisionListHtml($, page));
      })(),
      (error) => new UnexpectedError(`Failed to acquire revision history: ${String(error)}`)
    );
  }
}
