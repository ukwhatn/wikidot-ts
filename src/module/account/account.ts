/**
 * The logged-in user's Wikidot account (`www.wikidot.com/account/settings`)
 *
 * Account-level settings and profile operations that are distinct from any single
 * site: password/email/language, private message receive preferences, forum
 * signature, avatar, and API key management.
 *
 * All requests here go through `client.amcClient.request()`, which defaults to
 * `www.wikidot.com` -- never a site's own host.
 *
 * Ported from wikidot.py's `module/account.py`; see that file's docstrings for the
 * wire-format research this is based on
 * (`.local/memory/260728_wikidot-ajax-modules/70_account.md`).
 */

import * as cheerio from 'cheerio';
import {
  LoginRequiredError,
  NoElementError,
  UnexpectedError,
  WikidotError,
} from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { checkbox, flag, jsonParam, omitFalsy, requireBody } from '../../connector';
import type { AMCRequestBody, AMCResponse } from '../../connector/amc-types';
import { parseOdate } from '../../util/parser';
import type { Client } from '../client';
import type { AbstractUser } from '../user';

/** `from` values accepted by DashboardSettingsAction/saveReceiveMessages */
export type PrivateMessageReceiveFrom = 'a' | 'mf' | 'f' | 'n';

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

/**
 * Run an action requiring login, wrapping the result/error into a WikidotResultAsync
 * @param client - Client instance
 * @param action - Async action to run once login is confirmed
 * @param wrapError - Maps a caught error to a WikidotError (WikidotError instances pass through unchanged)
 * @returns Result of the action
 */
function withLogin<T>(
  client: Client,
  action: () => Promise<T>,
  wrapError: (error: unknown) => WikidotError
): WikidotResultAsync<T> {
  const loginResult = client.requireLogin();
  if (loginResult.isErr()) {
    return fromPromise(
      Promise.reject(loginResult.error),
      () => new LoginRequiredError('Login required')
    );
  }
  return fromPromise(action(), (error) =>
    error instanceof WikidotError ? error : wrapError(error)
  );
}

/**
 * Operations on `DashboardSettingsAction` and `dashboard/settings/*`
 *
 * Covers account-wide settings: password, email, language, private message receive
 * preferences and block list, toolbars, digest/newsletter/invitation subscriptions,
 * API key, and Facebook link. Access through `client.account.settings`.
 *
 * `saveReceiveMessages` / `blockUser` / `deleteBlock` live under this action
 * namespace even though they are about private messages: Wikidot groups all of
 * DashboardSettingsAction here regardless of topic, so this class owns them instead
 * of PrivateMessageAccessor.
 */
export class AccountSettings {
  constructor(private readonly client: Client) {}

  private request(event: string, params: AMCRequestBody = {}): WikidotResultAsync<AMCResponse> {
    return withLogin(
      this.client,
      async () => {
        const result = await this.client.amcClient.request([
          { action: 'DashboardSettingsAction', event, moduleName: 'Empty', ...params },
        ]);
        if (result.isErr()) throw result.error;
        const response = result.value[0];
        if (!response) throw new UnexpectedError('Empty response');
        return response;
      },
      (error) => new UnexpectedError(`DashboardSettingsAction/${event} failed: ${String(error)}`)
    );
  }

