import { LoginRequiredError, NoElementError, UnexpectedError } from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import type { PageRef } from '../types';

/**
 * ページメタタグデータ
 */
export interface PageMetaData {
  page: PageRef;
  name: string;
  content: string;
}

/**
 * ページメタタグ
 */
export class PageMeta {
  public readonly page: PageRef;
  public readonly name: string;
  public content: string;

  constructor(data: PageMetaData) {
    this.page = data.page;
    this.name = data.name;
    this.content = data.content;
  }

  /**
   * メタタグの値を更新する
   * @param content - 新しい値
   */
  update(content: string): WikidotResultAsync<void> {
    return PageMetaCollection.setMeta(this.page, this.name, content);
  }

  /**
   * メタタグを削除する
   */
  delete(): WikidotResultAsync<void> {
    return PageMetaCollection.deleteMeta(this.page, this.name);
  }

  toString(): string {
    return `PageMeta(name=${this.name}, content=${this.content})`;
  }
}

/**
 * ページメタタグコレクション
 */
export class PageMetaCollection extends Array<PageMeta> {
  public readonly page: PageRef;

  constructor(page: PageRef, metas?: PageMeta[]) {
    super();
    this.page = page;
    if (metas) {
      this.push(...metas);
    }
  }

  /**
   * 名前で検索
   * @param name - メタタグ名
   * @returns メタタグ（存在しない場合はundefined）
   */
  findByName(name: string): PageMeta | undefined {
    return this.find((meta) => meta.name === name);
  }

  /**
   * ページのメタタグを取得する
   * @param page - ページ参照
   * @returns メタタグコレクション
   */
  static acquire(page: PageRef): WikidotResultAsync<PageMetaCollection> {
    return fromPromise(
      (async () => {
        const result = await page.site.amcRequest([
          {
            moduleName: 'edit/EditMetaModule',
            pageId: page.id,
          },
        ]);

        if (result.isErr()) {
          throw result.error;
        }

        const response = result.value[0];
        if (!response) {
          throw new NoElementError('Empty response');
        }

        const html = String(response.body ?? '');
        const metas: PageMeta[] = [];

        // HTMLエンコードされたメタタグを正規表現でパース
        // 形式: &lt;meta name="xxx" content="yyy"/&gt;
        const metaRegex = /&lt;meta name="([^"]+)" content="([^"]*)"\/?&gt;/g;
        for (const match of html.matchAll(metaRegex)) {
          const name = match[1];
          const content = match[2];
          if (name) {
            metas.push(
              new PageMeta({
                page,
                name,
                content: content ?? '',
              })
            );
          }
        }

        return new PageMetaCollection(page, metas);
      })(),
      (error) => {
        if (error instanceof NoElementError) {
          return error;
        }
        return new UnexpectedError(`Failed to acquire page metas: ${String(error)}`);
      }
    );
  }

  /**
   * メタタグを設定する
   * @param page - ページ参照
   * @param name - メタタグ名
   * @param content - メタタグの値
   */
  static setMeta(page: PageRef, name: string, content: string): WikidotResultAsync<void> {
    const loginResult = page.site.client.requireLogin();
    if (loginResult.isErr()) {
      return fromPromise(
        Promise.reject(loginResult.error),
        () => new LoginRequiredError('Login required to set meta tag')
      );
    }

    return fromPromise(
      (async () => {
        const result = await page.site.amcRequest([
          {
            action: 'WikiPageAction',
            event: 'saveMetaTag',
            moduleName: 'edit/EditMetaModule',
            pageId: page.id,
            metaName: name,
            metaContent: content,
          },
        ]);

        if (result.isErr()) {
          throw result.error;
        }
      })(),
      (error) => {
        if (error instanceof LoginRequiredError) {
          return error;
        }
        return new UnexpectedError(`Failed to set meta tag: ${String(error)}`);
      }
    );
  }

  /**
   * メタタグを削除する
   * @param page - ページ参照
   * @param name - メタタグ名
   */
  static deleteMeta(page: PageRef, name: string): WikidotResultAsync<void> {
    const loginResult = page.site.client.requireLogin();
    if (loginResult.isErr()) {
      return fromPromise(
        Promise.reject(loginResult.error),
        () => new LoginRequiredError('Login required to delete meta tag')
      );
    }

    return fromPromise(
      (async () => {
        const result = await page.site.amcRequest([
          {
            action: 'WikiPageAction',
            event: 'deleteMetaTag',
            moduleName: 'edit/EditMetaModule',
            pageId: page.id,
            metaName: name,
          },
        ]);

        if (result.isErr()) {
          throw result.error;
        }
      })(),
      (error) => {
        if (error instanceof LoginRequiredError) {
          return error;
        }
        return new UnexpectedError(`Failed to delete meta tag: ${String(error)}`);
      }
    );
  }
}
