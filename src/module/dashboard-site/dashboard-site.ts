/**
 * The logged-in user's own sites and site invitations (`www.wikidot.com/account/sites`)
 *
 * These operations act on the current account's relationship to sites -- creating a
 * new site, listing sites the account belongs to, accepting or discarding
 * invitations, and resigning from a role -- as distinct from `Site`, which
 * represents operations performed *within* a single already-identified site. Some
 * targets here (a pending invitation, a deleted site) have no accessible `Site`
 * object yet, so these are modeled as standalone static methods taking raw IDs
 * rather than methods on a resource class.
 *
 * All requests go through `client.amcClient.request()`, which defaults to
 * `www.wikidot.com` -- never a site's own host.
 *
 * Ported from wikidot.py's `module/dashboard_site.py`.
 */

import * as cheerio from 'cheerio';
import { LoginRequiredError, UnexpectedError, WikidotError } from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { checkbox, omitFalsy, requireBody } from '../../connector';
import type { AMCRequestBody } from '../../connector/amc-types';
import type { Client } from '../client';

/** `template` values accepted by NewSiteAction/createSite (form(new-site-form)) */
export type NewSiteTemplate =
  | 'standard-template'
  | 'blog-template'
  | 'blank-template'
  | 'default-template'
  | 'notebooks';

/** `privacy` values accepted by NewSiteAction/createSite (form(new-site-form)) */
export type NewSitePrivacy = 'open' | 'closed' | 'private';

/** Options accepted by DashboardSites.create */
export interface CreateSiteOptions {
  /** Site title */
  name: string;
  /** Site UNIX name (used in the domain, e.g. "foo" -> foo.wikidot.com) */
  unixname: string;
  /** Site subtitle */
  subtitle?: string;
  /** Site language code */
  language?: string;
  /** Starting content template */
  template?: NewSiteTemplate;
  /** Site visibility */
  privacy?: NewSitePrivacy;
  /**
   * Whether to accept the Terms of Service. The real form requires this checked to
   * submit; passing false reproduces the unchecked (omitted) wire state
   */
  tos?: boolean;
}

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

function fireAction(
  client: Client,
  body: AMCRequestBody,
  actionLabel: string
): WikidotResultAsync<void> {
  return withLogin(
    client,
    async () => {
      const result = await client.amcClient.request([{ moduleName: 'Empty', ...body }]);
      if (result.isErr()) throw result.error;
    },
    (error) => new UnexpectedError(`${actionLabel} failed: ${String(error)}`)
  );
}

/** Data backing a {@link DashboardSite} */
export interface DashboardSiteData {
  client: Client;
  siteId: number;
  title: string;
  url: string;
  unixName: string;
  tagline: string;
  activity: string;
  role: string;
  deleted: boolean;
}

/**
 * A row of the account's site dashboard listing (dashboard/sites/DSListModule)
 *
 * Represents the current account's relationship to one site (any role, or a site
 * it once belonged to but is now deleted). Distinct from `Site`, which represents
 * a site's own state independent of any particular account.
 *
 * Row markup was measured 2026-07-29 (see the sibling wikidot.py repo's
 * `.local/memory/260728_wikidot-ajax-modules/70_account.md`, "一覧モジュールの
 * 行マークアップ"): each row is `div.site`, with `div.name > a` (title),
 * `div.url` (site URL), and a `div.data` block holding `span.activity`,
 * `span.site-id`, `span.unix-name`, `span.tagline`, `span.deleted`,
 * `span.occupation`. The measurement captured the DOM skeleton but not the exact
 * value encoding of every field, so `activity` and `role` are kept as the raw
 * observed text rather than a guessed enum/unit.
 */
export class DashboardSite {
  public readonly client: Client;
  /** Site ID (span.site-id) */
  public readonly siteId: number;
  /** Site title (text of div.name > a) */
  public readonly title: string;
  /** Site URL (text of div.url) */
  public readonly url: string;
  /** Site UNIX name (span.unix-name) */
  public readonly unixName: string;
  /** Site tagline/subtitle (span.tagline) */
  public readonly tagline: string;
  /** Raw text of span.activity; exact meaning/unit was not confirmed */
  public readonly activity: string;
  /**
   * Raw text of span.occupation. Observed values are expected to align with the
   * hash-tab identifiers used elsewhere on this page ("master_admin" / "admin" /
   * "moderator" / "member"), but this correspondence was not independently
   * confirmed
   */
  public readonly role: string;
  /** Whether span.deleted is present in this row's div.data block */
  public readonly deleted: boolean;