  private fetchModule(moduleName: string): WikidotResultAsync<string> {
    return withLogin(
      this.client,
      async () => {
        const result = await this.client.amcClient.request([{ moduleName }]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], moduleName);
      },
      (error) => new UnexpectedError(`Failed to fetch ${moduleName}: ${String(error)}`)
    );
  }

  /**
   * Set who is allowed to send you private messages
   * @param from - "a" = all registered users, "mf" = co-members + contacts, "f" = contacts only, "n" = nobody
   */
  setReceiveMessages(from: PrivateMessageReceiveFrom): WikidotResultAsync<void> {
    return this.request('saveReceiveMessages', { from }).map(() => undefined);
  }

  /**
   * Add a user to the private message block list
   * @param user - User to block
   */
  blockUser(user: AbstractUser): WikidotResultAsync<void> {
    return this.request('blockUser', { userId: user.id }).map(() => undefined);
  }

  /**
   * Remove a user from the private message block list
   * @param user - User to unblock
   */
  unblockUser(user: AbstractUser): WikidotResultAsync<void> {
    return this.request('deleteBlock', { userId: user.id }).map(() => undefined);
  }

  /**
   * Start the two-step email change flow (step 1). Wikidot sends a confirmation code
   * to the new address; complete the change with confirmEmailChange(evercode)
   * @param email - New email address
   */
  startEmailChange(email: string): WikidotResultAsync<void> {
    return this.request('changeEmail1', { email }).map(() => undefined);
  }

  /**
   * Complete the two-step email change flow (step 2)
   * @param evercode - Confirmation code received by email
   */
  confirmEmailChange(evercode: string): WikidotResultAsync<void> {
    return this.request('changeEmail2', { evercode }).map(() => undefined);
  }

  /**
   * Change the account password
   * @param oldPassword - Current password
   * @param newPassword - New password (sent twice as new_password1/new_password2, matching form(change-password-form))
   */
  changePassword(oldPassword: string, newPassword: string): WikidotResultAsync<void> {
    return this.request('changePassword', {
      old_password: oldPassword,
      new_password1: newPassword,
      new_password2: newPassword,
    }).map(() => undefined);
  }

  /**
   * Set the account UI language
   * @param language - Language code (e.g. "en", "ja")
   */
  setLanguage(language: string): WikidotResultAsync<void> {
    return this.request('saveLanguage', { language }).map(() => undefined);
  }

  /**
   * Set whether to receive the site activity digest email
   * @param receive - true to subscribe, false to unsubscribe
   */
  setReceiveDigest(receive: boolean): WikidotResultAsync<void> {
    return this.request(
      'saveReceiveDigest',
      omitFalsy({ receive: receive ? 'yes' : undefined })
    ).map(() => undefined);
  }

  /**
   * Set whether to receive the Wikidot newsletter
   * @param receive - true to subscribe, false to unsubscribe
   */
  setReceiveNewsletter(receive: boolean): WikidotResultAsync<void> {
    return this.request(
      'saveReceiveNewsletter',
      omitFalsy({ receive: receive ? 'yes' : undefined })
    ).map(() => undefined);
  }

  /**
   * Set whether to receive site invitations
   * @param receive - true to allow invitations, false to block them
   */
  setReceiveInvitations(receive: boolean): WikidotResultAsync<void> {
    return this.request('saveReceiveInvitations', omitFalsy({ receive: flag(receive) })).map(
      () => undefined
    );
  }

  /**
   * Set which editor toolbars are shown.
   *
   * This is DashboardSettingsAction/saveToolbarsPref (account-wide editor
   * preference). Do not confuse it with ManageSiteAction/saveToolbarsPref, a
   * same-named event on a per-site settings action.
   * @param top - Show the top toolbar
   * @param bottom - Show the bottom toolbar
   */
  setToolbars(top = false, bottom = false): WikidotResultAsync<void> {
    return this.request(
      'saveToolbarsPref',
      omitFalsy({ toolbarTop: checkbox(top), toolbarBottom: checkbox(bottom) })
    ).map(() => undefined);
  }

  /**
   * Regenerate the account's API key
   * @param readOnly - true to generate a read-only key. Any other value (including omission) generates a
   * read-write key; only the literal "r" means read-only on the wire
   * @returns The newly generated API key
   */
  generateApiKey(readOnly = false): WikidotResultAsync<string> {
    return this.request('generateApiKey', { type: readOnly ? 'r' : 'w' }).map(
      (response) => response.newKey as string
    );
  }

  /**
   * Link the account with a Facebook account
   * @param fbUser - Facebook user object, sent using bracket notation (e.g. fbUser[id]=..., fbUser[name]=...)
   * @returns The "fbaccount" field of the response
   */
  connectFacebook(fbUser: Record<string, unknown>): WikidotResultAsync<Record<string, unknown>> {
    return this.request('connectWithFacebook', { fbUser }).map(
      (response) => response.fbaccount as Record<string, unknown>
    );
  }

  /**
   * Unlink the account from Facebook
   */
  disconnectFacebook(): WikidotResultAsync<void> {
    return this.request('disconnectWithFacebook').map(() => undefined);
  }

  // ------------------------------------------------------------------
  // Raw module fetches (dashboard/settings/*)
  //
  // These mirror the tabs of the /account/settings dashboard and exist for
  // completeness with the module catalog; most of their state is more
  // conveniently read/written through the action methods above. They return the
  // raw rendered HTML body rather than a parsed structure, since only the
  // request/response envelope (not per-tab markup) was measured during the
  // investigation.
  // ------------------------------------------------------------------

  /** Fetch the raw HTML of dashboard/settings/DSAccountModule (`#/account`) */
  getAccountHtml(): WikidotResultAsync<string> {
    return this.fetchModule('dashboard/settings/DSAccountModule');
  }

  /** Fetch the raw HTML of dashboard/settings/DSAboutModule (`#/about`) */
  getAboutHtml(): WikidotResultAsync<string> {
    return this.fetchModule('dashboard/settings/DSAboutModule');
  }

  /** Fetch the raw HTML of dashboard/settings/DSForumSignatureModule (`#/forumsignature`) */
  getForumSignatureHtml(): WikidotResultAsync<string> {
    return this.fetchModule('dashboard/settings/DSForumSignatureModule');
  }

  /** Fetch the raw HTML of dashboard/settings/DSToolbarsModule (`#/toolbars`) */
  getToolbarsHtml(): WikidotResultAsync<string> {
    return this.fetchModule('dashboard/settings/DSToolbarsModule');
  }

  /** Fetch the raw HTML of dashboard/settings/DSNewsletterModule (`#/newsletter`) */
  getNewsletterHtml(): WikidotResultAsync<string> {
    return this.fetchModule('dashboard/settings/DSNewsletterModule');
  }

  /**
   * Fetch the raw HTML of dashboard/settings/DSMessagesModule (`#/messages`).
   *
   * This is also the module used to re-render the PM settings tab after
   * setReceiveMessages()/blockUser()/unblockUser(). Do not confuse with
   * dashboard/messages/DMSettingsModule (the `/account/messages#/settings` tab),
   * which is a different module that renders the same UI from the messages hub and
   * returned an empty body when measured.
   */
  getMessagesHtml(): WikidotResultAsync<string> {
    return this.fetchModule('dashboard/settings/DSMessagesModule');
  }

  /** Fetch the raw HTML of dashboard/settings/DSInvitationsModule (`#/invitations`) */
  getInvitationsHtml(): WikidotResultAsync<string> {
    return this.fetchModule('dashboard/settings/DSInvitationsModule');
  }

  /** Fetch the raw HTML of dashboard/settings/DSFacebookModule (`#/facebook`) */
  getFacebookHtml(): WikidotResultAsync<string> {
    return this.fetchModule('dashboard/settings/DSFacebookModule');
  }

  /**
   * Fetch the raw HTML of dashboard/settings/DSVisibilityModule (`#/visibility`).
   *
   * Unmeasured: in the investigation this module returned status "no_permission"
   * for a non-Pro account, so its availability on free accounts is unconfirmed.
   */
  getVisibilityHtml(): WikidotResultAsync<string> {
    return this.fetchModule('dashboard/settings/DSVisibilityModule');
  }

  /** Fetch the raw HTML of dashboard/settings/DSApiModule (`#/api`) */
  getApiHtml(): WikidotResultAsync<string> {
    return this.fetchModule('dashboard/settings/DSApiModule');
  }
}

