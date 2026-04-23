import * as cheerio from 'cheerio';
import {
  NoElementError,
  NotFoundException,
  UnexpectedError,
  WikidotError,
} from '../../common/errors';
import { logger } from '../../common/logger';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import type { AMCRequestBody, AMCResponse } from '../../connector';
import { fetchWithRetry } from '../../util/http';
import type { Client } from '../client/client';
import { ForumAccessor } from './accessors/forum-accessor';
import { MemberAccessor } from './accessors/member-accessor';
import { PageAccessor } from './accessors/page-accessor';
import { PagesAccessor } from './accessors/pages-accessor';

/**
 * Site data
 */
export interface SiteData {
  id: number;
  title: string;
  unixName: string;
  domain: string;
  sslSupported: boolean;
}

/**
 * Site class
 */
export class Site {
  public readonly client: Client;

  /** Site ID */
  public readonly id: number;

  /** Site title */
  public readonly title: string;

  /** UNIX name (e.g., scp-jp) */
  public readonly unixName: string;

  /** Domain */
  public readonly domain: string;

  /** SSL support flag */
  public readonly sslSupported: boolean;

  /** Page accessor */
  private _page: PageAccessor | null = null;

  /** Pages accessor */
  private _pages: PagesAccessor | null = null;

  /** Forum accessor */
  private _forum: ForumAccessor | null = null;

  /** Member accessor */
  private _member: MemberAccessor | null = null;

  constructor(client: Client, data: SiteData) {
    this.client = client;
    this.id = data.id;
    this.title = data.title;
    this.unixName = data.unixName;
    this.domain = data.domain;
    this.sslSupported = data.sslSupported;
  }

  /**
   * Get page accessor
   */
  get page(): PageAccessor {
    if (!this._page) {
      this._page = new PageAccessor(this);
    }
    return this._page;
  }

  /**
   * Get pages accessor
   */
  get pages(): PagesAccessor {
    if (!this._pages) {
      this._pages = new PagesAccessor(this);
    }
    return this._pages;
  }

  /**
   * Get forum accessor
   */
  get forum(): ForumAccessor {
    if (!this._forum) {
      this._forum = new ForumAccessor(this);
    }
    return this._forum;
  }

  /**
   * Get member accessor
   */
  get member(): MemberAccessor {
    if (!this._member) {
      this._member = new MemberAccessor(this);
    }
    return this._member;
  }

  /**
   * Get base URL of the site
   */
  getBaseUrl(): string {
    const protocol = this.sslSupported ? 'https' : 'http';
    return `${protocol}://${this.domain}`;
  }

  /**
   * Execute AMC request to this site
   * @param bodies - Request body array
   * @param options - Request options
   * @returns AMC response array
   */
  amcRequest(bodies: AMCRequestBody[]): WikidotResultAsync<AMCResponse[]>;
  amcRequest(
    bodies: AMCRequestBody[],
    options: { returnExceptions: true }
  ): WikidotResultAsync<(AMCResponse | WikidotError)[]>;
  amcRequest(
    bodies: AMCRequestBody[],
    options?: { returnExceptions?: boolean }
  ): WikidotResultAsync<AMCResponse[]> | WikidotResultAsync<(AMCResponse | WikidotError)[]> {
    return this.client.amcClient.requestWithOptions(bodies, {
      siteName: this.unixName,
      sslSupported: this.sslSupported,
      returnExceptions: options?.returnExceptions ?? false,
    });
  }

  /**
   * Execute AMC request with partial failure tolerance.
   * Requests are split into batches and failed requests are retried.
   * @param bodies - Request body array
   * @param options - Optional batch size and max retries
   * @returns AMC response array (null for permanently failed requests)
   */
  amcRequestWithRetry(
    bodies: AMCRequestBody[],
    options?: { batchSize?: number; maxRetries?: number }
  ): WikidotResultAsync<(AMCResponse | null)[]> {
    const batchSize = options?.batchSize ?? this.client.amcClient.config.retryBatchSize;
    const maxRetries = options?.maxRetries ?? this.client.amcClient.config.retryMaxRetries;

    return fromPromise(
      (async () => {
        if (!Number.isInteger(batchSize) || batchSize <= 0) {
          throw new Error(`Invalid batchSize: ${batchSize}. Must be a positive integer.`);
        }
        if (!Number.isInteger(maxRetries) || maxRetries < 0) {
          throw new Error(`Invalid maxRetries: ${maxRetries}. Must be a non-negative integer.`);
        }

        const allResults: (AMCResponse | null)[] = [];

        for (let batchStart = 0; batchStart < bodies.length; batchStart += batchSize) {
          const batch = bodies.slice(batchStart, batchStart + batchSize);

          const initialResult = await this.amcRequest(batch, { returnExceptions: true });
          if (initialResult.isErr()) throw initialResult.error;

          const batchResults: (AMCResponse | null)[] = [];
          let failedIndices: number[] = [];

          for (const [i, respOrErr] of initialResult.value.entries()) {
            if (respOrErr instanceof WikidotError) {
              batchResults.push(null);
              failedIndices.push(i);
            } else {
              batchResults.push(respOrErr);
            }
          }

          for (let attempt = 0; attempt < maxRetries && failedIndices.length > 0; attempt++) {
            const retryBodies = failedIndices.map((i) => batch[i]!);
            logger.warn(
              `amcRequestWithRetry: ${failedIndices.length}/${batch.length} requests failed, retrying (attempt ${attempt + 1}/${maxRetries})`
            );
            const retryResult = await this.amcRequest(retryBodies, { returnExceptions: true });
            if (retryResult.isErr()) break;

            const stillFailedIndices: number[] = [];
            for (let j = 0; j < failedIndices.length; j++) {
              const retryResp = retryResult.value[j];
              if (retryResp && !(retryResp instanceof WikidotError)) {
                batchResults[failedIndices[j]!] = retryResp;
              } else {
                stillFailedIndices.push(failedIndices[j]!);
              }
            }
            failedIndices = stillFailedIndices;
          }

          allResults.push(...batchResults);
        }

        const failedCount = allResults.filter((r) => r === null).length;
        if (failedCount > 0) {
          logger.warn(
            `amcRequestWithRetry: ${allResults.length - failedCount}/${allResults.length} succeeded (${failedCount} failed)`
          );
        }

        return allResults;
      })(),
      (error) => {
        if (error instanceof WikidotError) return error;
        return new UnexpectedError(`AMC request with retry failed: ${String(error)}`);
      }
    );
  }

