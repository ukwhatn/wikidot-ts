import * as cheerio from 'cheerio';
import { NoElementError, UnexpectedError } from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import type { AbstractUser } from '../user';
import type { Page } from './page';
import type { PageSource } from './page-source';

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

        const html = String(response.body ?? '');
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

        const html = String(response.body ?? '');
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
}