  constructor(data: DashboardSiteData) {
    this.client = data.client;
    this.siteId = data.siteId;
    this.title = data.title;
    this.url = data.url;
    this.unixName = data.unixName;
    this.tagline = data.tagline;
    this.activity = data.activity;
    this.role = data.role;
    this.deleted = data.deleted;
  }

  /**
   * Restore this site (must currently be deleted)
   * @param confirmSiteName - Site name, required as a typed confirmation
   */
  restore(confirmSiteName: string): WikidotResultAsync<void> {
    return DashboardSites.restoreSite(this.client, this.siteId, confirmSiteName);
  }

  /**
   * Resign the account's admin role on this site
   */
  resignAsAdmin(): WikidotResultAsync<void> {
    return DashboardSites.resignAsAdmin(this.client, this.siteId);
  }

  /**
   * Resign the account's moderator role on this site
   */
  resignAsModerator(): WikidotResultAsync<void> {
    return DashboardSites.resignAsModerator(this.client, this.siteId);
  }

  /**
   * Leave this site (account must be a plain member)
   */
  signOffAsMember(): WikidotResultAsync<void> {
    return DashboardSites.signOffAsMember(this.client, this.siteId);
  }

  /**
   * Set this site's file storage limit. Unmeasured: see
   * DashboardSites.setStorageLimit for details
   * @param rawFields - Raw form fields to send as-is
   */
  setStorageLimit(rawFields: Record<string, AMCRequestBody[string]>): WikidotResultAsync<void> {
    return DashboardSites.setStorageLimit(this.client, this.siteId, rawFields);
  }

  toString(): string {
    return `DashboardSite(siteId=${this.siteId}, title=${this.title}, role=${this.role}, deleted=${this.deleted})`;
  }

  /**
   * Retrieve every site the account belongs to (all roles) plus deleted sites
   *
   * Wraps dashboard/sites/DSListModule, which renders the full list in one
   * response (the real UI filters by role/deleted client-side via DOM attributes
   * rather than separate requests).
   * @param client - Client instance
   * @returns All rows of the account's site dashboard
   */
  static acquireAll(client: Client): WikidotResultAsync<DashboardSite[]> {
    return withLogin(
      client,
      async () => {
        const result = await client.amcClient.request([
          { moduleName: 'dashboard/sites/DSListModule' },
        ]);
        if (result.isErr()) throw result.error;
        const html = requireBody(result.value[0], 'dashboard/sites/DSListModule');
        const $ = cheerio.load(html);

        const sites: DashboardSite[] = [];
        $('div.site').each((_i, elem) => {
          const $row = $(elem);
          const nameLink = $row.find('div.name > a').first();
          const siteIdText = $row.find('span.site-id').first().text().trim();

          if (nameLink.length === 0 || !/^\d+$/.test(siteIdText)) {
            return;
          }

          sites.push(
            new DashboardSite({
              client,
              siteId: Number.parseInt(siteIdText, 10),
              title: nameLink.text().trim(),
              url: $row.find('div.url').first().text().trim(),
              unixName: $row.find('span.unix-name').first().text().trim(),
              tagline: $row.find('span.tagline').first().text().trim(),
              activity: $row.find('span.activity').first().text().trim(),
              role: $row.find('span.occupation').first().text().trim(),
              deleted: $row.find('span.deleted').length > 0,
            })
          );
        });

        return sites;
      },
      (error) => new UnexpectedError(`Failed to fetch site list: ${String(error)}`)
    );
  }
}

/**
 * Static namespace grouping the account's site-dashboard operations
 * (DashboardSitesAction / NewSiteAction / dashboard/sites/*).
 *
 * Access through `client.site` (create/listHtml/acceptInvitation/...) rather than
 * calling these directly.
 */
