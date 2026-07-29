import * as cheerio from 'cheerio';
import { LoginRequiredError, UnexpectedError, WikidotError } from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { flag, omitFalsy, requireBody } from '../../connector';
import type { Page } from './page';

function toWikidotError(error: unknown): WikidotError {
  return error instanceof WikidotError ? error : new UnexpectedError(String(error));
}

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
  public name: string;
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

  /**
   * Get the rendered rename form for this file (files/FileRenameWinModule)
   */
  getRenameForm(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const result = await this.page.site.amcRequest([
          { moduleName: 'files/FileRenameWinModule', file_id: this.id },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'files/FileRenameWinModule');
      })(),
      toWikidotError
    );
  }

  /**
   * Get the rendered move form for this file (files/FileMoveWinModule)
   */
  getMoveForm(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const result = await this.page.site.amcRequest([
          { moduleName: 'files/FileMoveWinModule', file_id: this.id },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'files/FileMoveWinModule');
      })(),
      toWikidotError
    );
  }

  /**
   * Get the rendered detail view for this file (files/FileInformationWinModule)
   */
  getInfo(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const result = await this.page.site.amcRequest([
          { moduleName: 'files/FileInformationWinModule', file_id: this.id },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'files/FileInformationWinModule');
      })(),
      toWikidotError
    );
  }

  /**
   * Rename this file (FileAction/renameFile)
   * @param newName - New file name
   * @param options - force: whether to overwrite if a file with the new name already exists
   * @remarks Failure status codes: "file_exists" (response carries `body`)
   * / "name_error" (response carries `message`)
   */
  rename(newName: string, options: { force?: boolean } = {}): WikidotResultAsync<PageFile> {
    return fromPromise(
      (async () => {
        const loginResult = this.page.site.client.requireLogin();
        if (loginResult.isErr()) {
          throw loginResult.error ?? new LoginRequiredError();
        }
        const result = await this.page.site.amcRequest([
          {
            action: 'FileAction',
            event: 'renameFile',
            moduleName: 'Empty',
            file_id: this.id,
            new_name: newName,
            ...omitFalsy({ force: flag(options.force) }),
          },
        ]);
        if (result.isErr()) throw result.error;
        this.name = newName;
        return this;
      })(),
      toWikidotError
    );
  }

  /**
   * Move this file to another page (FileAction/moveFile)
   * @param destinationPageName - Fullname of the destination page
   * @param options - force: whether to overwrite if a file with the same
   * name already exists on the destination page
   * @remarks Failure status codes: "file_exists" / "no_destination" /
   * "no_destination_permission". After a successful move this object's
   * `page` reference still points at the source page; re-fetch the file
   * from the destination page if an up-to-date PageFile is needed
   */
  move(destinationPageName: string, options: { force?: boolean } = {}): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const loginResult = this.page.site.client.requireLogin();
        if (loginResult.isErr()) {
          throw loginResult.error ?? new LoginRequiredError();
        }
        const result = await this.page.site.amcRequest([
          {
            action: 'FileAction',
            event: 'moveFile',
            moduleName: 'Empty',
            file_id: this.id,
            destination_page_name: destinationPageName,
            ...omitFalsy({ force: flag(options.force) }),
          },
        ]);
        if (result.isErr()) throw result.error;
      })(),
      toWikidotError
    );
  }

  /**
   * Delete this file (FileAction/deleteFile)
   * @param options - confirm: must be explicitly set to true. This is a
   * destructive, irreversible operation
   */
  delete(options: { confirm?: boolean } = {}): WikidotResultAsync<void> {
    if (!options.confirm) {
      return fromPromise(
        Promise.reject(new Error('delete() is destructive; pass { confirm: true } to proceed')),
        (error) => new UnexpectedError(String(error))
      );
    }
    return fromPromise(
      (async () => {
        const loginResult = this.page.site.client.requireLogin();
        if (loginResult.isErr()) {
          throw loginResult.error ?? new LoginRequiredError();
        }
        const result = await this.page.site.amcRequest([
          { action: 'FileAction', event: 'deleteFile', moduleName: 'Empty', file_id: this.id },
        ]);
        if (result.isErr()) throw result.error;
      })(),
      toWikidotError
    );
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

        const html = requireBody(response, 'files/PageFilesModule');
        const $ = cheerio.load(html);
        const files = PageFileCollection._parseFromHtml(page, $);

        return new PageFileCollection(page, files);
      })(),
      (error) => new UnexpectedError(`Failed to acquire files: ${String(error)}`)
    );
  }

  /**
   * Check whether a file with the given name exists on the page (FileAction/checkFileExists)
   */
  static checkExists(page: Page, filename: string): WikidotResultAsync<boolean> {
    return fromPromise(
      (async () => {
        const result = await page.site.amcRequest([
          {
            action: 'FileAction',
            event: 'checkFileExists',
            moduleName: 'Empty',
            filename,
            pageId: page.id,
          },
        ]);
        if (result.isErr()) throw result.error;
        return Boolean(result.value[0]?.exists);
      })(),
      toWikidotError
    );
  }

  /**
   * Get the rendered file upload form for a page (files/FileUploadModule)
   *
   * Returns the HTML form only; the actual upload goes through the
   * separate multipart endpoint (see upload()), not this module.
   */
  static getUploadForm(page: Page): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const result = await page.site.amcRequest([
          { moduleName: 'files/FileUploadModule', pageId: page.id },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'files/FileUploadModule');
      })(),
      toWikidotError
    );
  }

  /**
   * Get the rendered site-wide file manager view (files/manager/FileManagerModule)
   *
   * The exact parameter set for a manager view scoped beyond a single page
   * was not captured during wire-format research; this sends `pageId` as
   * the one documented per-page parameter shape and returns the raw body.
   */
  static getManager(page: Page): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const result = await page.site.amcRequest([
          { moduleName: 'files/manager/FileManagerModule', pageId: page.id },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'files/manager/FileManagerModule');
      })(),
      toWikidotError
    );
  }

  /**
   * Upload a file to a page (multipart, /default--flow/files__UploadTarget)
   *
   * UNVERIFIED AGAINST A LIVE WIKIDOT INSTANCE -- see
   * AMCClient.uploadFile's docstring for what is and isn't confirmed.
   * Does not go through site.amcRequest(): this endpoint returns an HTML
   * fragment rather than the AMC JSON envelope, so it uses a dedicated
   * client method instead.
   * @param page - Page to attach the file to
   * @param filename - File name as it will appear on the page
   * @param content - File content
   * @param options - multikey: multi-file upload session key, required
   * when uploading more than one file so Wikidot can group them for
   * multiUploadComplete()
   */
  static upload(
    page: Page,
    filename: string,
    content: Uint8Array | Blob,
    options: { multikey?: string } = {}
  ): WikidotResultAsync<Record<string, string>> {
    return fromPromise(
      (async () => {
        const loginResult = page.site.client.requireLogin();
        if (loginResult.isErr()) {
          throw loginResult.error ?? new LoginRequiredError();
        }
        if (page.id === null) {
          throw new UnexpectedError('Page ID must be acquired before uploading a file');
        }
        const result = await page.site.client.amcClient.uploadFile({
          pageId: page.id,
          filename,
          content,
          siteName: page.site.unixName,
          siteSslSupported: page.site.sslSupported,
          multikey: options.multikey,
        });
        if (result.isErr()) throw result.error;
        return result.value;
      })(),
      toWikidotError
    );
  }

  /**
   * Notify Wikidot that a batch of multipart uploads has finished (FileAction/multiUploadComplete)
   */
  static multiUploadComplete(
    page: Page,
    multikey: string,
    filenames: string[]
  ): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const loginResult = page.site.client.requireLogin();
        if (loginResult.isErr()) {
          throw loginResult.error ?? new LoginRequiredError();
        }
        const result = await page.site.amcRequest([
          {
            action: 'FileAction',
            event: 'multiUploadComplete',
            moduleName: 'Empty',
            multikey,
            fnames: JSON.stringify(filenames),
            page_id: page.id,
          },
        ]);
        if (result.isErr()) throw result.error;
      })(),
      toWikidotError
    );
  }
}
