import * as cheerio from 'cheerio';
import { NoElementError, NotFoundException, UnexpectedError } from '../../common/errors';
import { type WikidotResultAsync, fromPromise } from '../../common/types';
import type { AMCRequestBody, AMCResponse } from '../../connector';
import type { Client } from '../client/client';
import { ForumAccessor } from './accessors/forum-accessor';
import { MemberAccessor } from './accessors/member-accessor';
import { PageAccessor } from './accessors/page-accessor';
import { PagesAccessor } from './accessors/pages-accessor';

/**
 * サイトデータ
 */
export interface SiteData {
  id: number;
  title: string;
  unixName: string;
  domain: string;
  sslSupported: boolean;
}

/**
 * サイトクラス
 */
export class Site {
  public readonly client: Client;

  /** サイトID */
  public readonly id: number;

  /** サイトタイトル */
  public readonly title: string;

  /** UNIX名（例: scp-jp） */
  public readonly unixName: string;

  /** ドメイン */
  public readonly domain: string;

  /** SSL対応フラグ */
  public readonly sslSupported: boolean;

  /** ページアクセサ */
  private _page: PageAccessor | null = null;

  /** ページ一覧アクセサ */
  private _pages: PagesAccessor | null = null;

  /** フォーラムアクセサ */
  private _forum: ForumAccessor | null = null;

  /** メンバーアクセサ */
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
   * ページアクセサを取得
   */
  get page(): PageAccessor {
    if (!this._page) {
      this._page = new PageAccessor(this);
    }
    return this._page;
  }

  /**
   * ページ一覧アクセサを取得
   */
  get pages(): PagesAccessor {
    if (!this._pages) {
      this._pages = new PagesAccessor(this);
    }
    return this._pages;
  }

  /**
   * フォーラムアクセサを取得
   */
  get forum(): ForumAccessor {
    if (!this._forum) {
      this._forum = new ForumAccessor(this);
    }
    return this._forum;
  }

  /**
   * メンバーアクセサを取得
   */
  get member(): MemberAccessor {
    if (!this._member) {
      this._member = new MemberAccessor(this);
    }
    return this._member;
  }

  /**
   * サイトのベースURLを取得
   */
  getBaseUrl(): string {
    const protocol = this.sslSupported ? 'https' : 'http';
    return `${protocol}://${this.domain}`;
  }

  /**
   * サイトへのAMCリクエストを実行
   * @param bodies - リクエストボディ配列
   * @returns AMCレスポンス配列
   */
  amcRequest(bodies: AMCRequestBody[]): WikidotResultAsync<AMCResponse[]> {
    return this.client.amcClient.request(bodies, this.unixName, this.sslSupported);
  }

  /**
   * 単一のAMCリクエストを実行
   * @param body - リクエストボディ
   * @returns AMCレスポンス
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
   * UNIX名からサイトを取得する
   * @param client - クライアント
   * @param unixName - サイトのUNIX名（例: 'scp-jp'）
   * @returns サイト
   */
  static fromUnixName(client: Client, unixName: string): WikidotResultAsync<Site> {
    return fromPromise(
      (async () => {
        // サイトページを取得
        const url = `https://${unixName}.wikidot.com`;
        const response = await fetch(url, {
          headers: client.amcClient.header.getHeaders(),
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new NotFoundException(`Site not found: ${unixName}`);
          }
          throw new UnexpectedError(`Failed to fetch site: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // WIKIREQUEST.info を解析
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

        // SSL対応チェック（既にhttpsでアクセスできているので true）
        const sslSupported = true;

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
