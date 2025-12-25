import { UnexpectedError } from '../../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../../common/types';
import { parseUser } from '../../../util/parser';
import {
  Page,
  PageCollection,
  SearchPagesQuery,
  type SearchPagesQueryParams,
  SiteChangeCollection,
} from '../../page';
import type { Site } from '../site';

/**
 * Page list operations accessor
 */
export class PagesAccessor {
  public readonly site: Site;

  constructor(site: Site) {
    this.site = site;
  }

  /**
   * Search pages matching conditions
   * @param params - Search conditions
   * @returns Page collection
   */
  search(params?: SearchPagesQueryParams): WikidotResultAsync<PageCollection> {
    return fromPromise(
      (async () => {
        const query = new SearchPagesQuery(params);
        const userParser = parseUser.bind(null, this.site.client);

        const result = await PageCollection.searchPages(this.site, userParser, query);
        if (result.isErr()) {
          throw result.error;
        }

        return result.value;
      })(),
      (error) => new UnexpectedError(`Failed to search pages: ${String(error)}`)
    );
  }

  /**
   * Get all pages
   * @returns Page collection
   */
  all(): WikidotResultAsync<PageCollection> {
    return this.search({});
  }

  /**
   * Get recent changes
   * @param options - Options
   * @param options.perPage - Items per page (default: 20)
   * @param options.page - Page number (default: 1)
   * @returns Change history collection
   */
  getRecentChanges(options?: {
    perPage?: number;
    page?: number;
  }): WikidotResultAsync<SiteChangeCollection> {
    return SiteChangeCollection.acquire(this.site, options);
  }
}

export {
  Page,
  PageCollection,
  SearchPagesQuery,
  SiteChangeCollection,
  type SearchPagesQueryParams,
};