/**
 * Fields accepted by AccountProfile.saveAbout (form(dp-about-form))
 */
export interface SaveAboutFields {
  realName?: string;
  gender?: 'm' | 'f';
  birthdayDay?: string;
  birthdayMonth?: string;
  birthdayYear?: string;
  /**
   * Free-text bio. The web form caps this at 200 characters; this method does not
   * enforce that client-side, so an over-length value surfaces as a FormErrorsError
   * from the server
   */
  about?: string;
  website?: string;
  imAim?: string;
  imGaduGadu?: string;
  imGoogleTalk?: string;
  imIcq?: string;
  imJabber?: string;
  imMsn?: string;
  imYahoo?: string;
  location?: string;
}

/**
 * Operations on `DashboardProfileAction`
 *
 * Covers the public profile: display name, "about" bio, forum signature, profile
 * visibility, and avatar. Access through `client.account.profile`.
 */
export class AccountProfile {
  constructor(private readonly client: Client) {}

  private request(event: string, params: AMCRequestBody = {}): WikidotResultAsync<AMCResponse> {
    return withLogin(
      this.client,
      async () => {
        const result = await this.client.amcClient.request([
          { action: 'DashboardProfileAction', event, moduleName: 'Empty', ...params },
        ]);
        if (result.isErr()) throw result.error;
        const response = result.value[0];
        if (!response) throw new UnexpectedError('Empty response');
        return response;
      },
      (error) => new UnexpectedError(`DashboardProfileAction/${event} failed: ${String(error)}`)
    );
  }

