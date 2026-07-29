/**
 * Accessor for site-wide tooling views: Site Tools, Wanted Pages, Orphaned
 * Pages, Drafts, the category-driven page list (manage:listpages), and a
 * filtered recent-changes feed.
 *
 * Access through `Site.tools`. This is a port of the sibling wikidot.py
 * repo's `module/site_tools.py`.
 */

import * as cheerio from 'cheerio';
import { NoElementError, UnexpectedError } from '../../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../../common/types';
import { flag, omitFalsy, requireBody } from '../../../connector';
import type { AMCRequestBody } from '../../../connector/amc-types';
import { parseOdate, parseUser } from '../../../util/parser';
import { SiteChange, SiteChangeCollection } from '../../page/site-change';
import type { Site } from '../site';

/** The 8 change-type flags accepted by changes/SiteChangesListModule's
 * `options` JSON (distinct from history/PageRevisionListModule's 7 -- this
 * one adds "new" and lacks nothing page history has). */
export type RecentChangesOptionKey =
  | 'all'
  | 'source'
  | 'title'
  | 'tags'
  | 'move'
  | 'files'
  | 'new'
  | 'meta';

/**
 * Accessor for site-wide tooling views (Site Tools, Wanted/Orphaned Pages,
 * Drafts, category page lists, filtered recent changes)
 *
 * Access through `Site.tools`.
 */
export class ToolsAccessor {
  public readonly site: Site;

  constructor(site: Site) {
    this.site = site;
  }

