import { NoElementError, UnexpectedError } from '../../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../../common/types';
import { parseUser } from '../../../util/parser';
import { Page, PageCollection, SearchPagesQuery } from '../../page';
import type { Site } from '../site';

/**
 * 単一ページ操作アクセサ
 */
export class PageAccessor {
  public readonly site: Site;

  constructor(site: Site) {
    this.site = site;
  }

  /**
   * UNIX名からページを取得する
   * @param unixName - ページのUNIX名（例: 'scp-173'）
   * @returns ページ（存在しない場合はnull）
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
   * ページを作成する
   * @param fullname - ページのフルネーム（例: 'scp-173'）
   * @param options - 作成オプション
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