  /**
   * Change the account's display (screen) name
   * @param screenName - New display name
   */
  changeScreenName(screenName: string): WikidotResultAsync<void> {
    return this.request('changeScreenName', { screenName }).map(() => undefined);
  }

  /**
   * Save the "about" section of the profile (form(dp-about-form))
   * @param fields - About-page fields. Unset fields are omitted (matches an unfilled form field)
   */
  saveAbout(fields: SaveAboutFields = {}): WikidotResultAsync<void> {
    return this.request(
      'saveAbout',
      omitFalsy({
        real_name: fields.realName,
        gender: fields.gender,
        birthday_day: fields.birthdayDay,
        birthday_month: fields.birthdayMonth,
        birthday_year: fields.birthdayYear,
        about: fields.about,
        website: fields.website,
        im_aim: fields.imAim,
        im_gadu_gadu: fields.imGaduGadu,
        im_google_talk: fields.imGoogleTalk,
        im_icq: fields.imIcq,
        im_jabber: fields.imJabber,
        im_msn: fields.imMsn,
        im_yahoo: fields.imYahoo,
        location: fields.location,
      })
    ).map(() => undefined);
  }

  /**
   * Save the forum post signature. The web form caps this at 400 characters; this
   * method does not enforce that client-side, so an over-length value surfaces as a
   * FormErrorsError from the server
   * @param source - Signature source (Wikidot markup)
   */
  saveForumSignature(source: string): WikidotResultAsync<void> {
    return this.request('saveForumSignature', { source }).map(() => undefined);
  }

  /**
   * Render a preview of a forum signature without saving it
   * @param source - Signature source to preview
   * @returns Rendered HTML preview
   */
  previewForumSignature(source: string): WikidotResultAsync<string> {
    return withLogin(
      this.client,
      async () => {
        const result = await this.client.amcClient.request([
          { moduleName: 'dashboard/settings/DSForumSignaturePreviewModule', source },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'dashboard/settings/DSForumSignaturePreviewModule');
      },
      (error) => new UnexpectedError(`Failed to preview forum signature: ${String(error)}`)
    );
  }

  /**
   * Save profile visibility settings (form(ap-provilev-form)).
   *
   * Unmeasured: dashboard/settings/DSVisibilityModule returned status
   * "no_permission" for a non-Pro account during the investigation, so the field
   * names of ap-provilev-form (note: "provilev" is the site's own typo, not
   * corrected here) could not be captured. Pass the exact field names/values as
   * sent by the real form.
   * @param rawFields - Raw form fields to send as-is
   */
  saveProfileVisibility(
    rawFields: Record<string, AMCRequestBody[string]>
  ): WikidotResultAsync<void> {
    return this.request('saveProfileVisibility', rawFields).map(() => undefined);
  }

  /**
   * Delete the account's avatar image
   */
  deleteAvatar(): WikidotResultAsync<void> {
    return this.request('deleteAvatar').map(() => undefined);
  }

  /**
   * Set the account's avatar from an image URL
   * @param uri - URL of the image to use as the new avatar
   * @returns Response containing "status", "im48", "im16" (avatar URLs at each size)
   */
  uploadAvatarFromUri(
    uri: string
  ): WikidotResultAsync<{ status: unknown; im48: unknown; im16: unknown }> {
    return this.request('uploadAvatarUri', { uri }).map((response) => ({
      status: response.status,
      im48: response.im48,
      im16: response.im16,
    }));
  }
}

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
 * A row of the account's own recent page edits (userinfo/UserChangesListModule)
 *
 * Nearly identical in structure to SiteChange (page/site-change.ts's
 * changes/SiteChangesListModule row), with a site column added since this view
 * spans every site the account belongs to (measured 2026-07-29, see the sibling
 * wikidot.py repo's `.local/memory/260728_wikidot-ajax-modules/70_account.md`,
 * "一覧モジュールの行マークアップ").
 */
export class UserChange {
  public readonly client: Client;
  /** Title of the site the change occurred on (td.site > a) */
  public readonly siteTitle: string;
  /** URL of the site the change occurred on (td.site > a href) */
  public readonly siteUrl: string;
  public readonly pageFullname: string;
  public readonly pageTitle: string;
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
}

/**
 * A row of the account's own recent forum posts (userinfo/UserRecentPostsListModule)
 *
 * Row markup was measured 2026-07-29 (see the sibling wikidot.py repo's
 * `.local/memory/260728_wikidot-ajax-modules/70_account.md`, "一覧モジュールの
 * 行マークアップ"): each row is `div.post`, with
 * `div.long > div.head > div.title > a` (title/link), `div.info > span.odate`
 * (date), and `div.content` (post text).
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

  constructor(data: RecentPostData) {
    this.client = data.client;
    this.title = data.title;
    this.url = data.url;
    this.createdAt = data.createdAt;
    this.content = data.content;
  }

  toString(): string {
    return `RecentPost(title=${this.title}, createdAt=${this.createdAt.toISOString()})`;
  }
}

/**
 * Operations on the `/account/recent` dashboard tab
 *
 * Covers the logged-in account's own recent page edits and forum posts, across all
 * sites it belongs to. Access through `client.account.recent`.
 */
export class AccountRecentActivity {
  private changesUserIdCache: number | null = null;
  private postsUserIdCache: number | null = null;

