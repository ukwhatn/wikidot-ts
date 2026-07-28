import * as cheerio from 'cheerio';
import { RequireLogin } from '../../../common/decorators';
import {
  LoginRequiredError,
  TargetError,
  UnexpectedError,
  type WikidotError,
  WikidotStatusError,
} from '../../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../../common/types';
import { checkbox, flag, jsonParam, omitFalsy } from '../../../connector/amc-body';
import { requireBody } from '../../../connector/amc-client';
import type { AMCRequestBody } from '../../../connector/amc-types';
import { type QMCUser, QuickModule } from '../../../util/quick-module';
import type { User } from '../../user/user';
import type { Site } from '../site';
import { SiteApplication } from '../site-application';
import { IpBlock, UserBlock } from '../site-block';
import { SiteMember } from '../site-member';

/** Accepts a user object, or a raw user id, wherever a member is referenced */
type UserOrId = User | number;

function toId(user: UserOrId): number {
  return typeof user === 'number' ? user : user.id;
}

/** A single result row from `users/UserSearchModule` */
export interface UserSearchResult {
  id: number;
  name: string;
}

/**
 * Site member operations accessor. Access through `Site.member`.
 *
 * Groups administrative operations that require site-admin permissions:
 * removing/promoting/demoting members, moderator permissions, invitations,
 * membership-application handling (delegated to SiteApplication, unchanged),
 * members auto-watching, abuse-flag clearing, and user/IP blocks (see
 * site-block.ts for the underlying parsing).
 */
export class MemberAccessor {
  public readonly site: Site;

  constructor(site: Site) {
    this.site = site;
  }

  /**
   * Get all members
   * @returns Member list
   */
  getAll(): WikidotResultAsync<SiteMember[]> {
    return SiteMember.getMembers(this.site, '');
  }

  /**
   * Get moderator list
   * @returns Moderator list
   */
  getModerators(): WikidotResultAsync<SiteMember[]> {
    return SiteMember.getMembers(this.site, 'moderators');
  }

  /**
   * Get admin list
   * @returns Admin list
   */
  getAdmins(): WikidotResultAsync<SiteMember[]> {
    return SiteMember.getMembers(this.site, 'admins');
  }

  /**
   * Get pending membership applications
   * @returns Application list
   */
  getApplications(): WikidotResultAsync<SiteApplication[]> {
    return SiteApplication.acquireAll(this.site);
  }

  /**
   * Search members
   * @param query - Search query (part of username)
   * @returns Matched user list (QMCUser format)
   */
  lookup(query: string): WikidotResultAsync<QMCUser[]> {
    return QuickModule.memberLookup(this.site.id, query);
  }

