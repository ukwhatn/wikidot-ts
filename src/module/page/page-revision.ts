import * as cheerio from 'cheerio';
import { NoElementError, UnexpectedError } from '../../common/errors';
import { type WikidotResultAsync, fromPromise } from '../../common/types';
import type { AbstractUser } from '../user';
import type { Page } from './page';
import type { PageSource } from './page-source';

/**
 * ページリビジョンデータ
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
 * ページのリビジョン（編集履歴のバージョン）
 */
export class PageRevision {
  /** リビジョンが属するページ */
  public readonly page: Page;

  /** リビジョンID */
  public readonly id: number;

  /** リビジョン番号 */
  public readonly revNo: number;

  /** リビジョン作成者 */
  public readonly createdBy: AbstractUser;

  /** リビジョン作成日時 */
  public readonly createdAt: Date;

  /** 編集コメント */
  public readonly comment: string;

  /** ソースコード（内部キャッシュ） */
  private _source: PageSource | null = null;

  /** HTML表示（内部キャッシュ） */
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
   * ソースコードが取得済みかどうか
   */
  isSourceAcquired(): boolean {
    return this._source !== null;
  }

  /**
   * HTML表示が取得済みかどうか
   */
  isHtmlAcquired(): boolean {
    return this._html !== null;
  }

  /**
   * ソースコード（キャッシュ済み）を取得
   */
  get source(): PageSource | null {
    return this._source;
  }

  /**
   * ソースコードを設定
   */
  set source(value: PageSource | null) {
    this._source = value;
  }

  /**
   * HTML表示（キャッシュ済み）を取得
   */
  get html(): string | null {
    return this._html;
  }

  /**
   * HTML表示を設定
   */
  set html(value: string | null) {
    this._html = value;
  }

  /**
   * リビジョンのソースを取得する（REV-001）
   * @returns ソース文字列
   */
  getSource(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        // キャッシュがあれば返す
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

        // ソースコードは<div class="page-source">内にある
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
   * リビジョンのHTMLを取得する（REV-002）
   * @returns HTML文字列
   */
  getHtml(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        // キャッシュがあれば返す
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

        // HTMLコンテンツは<div id="page-content">内にある
        const contentElem = $('#page-content');
        if (contentElem.length === 0) {
          // page-contentがない場合はbody全体を返す
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
 * ページリビジョンコレクション
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
   * IDで検索
   * @param id - リビジョンID
   * @returns リビジョン（存在しない場合はundefined）
   */
  findById(id: number): PageRevision | undefined {
    return this.find((revision) => revision.id === id);
  }

  /**
   * 全リビジョンのソースを一括取得する
   * @returns ソース文字列の配列
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
   * 全リビジョンのHTMLを一括取得する
   * @returns HTML文字列の配列
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
