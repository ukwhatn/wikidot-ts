import * as cheerio from 'cheerio';
import { UnexpectedError } from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import type { Page } from './page';

/**
 * Page file data
 */
export interface PageFileData {
  page: Page;
  id: number;
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

/**
 * Page attachment file
 */
export class PageFile {
  public readonly page: Page;
  public readonly id: number;
  public readonly name: string;
  public readonly url: string;
  public readonly mimeType: string;
  public readonly size: number;

  constructor(data: PageFileData) {
    this.page = data.page;
    this.id = data.id;
    this.name = data.name;
    this.url = data.url;
    this.mimeType = data.mimeType;
    this.size = data.size;
  }

  toString(): string {
    return `PageFile(id=${this.id}, name=${this.name}, size=${this.size})`;
  }
}

/**
 * Page file collection
 */
export class PageFileCollection extends Array<PageFile> {
  public readonly page: Page;

  constructor(page: Page, files?: PageFile[]) {
    super();
    this.page = page;
    if (files) {
      this.push(...files);
    }
  }

  /**
   * Find by ID
   */
  findById(id: number): PageFile | undefined {
    return this.find((file) => file.id === id);
  }

  /**
   * Find by name
   */
  findByName(name: string): PageFile | undefined {
    return this.find((file) => file.name === name);
  }

  /**
   * Convert size string to bytes (public for batch operations)
   */
  static parseSize(sizeText: string): number {
    const text = sizeText.trim();
    if (text.includes('Bytes')) {
      return Math.floor(Number.parseFloat(text.replace('Bytes', '').trim()));
    }
    if (text.includes('kB')) {
      return Math.floor(Number.parseFloat(text.replace('kB', '').trim()) * 1000);
    }
    if (text.includes('MB')) {
      return Math.floor(Number.parseFloat(text.replace('MB', '').trim()) * 1000000);
    }
    if (text.includes('GB')) {
      return Math.floor(Number.parseFloat(text.replace('GB', '').trim()) * 1000000000);
    }
    return 0;
  }

  /**
   * Parse file information from HTML response
   * Internal helper for acquire() and PageCollection.acquirePageFiles()
   */
  static _parseFromHtml(page: Page, $: cheerio.CheerioAPI): PageFile[] {
    const filesTable = $('table.page-files');
    if (filesTable.length === 0) {
      return [];
    }

    const files: PageFile[] = [];

    filesTable.find("tbody tr[id^='file-row-']").each((_i, row) => {
      const rowId = $(row).attr('id');
      if (!rowId) return;

      const fileId = Number.parseInt(rowId.replace('file-row-', ''), 10);
      const tds = $(row).find('td');
      if (tds.length < 3) return;

      const linkElem = $(tds[0]).find('a');
      if (linkElem.length === 0) return;

      const name = linkElem.text().trim();
      const href = linkElem.attr('href') ?? '';
      const url = `${page.site.getBaseUrl()}${href}`;

      const mimeElem = $(tds[1]).find('span');
      const mimeType = mimeElem.attr('title') ?? '';

      const sizeText = $(tds[2]).text().trim();
      const size = PageFileCollection.parseSize(sizeText);

      files.push(
        new PageFile({
          page,
          id: fileId,
          name,
          url,
          mimeType,
          size,
        })
      );
    });

    return files;
  }

  /**
   * Get list of files attached to page
   */
  static acquire(page: Page): WikidotResultAsync<PageFileCollection> {
    if (page.id === null) {
      return fromPromise(
        Promise.reject(new Error('Page ID not acquired')),
        () => new UnexpectedError('Page ID must be acquired before getting files')
      );
    }

    const pageId = page.id;

    return fromPromise(
      (async () => {
        const result = await page.site.amcRequest([
          {
            moduleName: 'files/PageFilesModule',
            page_id: pageId,
          },
        ]);

        if (result.isErr()) {
          throw result.error;
        }

        const response = result.value[0];
        if (!response) {
          throw new UnexpectedError('Empty response');
        }

        const html = String(response.body ?? '');
        const $ = cheerio.load(html);
        const files = PageFileCollection._parseFromHtml(page, $);

        return new PageFileCollection(page, files);
      })(),
      (error) => new UnexpectedError(`Failed to acquire files: ${String(error)}`)
    );
  }
}