  constructor(private readonly client: Client) {}

  /**
   * Internal helper to fetch a hidden `userId` field from a shell module.
   *
   * `www.wikidot.com` pages do not expose `WIKIREQUEST.info.userId` (unlike a
   * site's own pages), and userinfo/UserChangesListModule /
   * userinfo/UserRecentPostsListModule respond with status "not_ok" and an empty
   * body if `userId` is omitted. The real UI reads it from a hidden input on the
   * shell module that renders the tab (userinfo/UserChangesModule /
   * userinfo/UserRecentPostsModule) before requesting the list module.
   * @param moduleName - Shell module to fetch
   * @param elementId - id of the hidden input holding the user ID
   * @returns The account's own user ID
   */
  private async fetchHiddenUserId(moduleName: string, elementId: string): Promise<number> {
    const result = await this.client.amcClient.request([{ moduleName }]);
    if (result.isErr()) throw result.error;
    const html = requireBody(result.value[0], moduleName);
    const $ = cheerio.load(html);
    const hidden = $(`#${elementId}`).first();
    if (hidden.length === 0) {
      throw new UnexpectedError(`Cannot find #${elementId} in ${moduleName}`);
    }
    const value = hidden.attr('value');
    if (value === undefined || !/^\d+$/.test(value)) {
      throw new UnexpectedError(`#${elementId} in ${moduleName} is not numeric: ${String(value)}`);
    }
    return Number.parseInt(value, 10);
  }

  private async changesUserId(): Promise<number> {
    if (this.changesUserIdCache === null) {
      this.changesUserIdCache = await this.fetchHiddenUserId(
        'userinfo/UserChangesModule',
        'changes-user-id'
      );
    }
    return this.changesUserIdCache;
  }

  private async postsUserId(): Promise<number> {
    if (this.postsUserIdCache === null) {
      this.postsUserIdCache = await this.fetchHiddenUserId(
        'userinfo/UserRecentPostsModule',
        'recent-posts-user-id'
      );
    }
    return this.postsUserIdCache;
  }

