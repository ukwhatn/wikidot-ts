/**
 * The tabs of `www.wikidot.com/user:info/<unix>`, for any user
 *
 * Each tab is rendered by an ajax module on `www.wikidot.com` (measured
 * 2026-09-28): the Profile / Member of / Admin of / Moderator of shells take
 * `user_id`, while the list modules behind "Recent contributions" and "Recent
 * posts and comments" (userinfo/UserChangesListModule /
 * userinfo/UserRecentPostsListModule) take `userId` and accept another user's id
 * directly. None of them requires login. A nonexistent user id makes every
 * module respond with HTTP 500 and an empty body, surfaced as the AMC error.
 *
 * Shared by `User` (any user) and `AccountRecentActivity` (the logged-in
 * account, which reads its own id from the shell module first).
 */

import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { NoElementError, UnexpectedError } from '../../common/errors';
import { jsonParam, omitFalsy, requireBody } from '../../connector';
import type { AMCRequestBody } from '../../connector/amc-types';
import { parseOdate } from '../../util/parser';
import type { Client } from '../client';

/**
 * Option keys accepted by userinfo/UserChangesListModule's `options` JSON.
 * Unlike the page-history version (history/PageHistoryModule), there is no "tags" key.
 */
export const RECENT_CHANGES_OPTION_KEYS = [
  'all',
  'source',
  'title',
  'move',
  'files',
  'new',
  'meta',
] as const;

/** Valid key in {@link RECENT_CHANGES_OPTION_KEYS} */
export type RecentChangesOptionKey = (typeof RECENT_CHANGES_OPTION_KEYS)[number];

/** Filter flags for userinfo/UserChangesListModule */
export type RecentChangesOptions = Partial<Record<RecentChangesOptionKey, boolean>>;

/** user:info shell modules that list sites (`dl > dt` per site) */
export type UserSiteListModule =
  | 'userinfo/UserInfoMemberOfModule'
  | 'userinfo/UserInfoAdminOfModule'
  | 'userinfo/UserInfoModeratorOfModule';

/** Data backing a {@link UserChange} */
export interface UserChangeData {
  client: Client;
  siteTitle: string;
  siteUrl: string;
  pageFullname: string;
  pageTitle: string;
  revisionNo: number;
  changedAt: Date;
  flags: string[];
}

/**
 * A row of a user's recent page edits (userinfo/UserChangesListModule)
 *
 * Nearly identical in structure to SiteChange (page/site-change.ts's
 * changes/SiteChangesListModule row), with a site column added since this view
 * spans every site the user belongs to (measured 2026-07-29, see the sibling
 * wikidot.py repo's `.local/memory/260728_wikidot-ajax-modules/70_account.md`,
 * "一覧モジュールの行マークアップ").
 */
export class UserChange {
  public readonly client: Client;
  /** Title of the site the change occurred on (td.site > a) */
  public readonly siteTitle: string;
  /** URL of the site the change occurred on (td.site > a href) */
  public readonly siteUrl: string;
  /** Page name, taken from the path of td.title > a href (e.g. "component:scp-173") */
  public readonly pageFullname: string;
  public readonly pageTitle: string;
  /** Revision number (td.revision-no); 0 for a page-creation row shown as "(new)" */
  public readonly revisionNo: number;
  public readonly changedAt: Date;
  /** "N"=new, "S"=source change, "T"=title change, "R"=rename, "M"=move, "F"=file, "A"=delete */
  public readonly flags: string[];

  constructor(data: UserChangeData) {
    this.client = data.client;
    this.siteTitle = data.siteTitle;
    this.siteUrl = data.siteUrl;
    this.pageFullname = data.pageFullname;
    this.pageTitle = data.pageTitle;
    this.revisionNo = data.revisionNo;
    this.changedAt = data.changedAt;
    this.flags = data.flags;
  }

  toString(): string {
    return `UserChange(siteTitle=${this.siteTitle}, pageFullname=${this.pageFullname}, revisionNo=${this.revisionNo})`;
  }
}

