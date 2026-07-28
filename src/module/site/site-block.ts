import * as cheerio from 'cheerio';
import { parseUser } from '../../util/parser';
import type { AbstractUser } from '../user';
import type { Site } from './site';

/**
 * Matches the `deleteBlock(event, <id>, ...)` onclick handlers Wikidot's client embeds
 * per row (same onclick-parsing pattern as forum-post-revision.ts's showRevision(event, id)).
 */
const DELETE_BLOCK_ID_RE = /deleteBlock\s*\(\s*event\s*,\s*(\d+)/;

/**
 * A single blocked-user entry.
 *
 * **Row markup is not directly measured** (no admin-panel HTML sample was captured for
 * this module; only the client-side JS handlers were). Row parsing reuses the
 * `span.printuser` convention validated elsewhere in this codebase (e.g. SiteMember.parse,
 * ForumPostRevision), since `managesite_blocks_ManageSiteUserBlocksModule.js` confirms each
 * row's "unblock" control passes the user ID via `deleteBlock(event, userId, ...)` -- the
 * same onclick-argument shape as other admin listings in this project. Verify against a live
 * site before relying on `reason` parsing.
 */
export interface UserBlockData {
  site: Site;
  user: AbstractUser;
  reason: string;
}

export class UserBlock {
  public readonly site: Site;
  public readonly user: AbstractUser;
  public readonly reason: string;

  constructor(data: UserBlockData) {
    this.site = data.site;
    this.user = data.user;
    this.reason = data.reason;
  }

  /** Parse blocked-user entries from list HTML */
  static parseAll(site: Site, html: string): UserBlock[] {
    const $ = cheerio.load(html);
    const blocks: UserBlock[] = [];

    $('table tr').each((_i, row) => {
      const $row = $(row);
      const userElem = $row.find('span.printuser');
      if (userElem.length === 0) {
        return;
      }

      const user = parseUser(site.client, userElem);
      const cells = $row.find('td');
      const reason =
        cells.length > 0
          ? $(cells[cells.length - 1])
              .text()
              .trim()
          : '';

      blocks.push(new UserBlock({ site, user, reason }));
    });

    return blocks;
  }
}

/**
 * A single blocked-IP entry.
 *
 * **Row markup is not directly measured** (same caveat as {@link UserBlock}). `blockId` is
 * extracted from the `deleteBlock(event, blockId, ...)` onclick handler
 * (`managesite_blocks_ManageSiteIpBlocksModule.js` confirms this argument is a block ID, not
 * the IP itself -- asymmetric with UserBlock, whose equivalent argument is a user ID; see
 * member-accessor.ts's `unblockUser`/`unblockIp` docs).
 */
export interface IpBlockData {
  site: Site;
  blockId: number;
  ip: string;
  reason: string;
}

export class IpBlock {
  public readonly site: Site;
  public readonly blockId: number;
  public readonly ip: string;
  public readonly reason: string;

  constructor(data: IpBlockData) {
    this.site = data.site;
    this.blockId = data.blockId;
    this.ip = data.ip;
    this.reason = data.reason;
  }

  /** Parse blocked-IP entries from list HTML */
  static parseAll(site: Site, html: string): IpBlock[] {
    const $ = cheerio.load(html);
    const blocks: IpBlock[] = [];

    $('table tr').each((_i, row) => {
      const $row = $(row);
      const $link = $row.find('a[onclick*="deleteBlock"]');
      if ($link.length === 0) {
        return;
      }

      const onclick = $link.attr('onclick') ?? '';
      const match = onclick.match(DELETE_BLOCK_ID_RE);
      if (!match?.[1]) {
        return;
      }
      const blockId = Number.parseInt(match[1], 10);

      const cells = $row.find('td');
      if (cells.length === 0) {
        return;
      }
      const ip = $(cells[0]).text().trim();
      const reason =
        cells.length > 1
          ? $(cells[cells.length - 1])
              .text()
              .trim()
          : '';

      blocks.push(new IpBlock({ site, blockId, ip, reason }));
    });

    return blocks;
  }
}