  /**
   * Execute a single AMC request
   * @param body - Request body
   * @returns AMC response
   */
  amcRequestSingle(body: AMCRequestBody): WikidotResultAsync<AMCResponse> {
    return fromPromise(
      (async () => {
        const result = await this.amcRequest([body]);
        if (result.isErr()) {
          throw result.error;
        }
        const response = result.value[0];
        if (!response) {
          throw new UnexpectedError('AMC request returned empty response');
        }
        return response;
      })(),
      (error) => {
        if (error instanceof UnexpectedError) {
          return error;
        }
        return new UnexpectedError(`AMC request failed: ${String(error)}`);
      }
    );
  }

  /**
   * Get site from UNIX name
   * @param client - Client
   * @param unixName - Site UNIX name (e.g., 'scp-jp')
   * @returns Site
   */
  static fromUnixName(client: Client, unixName: string): WikidotResultAsync<Site> {
    return fromPromise(
      (async () => {
        // Fetch site page (HTTP request, following redirects, with retry)
        const url = `http://${unixName}.wikidot.com`;
        const response = await fetchWithRetry(url, client.amcClient.config, {
          headers: client.amcClient.header.getHeaders(),
          checkOk: false, // Handle HTTP errors manually for better error messages
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new NotFoundException(`Site not found: ${unixName}`);
          }
          throw new UnexpectedError(`Failed to fetch site: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Parse WIKIREQUEST.info
        const scripts = $('script').toArray();
        let siteId: number | null = null;
        let siteUnixName: string | null = null;
        let domain: string | null = null;
        let title: string | null = null;

        for (const script of scripts) {
          const content = $(script).html();
          if (!content || !content.includes('WIKIREQUEST')) {
            continue;
          }

          // siteId
          const siteIdMatch = content.match(/WIKIREQUEST\.info\.siteId\s*=\s*(\d+)/);
          if (siteIdMatch?.[1]) {
            siteId = Number.parseInt(siteIdMatch[1], 10);
          }

          // siteUnixName
          const siteUnixNameMatch = content.match(
            /WIKIREQUEST\.info\.siteUnixName\s*=\s*["']([^"']+)["']/
          );
          if (siteUnixNameMatch?.[1]) {
            siteUnixName = siteUnixNameMatch[1];
          }

          // domain
          const domainMatch = content.match(/WIKIREQUEST\.info\.domain\s*=\s*["']([^"']+)["']/);
          if (domainMatch?.[1]) {
            domain = domainMatch[1];
          }
        }

        // title from <title> tag
        title = $('title').text().trim() || null;
        // Remove " - Wikidot" suffix if present
        if (title?.endsWith(' - Wikidot')) {
          title = title.slice(0, -10).trim();
        }

        if (siteId === null) {
          throw new NoElementError('Site ID not found in WIKIREQUEST');
        }
        if (siteUnixName === null) {
          siteUnixName = unixName; // Fallback
        }
        if (domain === null) {
          domain = `${unixName}.wikidot.com`; // Fallback
        }
        if (title === null) {
          title = unixName; // Fallback
        }

        // Check SSL support (based on whether the redirect URL starts with https)
        const sslSupported = response.url.startsWith('https');

        return new Site(client, {
          id: siteId,
          title,
          unixName: siteUnixName,
          domain,
          sslSupported,
        });
      })(),
      (error) => {
        if (error instanceof NotFoundException || error instanceof NoElementError) {
          return error;
        }
        return new UnexpectedError(`Failed to get site: ${String(error)}`);
      }
    );
  }

  toString(): string {
    return `Site(id=${this.id}, unixName=${this.unixName}, title=${this.title})`;
  }
}