/** Data backing a {@link RecentPost} */
export interface RecentPostData {
  client: Client;
  title: string;
  url: string;
  createdAt: Date;
  content: string;
  postId?: number | null;
  siteTitle?: string | null;
  siteUrl?: string | null;
  threadTitle?: string | null;
  threadUrl?: string | null;
}

/**
 * A row of a user's recent forum posts (userinfo/UserRecentPostsListModule)
 *
 * Each row is `div.post#post-<id>`, with `div.long > div.head > div.title > a`
 * (title/link), `div.info > span.odate` (date), the text nodes "on site" /
 * "in discussion:" in `div.info` each followed by a link (site / thread), and
 * `div.content` (post text). Measured 2026-07-29 and 2026-09-28.
 */
export class RecentPost {
  public readonly client: Client;
  /** Post/thread title (div.title > a) */
  public readonly title: string;
  /** Link to the post (div.title > a href) */
  public readonly url: string;
  public readonly createdAt: Date;
  /** Post text (div.content) */
  public readonly content: string;
  /** Post ID (from the row's `post-<id>` id attribute) */
  public readonly postId: number | null;
  /** Title of the site the post belongs to (the link after "on site") */
  public readonly siteTitle: string | null;
  /** URL of the site the post belongs to */
  public readonly siteUrl: string | null;
  /** Title of the thread the post belongs to (the link after "in discussion:") */
  public readonly threadTitle: string | null;
  /** URL of the thread the post belongs to */
  public readonly threadUrl: string | null;

  constructor(data: RecentPostData) {
    this.client = data.client;
    this.title = data.title;
    this.url = data.url;
    this.createdAt = data.createdAt;
    this.content = data.content;
    this.postId = data.postId ?? null;
    this.siteTitle = data.siteTitle ?? null;
    this.siteUrl = data.siteUrl ?? null;
    this.threadTitle = data.threadTitle ?? null;
    this.threadUrl = data.threadUrl ?? null;
  }

  toString(): string {
    return `RecentPost(title=${this.title}, createdAt=${this.createdAt.toISOString()})`;
  }
}

/** Data backing a {@link UserProfile} */
export interface UserProfileData {
  client: Client;
  fields: Record<string, string>;
  realName: string | null;
  website: string | null;
  memberSince: Date | null;
  accountType: string | null;
  karmaLevel: string | null;
}

/**
 * The Profile tab of user:info (userinfo/UserInfoProfileModule)
 *
 * Built from the `dt`/`dd` pairs of `div.profile-box dl`. Which rows appear
 * varies by user, so every named field may be null; `fields` holds every row.
 */
export class UserProfile {
  public readonly client: Client;
  /** Every row, keyed by the dt text without its trailing ":" (value: whitespace-normalized dd text) */
  public readonly fields: Record<string, string>;
  /** "Real name" row */
  public readonly realName: string | null;
  /** "Website" row (the link's href, or the text if there is no link) */
  public readonly website: string | null;
  /** "Wikidot user since" row */
  public readonly memberSince: Date | null;
  /** "Account type" row (e.g. "free") */
  public readonly accountType: string | null;
  /** First word of the "Karma level" row (e.g. "high") */
  public readonly karmaLevel: string | null;

  constructor(data: UserProfileData) {
    this.client = data.client;
    this.fields = data.fields;
    this.realName = data.realName;
    this.website = data.website;
    this.memberSince = data.memberSince;
    this.accountType = data.accountType;
    this.karmaLevel = data.karmaLevel;
  }

  toString(): string {
    return `UserProfile(realName=${this.realName}, accountType=${this.accountType}, karmaLevel=${this.karmaLevel})`;
  }
}

/** Data backing a {@link UserSiteEntry} */
export interface UserSiteEntryData {
  client: Client;
  title: string;
  url: string;
  subtitle: string | null;
  description: string | null;
}

/**
 * A site listed on the Member of / Admin of / Moderator of tabs of user:info
 * (`dl > dt > a` for the site, `dt > small > em` for the subtitle, and the
 * following `dd > small` for the description)
 */
