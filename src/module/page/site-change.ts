import * as cheerio from 'cheerio';
import { NoElementError, UnexpectedError } from '../../common/errors';
import { type WikidotResultAsync, fromPromise } from '../../common/types';
import { parseOdate, parseUser } from '../../util/parser';
import type { Site } from '../site';
import type { AbstractUser } from '../user';

/**
 * サイト変更履歴データ
 */
export interface SiteChangeData {
  site: Site;
  pageFullname: string;
  pageTitle: string;
  revisionNo: number;
  changedBy: AbstractUser | null;
  changedAt: Date | null;
  flags: string[];
  comment: string;
}

/**
 * サイト変更履歴
 */
export class SiteChange {
  public readonly site: Site;
  public readonly pageFullname: string;
  public readonly pageTitle: string;
  public readonly revisionNo: number;
  public readonly changedBy: AbstractUser | null;
  public readonly changedAt: Date | null;
  public readonly flags: string[];
  public readonly comment: string;

  constructor(data: SiteChangeData) {
    this.site = data.site;
    this.pageFullname = data.pageFullname;
    this.pageTitle = data.pageTitle;
    this.revisionNo = data.revisionNo;
    this.changedBy = data.changedBy;
    this.changedAt = data.changedAt;
    this.flags = data.flags;
    this.comment = data.comment;
  }

  /**
   * ページURL
   */
  getPageUrl(): string {
    return `${this.site.getBaseUrl()}/${this.pageFullname}`;
  }

  toString(): string {
    return `SiteChange(page=${this.pageFullname}, rev=${this.revisionNo}, by=${this.changedBy})`;
  }
}

/**
 * サイト変更履歴コレクション
 */
export class SiteChangeCollection extends Array<SiteChange> {
  public readonly site: Site;

  constructor(site: Site, changes?: SiteChange[]) {
    super();
    this.site = site;
    if (changes) {
      this.push(...changes);
    }
  }

  /**
   * 最近の変更履歴を取得する
   * @param site - サイト
   * @param options - オプション
   * @returns 変更履歴コレクション
   */
  static acquire(
    site: Site,
    options?: { perPage?: number; page?: number; limit?: number }
  ): WikidotResultAsync<SiteChangeCollection> {
    const perPage = options?.perPage ?? 20;
    const page = options?.page ?? 1;
    const limit = options?.limit;

    return fromPromise(
      (async () => {
        const result = await site.amcRequest([
          {
            moduleName: 'changes/SiteChangesListModule',
            perpage: perPage,
            page: page,
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
        const $ = cheerio.load(html);
        const changes: SiteChange[] = [];

        // テーブル行をパース
        $('table.wiki-content-table tr').each((_i, elem) => {
          const $row = $(elem);
          const $cells = $row.find('td');
          if ($cells.length < 4) return;

          // ページリンク
          const pageLink = $($cells[0]).find('a');
          const href = pageLink.attr('href') ?? '';
          const pageFullname = href.replace(/^\//, '').split('/')[0] ?? '';
          const pageTitle = pageLink.text().trim();

          // リビジョン番号
          const revText = $($cells[1]).text().trim();
          const revMatch = revText.match(/(\d+)/);
          const revisionNo = revMatch?.[1] ? Number.parseInt(revMatch[1], 10) : 0;

          // フラグ
          const flagsCell = $($cells[2]);
          const flags: string[] = [];
          flagsCell.find('span').each((_j, flagElem) => {
            const flagClass = $(flagElem).attr('class') ?? '';
            if (flagClass.includes('spantip')) {
              const title = $(flagElem).attr('title') ?? '';
              if (title) flags.push(title);
            }
          });

          // ユーザーと日時
          const infoCell = $($cells[3]);
          const userElem = infoCell.find('span.printuser');
          const changedBy = userElem.length > 0 ? parseUser(site.client, userElem) : null;

          const odateElem = infoCell.find('span.odate');
          const changedAt = odateElem.length > 0 ? parseOdate(odateElem) : null;

          // コメント
          const commentElem = infoCell.find('span.comments');
          const comment = commentElem
            .text()
            .trim()
            .replace(/^[""]|[""]$/g, '');

          changes.push(
            new SiteChange({
              site,
              pageFullname,
              pageTitle,
              revisionNo,
              changedBy,
              changedAt,
              flags,
              comment,
            })
          );
        });

        // limitが指定されている場合は結果を制限
        const limitedChanges = limit !== undefined ? changes.slice(0, limit) : changes;
        return new SiteChangeCollection(site, limitedChanges);
      })(),
      (error) => {
        if (error instanceof NoElementError) {
          return error;
        }
        return new UnexpectedError(`Failed to acquire site changes: ${String(error)}`);
      }
    );
  }
}
