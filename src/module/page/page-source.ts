import type { Page } from './page';

/**
 * ページソースデータ
 */
export interface PageSourceData {
  page: Page;
  wikiText: string;
}

/**
 * ページのソースコード（Wikidot記法）
 */
export class PageSource {
  /** ソースが属するページ */
  public readonly page: Page;

  /** ソースコード（Wikidot記法） */
  public readonly wikiText: string;

  constructor(data: PageSourceData) {
    this.page = data.page;
    this.wikiText = data.wikiText;
  }

  toString(): string {
    return `PageSource(page=${this.page.fullname}, length=${this.wikiText.length})`;
  }
}
