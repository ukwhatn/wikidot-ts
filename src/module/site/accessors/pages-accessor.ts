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
 * ページ一覧操作アクセサ
 */
export class PagesAccessor {
  public readonly site: Site;

  constructor(site: Site) {
    this.site = site;
  }

  /**
   * 条件に合うページを検索する
   * @param params - 検索条件
   * @returns ページコレクション
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
   * 全ページを取得する
   * @returns ページコレクション
   */
  all(): WikidotResultAsync<PageCollection> {
    return this.search({});
  }

  /**
   * 最近の変更履歴を取得する
   * @param options - オプション
   * @param options.perPage - 1ページあたりの件数（デフォルト: 20）
   * @param options.page - ページ番号（デフォルト: 1）
   * @returns 変更履歴コレクション
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