export class UserSiteEntry {
  public readonly client: Client;
  /** Site name (dt > a) */
  public readonly title: string;
  /** Site URL (dt > a href) */
  public readonly url: string;
  /** Site subtitle (dt > small > em) */
  public readonly subtitle: string | null;
  /** Site description (dd > small); null when missing or empty */
  public readonly description: string | null;

  constructor(data: UserSiteEntryData) {
    this.client = data.client;
    this.title = data.title;
    this.url = data.url;
    this.subtitle = data.subtitle;
    this.description = data.description;
  }

  toString(): string {
    return `UserSiteEntry(title=${this.title}, url=${this.url})`;
  }
}

/**
 * Check `options` of userinfo/UserChangesListModule against RECENT_CHANGES_OPTION_KEYS
 * @param options - Filter flags to check
 * @returns An error naming the unknown keys, or null if every key is known
 */
export function validateRecentChangesOptions(
  options: RecentChangesOptions | undefined
): UnexpectedError | null {
  if (!options) return null;
  const allowed = new Set<string>(RECENT_CHANGES_OPTION_KEYS);
  const unknown = Object.keys(options).filter((key) => !allowed.has(key));
  if (unknown.length === 0) return null;
  return new UnexpectedError(
    `Unknown options for userinfo/UserChangesListModule (no "tags" key here, unlike page-history options): ${unknown.join(', ')}`
  );
}

/**
 * Whether the list has a page after `currentPage`.
 *
 * Reads the largest `updateList(<n>)` in the pager's onclick handlers: the last
 * page's pager only links back ("« previous", "1"), so the second-to-last link
 * text is not a page count.
 */
function hasNextPage($: cheerio.CheerioAPI, currentPage: number): boolean {
  const pager = $('div.pager').first();
  if (pager.length === 0) return false;
  let maxPage = 0;
  pager.find('a').each((_i, elem) => {
    const match = ($(elem).attr('onclick') ?? '').match(/updateList\((\d+)\)/);
    if (match?.[1]) {
      maxPage = Math.max(maxPage, Number.parseInt(match[1], 10));
    }
  });
  return maxPage > currentPage;
}

/**
 * Page name from a UserChangesListModule title link. The href is a full URL
 * (`https://scp-wiki.wikidot.com/scp-9418`), but a relative one
 * (`/component:scp-173`) gives the same shape of result.
 */
function pageFullnameFromHref(href: string): string {
  let path: string;
  try {
    path = new URL(href, 'https://www.wikidot.com').pathname;
  } catch {
    path = href;
  }
  return path.replace(/^\/+|\/+$/g, '');
}

/**
 * The element right after the direct-child text node of `$info` that ends with
 * `label`, if it is a link. The printuser span also contains links, so the
 * position relative to the label is what identifies the site / thread link.
 */
function linkAfterLabel(
  $: cheerio.CheerioAPI,
  $info: cheerio.Cheerio<AnyNode>,
  label: string
): cheerio.Cheerio<AnyNode> | null {
  const nodes = $info.contents().toArray();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node?.type !== 'text' || !node.data.trim().endsWith(label)) continue;
    for (let j = i + 1; j < nodes.length; j++) {
      const next = nodes[j];
      if (next?.type === 'text' && next.data.trim() === '') continue;
      if (next?.type === 'tag' && next.name === 'a') return $(next);
      return null;
    }
    return null;
  }
  return null;
}

async function fetchBody(
  client: Client,
  moduleName: string,
  params: AMCRequestBody
): Promise<string> {
  const result = await client.amcClient.request([{ moduleName, ...params }]);
  if (result.isErr()) throw result.error;
  return requireBody(result.value[0], moduleName);
}

/**
 * Fetch a user's recent page edits, across all sites, from userinfo/UserChangesListModule
 * @param client - Client
 * @param userId - Target user ID
 * @param options - Filter flags (validate with validateRecentChangesOptions beforehand)
 * @param limit - Maximum number of entries to retrieve. If omitted, retrieves all
 * @returns List of change history (in descending order by date)
 */
