import { NoElementError, UnexpectedError } from '../../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../../common/types';
import { parseUser } from '../../../util/parser';
import { Page, PageCollection, SearchPagesQuery } from '../../page';
import type { Site } from '../site';

/**
 * Single page operations accessor
 */
export class PageAccessor {
  public readonly site: Site;

  constructor(site: Site) {
    this.site = site;
  }

  /**
   * Get page by UNIX name
   * @param unixName - Page UNIX name (e.g., 'scp-173')
   * @returns Page (null if not found)
   */
  get(unixName: string): WikidotResultAsync<Page | null> {
    return fromPromise(
      (async () => {
        const query = new SearchPagesQuery({ fullname: unixName });
        const userParser = parseUser.bind(null, this.site.client);

        const result = await PageCollection.searchPages(this.site, userParser, query);
        if (result.isErr()) {
          throw result.error;
        }

        return result.value.length > 0 ? (result.value[0] ?? null) : null;
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to get page: ${String(error)}`);
      }
    );
  }

  /**
   * Create a page
   * @param fullname - Page fullname (e.g., 'scp-173')
   * @param options - Creation options
   * @returns void
   */
  create(
    fullname: string,
    options: {
      title?: string;
      source?: string;
      comment?: string;
      forceEdit?: boolean;
    } = {}
  ): WikidotResultAsync<void> {
    return PageCollection.createOrEdit(this.site, fullname, {
      title: options.title,
      source: options.source,
      comment: options.comment,
      forceEdit: options.forceEdit,
    });
  }
}

export { Page };
