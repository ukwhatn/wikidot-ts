import type { WikidotResultAsync } from '../../../common/types';
import type { AMCRequestBody } from '../../../connector/amc-types';
import {
  type CreateSiteOptions,
  DashboardSite,
  DashboardSites,
  type NewSitePrivacy,
  type NewSiteTemplate,
} from '../../dashboard-site/dashboard-site';
import { Site } from '../../site';
import type { Client } from '../client';

/**
 * Site operations accessor
 */
export class SiteAccessor {
  public readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Get site by UNIX name
   *
   * @param unixName - Site UNIX name (e.g., 'scp-jp')
   * @returns Site object wrapped in Result type
   *
   * @example
   * ```typescript
   * const siteResult = await client.site.get('scp-jp');
   * if (!siteResult.isOk()) {
   *   throw new Error('Failed to get site');
   * }
   * const site = siteResult.value;
   * ```
   */
  get(unixName: string): WikidotResultAsync<Site> {
    return Site.fromUnixName(this.client, unixName);
  }

  /**
   * Create a new site
   * @param options - New site options
   * @returns UNIX name of the created site
   */
  create(options: CreateSiteOptions): WikidotResultAsync<string> {
    return DashboardSites.create(this.client, options);
  }

  /**
   * Retrieve every site the account belongs to (all roles) plus deleted sites
   * @returns All rows of the account's site dashboard
   */
  listSites(): WikidotResultAsync<DashboardSite[]> {
    return DashboardSites.listSites(this.client);
  }

  /**
   * Accept a pending site invitation
   * @param invitationId - Invitation ID
   */
  acceptInvitation(invitationId: number): WikidotResultAsync<void> {
    return DashboardSites.acceptInvitation(this.client, invitationId);
  }

  /**
   * Discard a pending site invitation without accepting it
   * @param invitationId - Invitation ID
   */
  throwAwayInvitation(invitationId: number): WikidotResultAsync<void> {
    return DashboardSites.throwAwayInvitation(this.client, invitationId);
  }

  /**
   * Withdraw a pending membership application the account submitted to a site
   * @param siteId - ID of the site the application was submitted to
   */
  removeApplication(siteId: number): WikidotResultAsync<void> {
    return DashboardSites.removeApplication(this.client, siteId);
  }

  /**
   * Restore a deleted site the account administers
   * @param siteId - ID of the deleted site
   * @param confirmSiteName - Site name, required as a typed confirmation
   */
  restoreSite(siteId: number, confirmSiteName: string): WikidotResultAsync<void> {
    return DashboardSites.restoreSite(this.client, siteId, confirmSiteName);
  }

  /**
   * Resign the account's admin role on a site
   * @param siteId - Site ID
   */
  resignAsAdmin(siteId: number): WikidotResultAsync<void> {
    return DashboardSites.resignAsAdmin(this.client, siteId);
  }

  /**
   * Resign the account's moderator role on a site
   * @param siteId - Site ID
   */
  resignAsModerator(siteId: number): WikidotResultAsync<void> {
    return DashboardSites.resignAsModerator(this.client, siteId);
  }

  /**
   * Leave a site the account is a plain member of
   * @param siteId - Site ID
   */
  signOffAsMember(siteId: number): WikidotResultAsync<void> {
    return DashboardSites.signOffAsMember(this.client, siteId);
  }

  /**
   * Set a site's file storage limit.
   *
   * Unmeasured: the form fields of limit-site-<siteId> could not be captured
   * during the investigation (no Pro site available). Pass the exact field
   * names/values as sent by the real form.
   * @param siteId - Site ID
   * @param rawFields - Raw form fields to send as-is
   */
  setStorageLimit(
    siteId: number,
    rawFields: Record<string, AMCRequestBody[string]>
  ): WikidotResultAsync<void> {
    return DashboardSites.setStorageLimit(this.client, siteId, rawFields);
  }
}

export type { CreateSiteOptions, NewSitePrivacy, NewSiteTemplate };
export { DashboardSite, DashboardSites, Site };