export async function fetchUserChanges(
  client: Client,
  userId: number,
  options?: RecentChangesOptions,
  limit?: number
): Promise<UserChange[]> {
  const moduleName = 'userinfo/UserChangesListModule';
  const perPage = limit !== undefined ? Math.min(limit, 1000) : 1000;
  const changes: UserChange[] = [];
  let pageNo = 1;

  while (true) {
    const html = await fetchBody(client, moduleName, {
      page: pageNo,
      perpage: perPage,
      userId,
      ...omitFalsy({ options: options ? jsonParam(options) : undefined }),
    });
    const $ = cheerio.load(html);
    const items = $('div.changes-list-item');
    if (items.length === 0) break;

    let reachedLimit = false;
    items.each((_i, elem) => {
      if (reachedLimit) return;
      const $item = $(elem);

      const titleElem = $item.find('td.title a').first();
      if (titleElem.length === 0) {
        throw new NoElementError('Title element is not found.');
      }
      const pageTitle = titleElem.text().trim();
      const pageFullname = pageFullnameFromHref(titleElem.attr('href') ?? '');

      const odateElem = $item.find('td.mod-date span.odate').first();
      if (odateElem.length === 0) {
        throw new NoElementError('Odate element is not found.');
      }
      const changedAt = parseOdate(odateElem) ?? new Date(0);

      const revElem = $item.find('td.revision-no').first();
      if (revElem.length === 0) {
        throw new NoElementError('Revision number element is not found.');
      }
      // A page-creation row shows "(new)" instead of "(rev. N)"
      const revText = revElem.text();
      const revMatch = revText.match(/(\d+)/);
      let revisionNo: number;
      if (revMatch?.[1]) {
        revisionNo = Number.parseInt(revMatch[1], 10);
      } else if (/\(new\)/.test(revText)) {
        revisionNo = 0;
      } else {
        throw new NoElementError('Revision number is not found.');
      }

      const flags = $item
        .find('td.flags span.spantip')
        .toArray()
        .map((flagElem) => $(flagElem).text().trim());

      const siteElem = $item.find('td.site a').first();

      changes.push(
        new UserChange({
          client,
          siteTitle: siteElem.length > 0 ? siteElem.text().trim() : '',
          siteUrl: siteElem.length > 0 ? (siteElem.attr('href') ?? '') : '',
          pageFullname,
          pageTitle,
          revisionNo,
          changedAt,
          flags,
        })
      );

      if (limit !== undefined && changes.length >= limit) {
        reachedLimit = true;
      }
    });

    if (reachedLimit || !hasNextPage($, pageNo)) break;
    pageNo += 1;
  }

  return changes;
}

/**
 * Fetch a user's recent forum posts, across all sites, from userinfo/UserRecentPostsListModule.
 * The module ignores `perpage` and always returns 20 posts per page.
 * @param client - Client
 * @param userId - Target user ID
 * @param limit - Maximum number of entries to retrieve. If omitted, retrieves all
 * @returns List of recent posts (in descending order by date)
 */
export async function fetchUserRecentPosts(
  client: Client,
  userId: number,
  limit?: number
): Promise<RecentPost[]> {
  const moduleName = 'userinfo/UserRecentPostsListModule';
  const posts: RecentPost[] = [];
  let pageNo = 1;

  while (true) {
    const html = await fetchBody(client, moduleName, { page: pageNo, userId });
    const $ = cheerio.load(html);
    const items = $('div.post');
    if (items.length === 0) break;

    let reachedLimit = false;
    items.each((_i, elem) => {
      if (reachedLimit) return;
      const $item = $(elem);

      const titleElem = $item.find('div.long div.head div.title a').first();
      if (titleElem.length === 0) {
        throw new NoElementError('Title element is not found.');
      }

      const infoElem = $item.find('div.info').first();
      const odateElem = infoElem.find('span.odate').first();
      const contentElem = $item.find('div.content').first();
      const siteElem = infoElem.length > 0 ? linkAfterLabel($, infoElem, 'on site') : null;
      const threadElem = infoElem.length > 0 ? linkAfterLabel($, infoElem, 'in discussion:') : null;
      const postIdMatch = ($item.attr('id') ?? '').match(/^post-(\d+)$/);

      posts.push(
        new RecentPost({
          client,
          title: titleElem.text().trim(),
          url: titleElem.attr('href') ?? '',
          createdAt: odateElem.length > 0 ? (parseOdate(odateElem) ?? new Date(0)) : new Date(0),
          content: contentElem.length > 0 ? contentElem.text().trim() : '',
          postId: postIdMatch?.[1] ? Number.parseInt(postIdMatch[1], 10) : null,
          siteTitle: siteElem ? siteElem.text().trim() : null,
          siteUrl: siteElem ? (siteElem.attr('href') ?? null) : null,
          threadTitle: threadElem ? threadElem.text().trim() : null,
          threadUrl: threadElem ? (threadElem.attr('href') ?? null) : null,
        })
      );

      if (limit !== undefined && posts.length >= limit) {
        reachedLimit = true;
      }
    });

    if (reachedLimit || !hasNextPage($, pageNo)) break;
    pageNo += 1;
  }

  return posts;
}