export const DashboardSites = {
  /**
   * Create a new site (form(new-site-form) -> NewSiteAction/createSite)
   * @param client - Client instance
   * @param options - New site options
   * @returns UNIX name of the created site (the "siteUnixName" response field)
   */
  create(client: Client, options: CreateSiteOptions): WikidotResultAsync<string> {
    const {
      name,
      unixname,
      subtitle = '',
      language = 'en',
      template = 'standard-template',
      privacy = 'open',
      tos = true,
    } = options;

    return withLogin(
      client,
      async () => {
        const result = await client.amcClient.request([
          {
            action: 'NewSiteAction',
            event: 'createSite',
            moduleName: 'Empty',
            name,
            subtitle,
            unixname,
            language,
            template,
            privacy,
            ...omitFalsy({ tos: checkbox(tos) }),
          },
        ]);
        if (result.isErr()) throw result.error;
        const response = result.value[0];
        if (!response) throw new UnexpectedError('Empty response');
        return response.siteUnixName as string;
      },
      (error) => new UnexpectedError(`Failed to create site: ${String(error)}`)
    );
  },

  /**
   * Retrieve every site the account belongs to (all roles) plus deleted sites
   * @param client - Client instance
   * @returns All rows of the account's site dashboard
   */
  listSites(client: Client): WikidotResultAsync<DashboardSite[]> {
    return DashboardSite.acquireAll(client);
  },

  /**
   * Accept a pending site invitation
   * @param client - Client instance
   * @param invitationId - Invitation ID (as listed by dashboard/messages/DMInvitationsModule)
   */
  acceptInvitation(client: Client, invitationId: number): WikidotResultAsync<void> {
    return fireAction(
      client,
      { action: 'DashboardSitesAction', event: 'acceptInvitation', invitation_id: invitationId },
      'acceptInvitation'
    );
  },

  /**
   * Discard a pending site invitation without accepting it
   * @param client - Client instance
   * @param invitationId - Invitation ID
   */
  throwAwayInvitation(client: Client, invitationId: number): WikidotResultAsync<void> {
    return fireAction(
      client,
      { action: 'DashboardSitesAction', event: 'throwAwayInvitation', invitation_id: invitationId },
      'throwAwayInvitation'
    );
  },

  /**
   * Withdraw a pending membership application the account submitted to a site
   * @param client - Client instance
   * @param siteId - ID of the site the application was submitted to
   */
  removeApplication(client: Client, siteId: number): WikidotResultAsync<void> {
    return fireAction(
      client,
      { action: 'DashboardSitesAction', event: 'removeApplication', site_id: siteId },
      'removeApplication'
    );
  },

  /**
   * Restore a deleted site the account administers
   * @param client - Client instance
   * @param siteId - ID of the deleted site
   * @param confirmSiteName - Site name, required by form(ds-restore-site-form) as a typed confirmation
   * (mirrors the real UI's "type the site name" guard)
   */
  restoreSite(client: Client, siteId: number, confirmSiteName: string): WikidotResultAsync<void> {
    return fireAction(
      client,
      {
        action: 'DashboardSitesAction',
        event: 'restoreSite',
        site_id: siteId,
        site_name: confirmSiteName,
      },
      'restoreSite'
    );
  },

  /**
   * Resign the account's admin role on a site (form(ds-admin-resign-form))
   * @param client - Client instance
   * @param siteId - Site ID
   */
  resignAsAdmin(client: Client, siteId: number): WikidotResultAsync<void> {
    return fireAction(
      client,
      { action: 'DashboardSitesAction', event: 'adminResign', site_id: siteId },
      'adminResign'
    );
  },

  /**
   * Resign the account's moderator role on a site (form(ds-moderator-resign-form))
   * @param client - Client instance
   * @param siteId - Site ID
   */
  resignAsModerator(client: Client, siteId: number): WikidotResultAsync<void> {
    return fireAction(
      client,
      { action: 'DashboardSitesAction', event: 'moderatorResign', site_id: siteId },
      'moderatorResign'
    );
  },

  /**
   * Leave a site the account is a plain member of (form(ds-member-signoff-form))
   * @param client - Client instance
   * @param siteId - Site ID
   */
  signOffAsMember(client: Client, siteId: number): WikidotResultAsync<void> {
    return fireAction(
      client,
      { action: 'DashboardSitesAction', event: 'memberSignOff', site_id: siteId },
      'memberSignOff'
    );
  },

  /**
   * Set a site's file storage limit (form(limit-site-<siteId>)).
   *
   * Unmeasured: dashboard/sites/DSListModule did not render this form for the
   * investigation account (no Pro site available), so the field names of
   * limit-site-<siteId> could not be captured. Pass the exact field names/values as
   * sent by the real form.
   * @param client - Client instance
   * @param siteId - Site ID
   * @param rawFields - Raw form fields to send as-is
   */
  setStorageLimit(
    client: Client,
    siteId: number,
    rawFields: Record<string, AMCRequestBody[string]>
  ): WikidotResultAsync<void> {
    return fireAction(
      client,
      { action: 'DashboardSitesAction', event: 'setStorageLimit', site_id: siteId, ...rawFields },
      'setStorageLimit'
    );
  },
};