  /**
   * Invite user to site
   * @param user - User to invite
   * @param text - Invitation message
   */
  @RequireLogin
  invite(user: User, text: string): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            action: 'ManageSiteMembershipAction',
            event: 'inviteMember',
            user_id: user.id,
            text,
            moduleName: 'Empty',
          },
        ]);
        if (result.isErr()) {
          const error = result.error;
          if (error instanceof WikidotStatusError) {
            if (error.statusCode === 'already_invited') {
              throw new TargetError(
                `User is already invited to ${this.site.unixName}: ${user.name}`
              );
            }
            if (error.statusCode === 'already_member') {
              throw new TargetError(
                `User is already a member of ${this.site.unixName}: ${user.name}`
              );
            }
          }
          throw error;
        }
      })(),
      (error) => {
        if (error instanceof TargetError || error instanceof LoginRequiredError) {
          return error;
        }
        return new UnexpectedError(`Failed to invite user: ${String(error)}`);
      }
    );
  }

  // ------------------------------------------------------------------
  // Task 2-1: admin-view member listing (paginated)
  // ------------------------------------------------------------------

  /**
   * Internal helper: fetch a paginated `managesite/members/*` listing.
   *
   * **Row markup is not directly measured** for this project's research (the
   * test site's admin panel HTML was not captured; only the client-side JS
   * handlers were). Reuses the same `table tr` / `span.printuser` /
   * `div.pager` parsing already validated for the public-facing
   * `membership/MembersListModule` (`SiteMember.parse`), since Wikidot's
   * server templates consistently render member rows through the shared
   * `WIKIDOT.render.printuser` partial across contexts (also true of the
   * admin block lists, see site-block.ts). Verify against a live admin
   * panel before depending on this for anything beyond user identity (e.g.
   * exact join-date semantics).
   */
  private getPaginated(moduleName: string): WikidotResultAsync<SiteMember[]> {
    return fromPromise(
      (async () => {
        const members: SiteMember[] = [];

        const firstResult = await this.site.amcRequest([{ moduleName, page: 1 }]);
        if (firstResult.isErr()) {
          throw firstResult.error;
        }
        const firstResponse = firstResult.value[0];
        if (!firstResponse) {
          throw new UnexpectedError('Empty response');
        }
        const firstHtml = requireBody(firstResponse, moduleName);
        members.push(...SiteMember.parse(this.site, firstHtml));

        const $first = cheerio.load(firstHtml);
        const pagerLinks = $first('div.pager a');
        if (pagerLinks.length < 2) {
          return members;
        }
        const lastPageText = $first(pagerLinks[pagerLinks.length - 2])
          .text()
          .trim();
        const lastPage = Number.parseInt(lastPageText, 10) || 1;
        if (lastPage <= 1) {
          return members;
        }

        const bodies: AMCRequestBody[] = [];
        for (let page = 2; page <= lastPage; page++) {
          bodies.push({ moduleName, page });
        }
        const additionalResults = await this.site.amcRequest(bodies);
        if (additionalResults.isErr()) {
          throw additionalResults.error;
        }
        for (const response of additionalResults.value) {
          const html = requireBody(response, moduleName);
          members.push(...SiteMember.parse(this.site, html));
        }

        return members;
      })(),
      (error) => error as WikidotError
    );
  }

  /**
   * Get the admin-panel view of all site members.
   *
   * Uses `managesite/members/ManageSiteMembersListModule`, distinct from
   * `getAll()` (public `membership/MembersListModule`): this is the view
   * rendered inside `_admin`, requires site-admin permissions, and is what
   * Wikidot's own client re-fetches after remove/promote/demote actions to
   * refresh the panel.
   */
  getMembersAdminView(): WikidotResultAsync<SiteMember[]> {
    return this.getPaginated('managesite/members/ManageSiteMembersListModule');
  }

  /** Get the admin-panel view of site moderators */
  getModeratorsAdminView(): WikidotResultAsync<SiteMember[]> {
    return this.getPaginated('managesite/members/ManageSiteModeratorsModule');
  }

  /** Get the admin-panel view of site administrators */
  getAdminsAdminView(): WikidotResultAsync<SiteMember[]> {
    return this.getPaginated('managesite/members/ManageSiteAdminsModule');
  }

  // ------------------------------------------------------------------
  // Task 2-2: member removal / ownership transfer / moderator perms
  // ------------------------------------------------------------------

  /** Internal: fire-and-forget action helper, mirroring settings-accessor's simpleAction */
  private simpleAction(body: AMCRequestBody): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequestSingle({ moduleName: 'Empty', ...body });
        if (result.isErr()) {
          throw result.error;
        }
      })(),
      (error) => error as WikidotError
    );
  }

  /**
   * Remove a member from the site. Destructive.
   * @param user - Member to remove (or their user ID)
   * @param options.ban - Also ban the user from rejoining. Sent as
   * `ban="yes"` when true; omitted entirely when false (Wikidot's own
   * client only sets `ban` at all on the "remove and ban" flow)
   */
  remove(user: UserOrId, options: { ban?: boolean } = {}): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteMembershipAction',
      event: 'removeMember',
      user_id: toId(user),
      ...omitFalsy({ ban: options.ban ? 'yes' : false }),
    });
  }

  /**
   * Transfer site master-admin ownership to another admin. Destructive from
   * the caller's perspective: the caller loses master status. Uses `userId`
   * (camelCase) -- unlike every other `ManageSiteMembershipAction` event in
   * this class (which use `user_id`), Wikidot's own client sends this one
   * parameter name in camelCase for `changeMaster` specifically.
   * @param user - New master admin (must already be a site admin; or their user ID)
   */
  changeMaster(user: UserOrId): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteMembershipAction',
      event: 'changeMaster',
      userId: toId(user),
    });
  }

  /**
   * Fetch the raw `sm-mod-perms-form` HTML for a moderator.
   *
   * **未実測**: the test site used for this research had no moderators, so
   * `sm-mod-perms-form`'s field names could not be captured. Returns the raw
   * rendered HTML body instead of a typed structure -- inspect it yourself
   * and pass the exact field names to `saveModeratorPermissions`.
   * @param moderatorId - Moderator's user ID (obtainable from getModeratorsAdminView())
   */
  getModeratorPermissionsForm(moderatorId: number): WikidotResultAsync<string> {
    const moduleName = 'managesite/ManageSiteModeratorPermissionsModule';
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequestSingle({ moduleName, moderatorId });
        if (result.isErr()) {
          throw result.error;
        }
        return requireBody(result.value, moduleName);
      })(),
      (error) => error as WikidotError
    );
  }

  /**
   * Save moderator permissions (`saveModeratorPermissions`).
   *
   * **未実測**: `sm-mod-perms-form`'s field names are unknown (see
   * `getModeratorPermissionsForm`). Pass the exact field names/values
   * Wikidot's form uses; this method does not validate, transform, or
   * default them (unlike the typed `site.settings.*` methods).
   * @param fields - Raw form fields to submit verbatim
   */
  saveModeratorPermissions(
    fields: Record<string, AMCRequestBody[string]>
  ): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteMembershipAction',
      event: 'saveModeratorPermissions',
      ...fields,
    });
  }

  // ------------------------------------------------------------------
  // Task 2-4: invitations
  // ------------------------------------------------------------------

  /**
   * Search for users to invite (`users/UserSearchModule`).
   *
   * **未実測 (レスポンス形状)**: 40_admin-managesite.md records this module
   * returns `body`, `count`, `userIds`, `userNames` but the research did not
   * capture a live response, so the exact JSON shape of `userIds`/
   * `userNames` (parallel arrays vs. another encoding) is assumed rather
   * than confirmed. Implemented as parallel JSON arrays, matching how every
   * other list-shaped AMC field in this codebase is encoded.
   * @param query - Search query (part of a username)
   */
  searchUsers(query: string): WikidotResultAsync<UserSearchResult[]> {
    const moduleName = 'users/UserSearchModule';
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequestSingle({ moduleName, query });
        if (result.isErr()) {
          throw result.error;
        }
        const data = result.value;
        const ids = (data.userIds as number[] | undefined) ?? [];
        const names = (data.userNames as string[] | undefined) ?? [];
        return ids.map((id, i) => ({ id, name: names[i] ?? '' }));
      })(),
      (error) => error as WikidotError
    );
  }

  /**
   * Send email invitations to join the site.
   * @param addresses - `[email, name, isContact]` tuples. Encoded as
   * `addresses=[[email, name, isContact], ...]` (JSON), matching Wikidot's own client
   * @param message - Message included with the invitation
   */
  sendEmailInvitations(
    addresses: [email: string, name: string, isContact: boolean][],
    message = ''
  ): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteMembershipAction',
      event: 'sendEmailInvitations',
      addresses: jsonParam(addresses.map((a) => [...a])),
      message,
    });
  }

  /** Delete a pending email invitation */
  deleteEmailInvitation(invitationId: number): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteMembershipAction',
      event: 'deleteEmailInvitation',
      invitationId,
    });
  }

  /** Resend a pending email invitation */
  resendEmailInvitation(invitationId: number, message = ''): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteMembershipAction',
      event: 'resendEmailInvitation',
      invitationId,
      message,
    });
  }

  /**
   * Allow/disallow regular members to invite others via email.
   * @param enabled - Sent as the literal string "true"/"false" (always
   * present, not omitted when false -- matches `enableLetUsersInvite(bool)`'s
   * plain-boolean notation, the same always-sent convention as
   * `site.settings.saveOpenId`'s `enableOpenID`)
   */
  setLetUsersInvite(enabled: boolean): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteMembershipAction',
      event: 'letUsersInviteSave',
      enableLetUsersInvite: enabled ? 'true' : 'false',
    });
  }

  /**
   * Invite a user to become a site admin.
   * @param user - User to invite (or their user ID)
   * @returns The invited user's ID, if returned by Wikidot
   */
  inviteAdmin(user: UserOrId): WikidotResultAsync<number | null> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequestSingle({
          moduleName: 'Empty',
          action: 'ManageSiteAction',
          event: 'inviteAdmin',
          user_id: toId(user),
        });
        if (result.isErr()) {
          throw result.error;
        }
        const userId = result.value.userId;
        return typeof userId === 'number' ? userId : null;
      })(),
      (error) => error as WikidotError
    );
  }

  // ------------------------------------------------------------------
  // Task 2-5: user / IP blocks
  // ------------------------------------------------------------------

  /** Get the list of blocked users */
  getBlockedUsers(): WikidotResultAsync<UserBlock[]> {
    const moduleName = 'managesite/blocks/ManageSiteUserBlocksModule';
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequestSingle({ moduleName });
        if (result.isErr()) {
          throw result.error;
        }
        return UserBlock.parseAll(this.site, requireBody(result.value, moduleName));
      })(),
      (error) => error as WikidotError
    );
  }

  /** Get the list of blocked IP addresses/ranges */
  getBlockedIps(): WikidotResultAsync<IpBlock[]> {
    const moduleName = 'managesite/blocks/ManageSiteIpBlocksModule';
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequestSingle({ moduleName });
        if (result.isErr()) {
          throw result.error;
        }
        return IpBlock.parseAll(this.site, requireBody(result.value, moduleName));
      })(),
      (error) => error as WikidotError
    );
  }

  /**
   * Block a user from the site.
   * @param user - User to block (or their user ID)
   * @param reason - Block reason (200 characters max per Wikidot's form)
   */
  blockUser(user: UserOrId, reason = ''): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteBlockAction',
      event: 'blockUser',
      userId: toId(user),
      reason,
    });
  }

  /**
   * Remove a user block.
   * @param user - Blocked user (or their user ID). `deleteBlock`'s `userId`
   * really is a user ID (confirmed 2026-07-29 from
   * `managesite_blocks_ManageSiteUserBlocksModule.js`) -- do not confuse
   * with `unblockIp`'s `blockId`, which is a block ID
   */
  unblockUser(user: UserOrId): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteBlockAction',
      event: 'deleteBlock',
      userId: toId(user),
    });
  }

  /**
   * Block one or more IP addresses/ranges.
   * @param ips - IP addresses/ranges, one per line (matches the `ips` textarea)
   * @param reason - Block reason (200 characters max per Wikidot's form)
   */
  blockIp(ips: string, reason = ''): WikidotResultAsync<void> {
    return this.simpleAction({ action: 'ManageSiteBlockAction', event: 'blockIp', ips, reason });
  }

  /**
   * Remove an IP block.
   * @param blockId - Block ID (from getBlockedIps()). `deleteIpBlock`'s
   * `blockId` is a block ID, not an IP or user ID -- asymmetric with
   * `unblockUser`'s `userId`, do not confuse the two
   */
  unblockIp(blockId: number): WikidotResultAsync<void> {
    return this.simpleAction({ action: 'ManageSiteBlockAction', event: 'deleteIpBlock', blockId });
  }

  // ------------------------------------------------------------------
  // Task 2-6: abuse-flag clearing / members auto-watching / block-link
  // ------------------------------------------------------------------

  /** Clear abuse flags reported against a user */
  clearUserFlags(user: UserOrId): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteAbuseAction',
      event: 'clearUserFlags',
      userId: toId(user),
    });
  }

  /** Clear abuse flags reported against a page */
  clearPageFlags(path: string): WikidotResultAsync<void> {
    return this.simpleAction({ action: 'ManageSiteAbuseAction', event: 'clearPageFlags', path });
  }

  /**
   * Clear abuse flags reported against an anonymous (IP) address.
   * @param address - IP address
   * @param proxy - Sent as `proxy="yes"` when true (matching the `?("yes")`
   * notation in 40_admin-managesite.md, the same value Wikidot uses for
   * `remove()`'s `ban`); omitted when false
   */
  clearAnonymousFlags(address: string, proxy = false): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteAbuseAction',
      event: 'clearAnonymousFlags',
      address,
      ...omitFalsy({ proxy: proxy ? 'yes' : false }),
    });
  }

  /**
   * Configure members' automatic watching of new pages.
   * @param options.watchAll - Watch all categories automatically
   * @param options.selectedCategories - Category IDs to watch when watchAll
   * is false. Sent as `selected_categories[]=<id>&...` (the AMC client
   * auto-expands array values into bracket notation)
   */
  setMembersWatching(
    options: { watchAll?: boolean; selectedCategories?: number[] } = {}
  ): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteMembershipAction',
      event: 'saveMembersWatching',
      ...omitFalsy({ watch_all: checkbox(options.watchAll) }),
      ...(options.selectedCategories !== undefined
        ? { selected_categories: options.selectedCategories }
        : {}),
    });
  }

  /**
   * Configure automatic link-blocking by karma level.
   * @param karmaLevel - Karma threshold (0-5)
   * @param blockLink - Whether to actually block links below the threshold
   */
  setBlockLink(karmaLevel: number, blockLink = false): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteAction',
      event: 'saveBlockLink',
      karmaLevel,
      ...omitFalsy({ blockLink: flag(blockLink) }),
    });
  }
}

export { IpBlock, SiteApplication, SiteMember, UserBlock };