/**
 * Fetch a user's Profile tab from userinfo/UserInfoProfileModule
 * @param client - Client
 * @param userId - Target user ID
 * @returns The profile (every named field is null if its row is absent)
 */
export async function fetchUserProfile(client: Client, userId: number): Promise<UserProfile> {
  const html = await fetchBody(client, 'userinfo/UserInfoProfileModule', { user_id: userId });
  const $ = cheerio.load(html);

  // Every existing user's profile has the box (a nonexistent id is HTTP 500), so
  // its absence means the markup changed; fail instead of returning an empty profile
  const box = $('div.profile-box').first();
  if (box.length === 0) {
    throw new NoElementError('Profile box is not found.');
  }

  const fields: Record<string, string> = {};
  const ddByKey = new Map<string, cheerio.Cheerio<AnyNode>>();
  box.find('dl dt').each((_i, elem) => {
    const $dt = $(elem);
    const $dd = $dt.next('dd');
    if ($dd.length === 0) return;
    const key = $dt.text().trim().replace(/:$/, '').trim();
    fields[key] = $dd.text().replace(/\s+/g, ' ').trim();
    ddByKey.set(key, $dd);
  });

  const websiteDd = ddByKey.get('Website');
  const websiteLink = websiteDd?.find('a').first();
  const memberSinceOdate = ddByKey.get('Wikidot user since')?.find('span.odate').first();
  const karmaWord = fields['Karma level']?.split(' ')[0];

  return new UserProfile({
    client,
    fields,
    realName: fields['Real name'] ?? null,
    website:
      websiteLink && websiteLink.length > 0
        ? (websiteLink.attr('href') ?? null)
        : (fields.Website ?? null),
    memberSince:
      memberSinceOdate && memberSinceOdate.length > 0 ? parseOdate(memberSinceOdate) : null,
    accountType: fields['Account type'] ?? null,
    karmaLevel: karmaWord ? karmaWord : null,
  });
}

/**
 * Fetch the sites listed on a Member of / Admin of / Moderator of tab
 * @param client - Client
 * @param userId - Target user ID
 * @param moduleName - The tab's shell module
 * @returns Listed sites (empty if the tab has no `dl`, e.g. "This user is not a moderator of any site.")
 */
export async function fetchUserSites(
  client: Client,
  userId: number,
  moduleName: UserSiteListModule
): Promise<UserSiteEntry[]> {
  const html = await fetchBody(client, moduleName, { user_id: userId });
  const $ = cheerio.load(html);

  return $('dl > dt')
    .toArray()
    .map((elem) => {
      const $dt = $(elem);
      const link = $dt.children('a').first();
      if (link.length === 0) {
        throw new NoElementError('Site link element is not found.');
      }
      const subtitleElem = $dt.children('small').children('em').first();
      const description = $dt.next('dd').find('small').first().text().trim();
      return new UserSiteEntry({
        client,
        title: link.text().trim(),
        url: link.attr('href') ?? '',
        subtitle: subtitleElem.length > 0 ? subtitleElem.text().trim() : null,
        description: description !== '' ? description : null,
      });
    });
}