  /**
   * Get the account's own recent page edits, across all sites.
   *
   * Wraps userinfo/UserChangesListModule, fetching pages until exhausted or
   * `limit` is reached.
   * @param options - Filter flags. Keys must be a subset of RECENT_CHANGES_OPTION_KEYS; unlike
   * history/PageHistoryModule's options, there is no "tags" key here
   * @param limit - Maximum number of entries to retrieve. If omitted, retrieves all
   * @returns List of change history (in descending order by date)
   */
  getChanges(
    options?: Partial<Record<RecentChangesOptionKey, boolean>>,
    limit?: number
  ): WikidotResultAsync<UserChange[]> {
    if (options) {
      const allowed = new Set<string>(RECENT_CHANGES_OPTION_KEYS);
      const unknown = Object.keys(options).filter((key) => !allowed.has(key));
      if (unknown.length > 0) {
        return fromPromise(
          Promise.reject(
            new UnexpectedError(
              `Unknown options for userinfo/UserChangesListModule (no "tags" key here, unlike page-history options): ${unknown.join(', ')}`
            )
          ),
          (error) => error as WikidotError
        );
      }
    }

    return withLogin(
      this.client,
      async () => {
        const userId = await this.changesUserId();
        const perPage = limit !== undefined ? Math.min(limit, 1000) : 1000;

        const changes: UserChange[] = [];
        let pageNo = 1;

        while (true) {
          const result = await this.client.amcClient.request([
            {
              moduleName: 'userinfo/UserChangesListModule',
              page: pageNo,
              perpage: perPage,
              userId,
              ...omitFalsy({ options: options ? jsonParam(options) : undefined }),
            },
          ]);
          if (result.isErr()) throw result.error;
          const html = requireBody(result.value[0], 'userinfo/UserChangesListModule');
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
            const pageFullname = (titleElem.attr('href') ?? '').replace(/^\/|\/$/g, '');

            const odateElem = $item.find('td.mod-date span.odate').first();
            if (odateElem.length === 0) {
              throw new NoElementError('Odate element is not found.');
            }
            const changedAt = parseOdate(odateElem) ?? new Date(0);

            const revElem = $item.find('td.revision-no').first();
            if (revElem.length === 0) {
              throw new NoElementError('Revision number element is not found.');
            }
            const revMatch = revElem.text().match(/(\d+)/);
            if (!revMatch?.[1]) {
              throw new NoElementError('Revision number is not found.');
            }
            const revisionNo = Number.parseInt(revMatch[1], 10);

            const flags = $item
              .find('td.flags span.spantip')
              .toArray()
              .map((flagElem) => $(flagElem).text().trim());

            const siteElem = $item.find('td.site a').first();

            changes.push(
              new UserChange({
                client: this.client,
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

          if (reachedLimit) break;

          const pager = $('div.pager').first();
          if (pager.length === 0) break;
          const pagerLinks = pager.find('a');
          if (pagerLinks.length < 2) break;
          const lastPage = Number.parseInt(
            $(pagerLinks[pagerLinks.length - 2])
              .text()
              .trim(),
            10
          );
          if (pageNo >= lastPage) break;
          pageNo += 1;
        }

        return changes;
      },
      (error) => new UnexpectedError(`Failed to fetch recent changes: ${String(error)}`)
    );
  }

  /**
   * Get the account's own recent forum posts, across all sites.
   *
   * Wraps userinfo/UserRecentPostsListModule, fetching pages until exhausted or
   * `limit` is reached.
   * @param limit - Maximum number of entries to retrieve. If omitted, retrieves all
   * @returns List of recent posts (in descending order by date)
   */
  getPosts(limit?: number): WikidotResultAsync<RecentPost[]> {
    return withLogin(
      this.client,
      async () => {
        const userId = await this.postsUserId();

        const posts: RecentPost[] = [];
        let pageNo = 1;

        while (true) {
          const result = await this.client.amcClient.request([
            { moduleName: 'userinfo/UserRecentPostsListModule', page: pageNo, userId },
          ]);
          if (result.isErr()) throw result.error;
          const html = requireBody(result.value[0], 'userinfo/UserRecentPostsListModule');
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

            const odateElem = $item.find('div.info span.odate').first();
            const contentElem = $item.find('div.content').first();

            posts.push(
              new RecentPost({
                client: this.client,
                title: titleElem.text().trim(),
                url: titleElem.attr('href') ?? '',
                createdAt:
                  odateElem.length > 0 ? (parseOdate(odateElem) ?? new Date(0)) : new Date(0),
                content: contentElem.length > 0 ? contentElem.text().trim() : '',
              })
            );

            if (limit !== undefined && posts.length >= limit) {
              reachedLimit = true;
            }
          });

          if (reachedLimit) break;

          const pager = $('div.pager').first();
          if (pager.length === 0) break;
          const pagerLinks = pager.find('a');
          if (pagerLinks.length < 2) break;
          const lastPage = Number.parseInt(
            $(pagerLinks[pagerLinks.length - 2])
              .text()
              .trim(),
            10
          );
          if (pageNo >= lastPage) break;
          pageNo += 1;
        }

        return posts;
      },
      (error) => new UnexpectedError(`Failed to fetch recent posts: ${String(error)}`)
    );
  }
}