  /**
   * Get the rendered Site Tools overview page (sitetools/SiteToolsModule)
   */
  getOverview(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([{ moduleName: 'sitetools/SiteToolsModule' }]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'sitetools/SiteToolsModule');
      })(),
      (error) => new UnexpectedError(`Failed to get site tools overview: ${String(error)}`)
    );
  }

  /**
   * Get the Wanted Pages list (sitetools/WantedPagesModule)
   * @param options - page: pagination page number. embed: whether to render in embedded (no-chrome) mode
   */
  getWantedPages(options: { page?: number; embed?: boolean } = {}): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const body: AMCRequestBody = {
          moduleName: 'sitetools/WantedPagesModule',
          ...omitFalsy({ p: options.page, embed: flag(options.embed) }),
        };
        const result = await this.site.amcRequest([body]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'sitetools/WantedPagesModule');
      })(),
      (error) => new UnexpectedError(`Failed to get wanted pages: ${String(error)}`)
    );
  }

  /**
   * Get the Orphaned Pages list (sitetools/OrphanedPagesModule)
   */
  getOrphanedPages(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          { moduleName: 'sitetools/OrphanedPagesModule' },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'sitetools/OrphanedPagesModule');
      })(),
      (error) => new UnexpectedError(`Failed to get orphaned pages: ${String(error)}`)
    );
  }

  /**
   * Get the drafts list, scoped to Site Tools (list/ListDraftsModule)
   */
  getDrafts(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          { moduleName: 'list/ListDraftsModule', location: 'sitetools' },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'list/ListDraftsModule');
      })(),
      (error) => new UnexpectedError(`Failed to get drafts: ${String(error)}`)
    );
  }

  /**
   * Get the category list for manage:listpages (list/WikiCategoriesModule)
   *
   * Per 50_page.md, the outer page-list body on manage:listpages is static
   * HTML shipped with the page itself, not fetched via this module; this
   * wraps the same module for programmatic access. Use `expandCategory()`
   * to get an individual category's page list.
   */
  getCategories(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([{ moduleName: 'list/WikiCategoriesModule' }]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'list/WikiCategoriesModule');
      })(),
      (error) => new UnexpectedError(`Failed to get categories: ${String(error)}`)
    );
  }

  /**
   * Get the page list for a single category (list/WikiCategoriesPageListModule)
   * @param categoryId - Category ID to expand
   * @param options - includeHidden: whether to include hidden pages
   */
  expandCategory(
    categoryId: number,
    options: { includeHidden?: boolean } = {}
  ): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const body: AMCRequestBody = {
          moduleName: 'list/WikiCategoriesPageListModule',
          category_id: categoryId,
          ...omitFalsy({ includeHidden: flag(options.includeHidden) }),
        };
        const result = await this.site.amcRequest([body]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'list/WikiCategoriesPageListModule');
      })(),
      (error) => new UnexpectedError(`Failed to expand category: ${String(error)}`)
    );
  }

  /**
   * Get recent changes with server-side filtering (changes/SiteChangesListModule)
   *
   * Unlike `SiteChangeCollection.acquire()` (page/site-change.ts, which
   * parses a different table layout and has no category/page filtering),
   * this mirrors the sibling wikidot.py repo's `site.tools.get_recent_changes`
   * and exposes the categoryId/pageId filtering and change-type options
   * flags Wikidot's own system:recent-changes view uses.
   * @param options - categoryId: restrict to a single category (all
   * categories when omitted). pageId: restrict to a single page. options:
   * change-type filter flags, defaults to `{all: true}`. perpage: items
   * per page. pageNo: 1-indexed page number
   */
  getRecentChanges(
    options: {
      categoryId?: number;
      pageId?: number;
      options?: Partial<Record<RecentChangesOptionKey, boolean>>;
      perpage?: 10 | 20 | 50 | 100 | 200;
      pageNo?: number;
    } = {}
  ): WikidotResultAsync<SiteChangeCollection> {
    return fromPromise(
      (async () => {
        const body: AMCRequestBody = {
          moduleName: 'changes/SiteChangesListModule',
          perpage: String(options.perpage ?? 20),
          page: options.pageNo ?? 1,
          options: JSON.stringify(options.options ?? { all: true }),
          ...omitFalsy({ categoryId: options.categoryId, pageId: options.pageId }),
        };
        const result = await this.site.amcRequest([body]);
        if (result.isErr()) throw result.error;

        const html = requireBody(result.value[0], 'changes/SiteChangesListModule');
        // xmlMode: cheerio's default HTML parser strips <td> elements that
        // aren't inside a <table>/<tr> ancestor (per the HTML parsing
        // spec), but Wikidot's changes-list-item markup places <td>
        // directly under a <div>. xmlMode skips that structural repair so
        // the <td> elements -- and the class selectors below -- survive.
        const $ = cheerio.load(html, { xmlMode: true });
        const changes: SiteChange[] = [];

        $('div.changes-list-item').each((_i, elem) => {
          const $item = $(elem);

          const commentElem = $item.find('td.comments');
          const comment = commentElem.length > 0 ? commentElem.text().trim() : '';

          const titleElem = $item.find('td.title a');
          if (titleElem.length === 0) {
            throw new NoElementError('Title element is not found.');
          }
          const pageTitle = titleElem.text().trim();
          const href = titleElem.attr('href') ?? '';
          const pageFullname = href.replace(/^\/|\/$/g, '');

          const odateElem = $item.find('td.mod-date span.odate');
          if (odateElem.length === 0) {
            throw new NoElementError('Odate element is not found.');
          }
          const changedAt = parseOdate(odateElem) ?? new Date();

          const revElem = $item.find('td.revision-no');
          if (revElem.length === 0) {
            throw new NoElementError('Revision number element is not found.');
          }
          const revMatch = revElem.text().match(/(\d+)/);
          if (!revMatch?.[1]) {
            throw new NoElementError('Revision number is not found.');
          }
          const revisionNo = Number.parseInt(revMatch[1], 10);

          const userElem = $item.find('td.mod-by span.printuser');
          if (userElem.length === 0) {
            throw new NoElementError('User element is not found.');
          }
          const changedBy = parseUser(this.site.client, userElem);

          const changeFlags: string[] = [];
          $item.find('td.flags span').each((_j, flagElem) => {
            changeFlags.push($(flagElem).text().trim());
          });

          changes.push(
            new SiteChange({
              site: this.site,
              pageFullname,
              pageTitle,
              revisionNo,
              changedBy,
              changedAt,
              flags: changeFlags,
              comment,
            })
          );
        });

        return new SiteChangeCollection(this.site, changes);
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to get recent changes: ${String(error)}`);
      }
    );
  }
}
