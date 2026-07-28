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
   * Fetch the raw HTML of dashboard/sites/DSListModule.
   *
   * Renders every site the account belongs to (all roles) plus deleted sites in one
   * response; the real UI filters by role/deleted client-side via DOM attributes
   * rather than separate requests. Row markup detail (site id/unix name/role
   * attributes) was not captured during the investigation, so this returns the raw
   * body rather than a parsed list.
   * @param client - Client instance
   * @returns Raw rendered HTML body
   */
  listHtml(client: Client): WikidotResultAsync<string> {
    return withLogin(
      client,
      async () => {
        const result = await client.amcClient.request([
          { moduleName: 'dashboard/sites/DSListModule' },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'dashboard/sites/DSListModule');
      },
      (error) => new UnexpectedError(`Failed to fetch site list: ${String(error)}`)
    );
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
