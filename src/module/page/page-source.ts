import type { Page } from './page';

/**
 * Page source data
 */
export interface PageSourceData {
  page: Page;
  wikiText: string;
}

/**
 * Page source code (Wikidot syntax)
 */
export class PageSource {
  /** Page this source belongs to */
  public readonly page: Page;

  /** Source code (Wikidot syntax) */
  public readonly wikiText: string;

  constructor(data: PageSourceData) {
    this.page = data.page;
    this.wikiText = data.wikiText;
  }

  toString(): string {
    return `PageSource(page=${this.page.fullname}, length=${this.wikiText.length})`;
  }
}
