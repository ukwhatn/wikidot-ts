import * as cheerio from 'cheerio';
import { RequireLogin } from '../../common/decorators';
import {
  LoginRequiredError,
  TargetError,
  UnexpectedError,
  WikidotStatusError,
} from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { parseOdate, parseUser } from '../../util/parser';
import type { AbstractUser } from '../user';
import type { Site } from './site';

/**
 * Site member data
 */
export interface SiteMemberData {
  site: Site;
  user: AbstractUser;
  joinedAt: Date | null;
}

/**
 * Site member
 */
export class SiteMember {
  public readonly site: Site;
  public readonly user: AbstractUser;
  public readonly joinedAt: Date | null;

  constructor(data: SiteMemberData) {
    this.site = data.site;
    this.user = data.user;
    this.joinedAt = data.joinedAt;
  }

  /**
   * Parse member information from HTML
   */
  private static parse(site: Site, html: string): SiteMember[] {
    const $ = cheerio.load(html);
    const members: SiteMember[] = [];

    $('table tr').each((_i, row) => {
      const tds = $(row).find('td');
      const userElem = $(tds[0]).find('.printuser');

      if (userElem.length === 0) {
        return;
      }

      const user = parseUser(site.client, userElem);

      // Second td contains join date if exists
      let joinedAt: Date | null = null;
      if (tds.length >= 2) {
        const odateElem = $(tds[1]).find('.odate');
        if (odateElem.length > 0) {
          joinedAt = parseOdate(odateElem);
        }
      }

      members.push(new SiteMember({ site, user, joinedAt }));
    });

    return members;
  }

  /**
   * Get site member list
   * @param site - Target site
   * @param group - Group ("admins", "moderators", or empty string for all members)
   */
  static getMembers(
    site: Site,
    group: 'admins' | 'moderators' | '' = ''
  ): WikidotResultAsync<SiteMember[]> {
    return fromPromise(
      (async () => {
        const members: SiteMember[] = [];

        // Get first page
        const firstResult = await site.amcRequest([
          {
            moduleName: 'membership/MembersListModule',
            page: 1,
            group,
          },
        ]);

        if (firstResult.isErr()) {
          throw firstResult.error;
        }

        const firstResponse = firstResult.value[0];
        if (!firstResponse) {
          throw new UnexpectedError('Empty response');
        }

        const firstHtml = String(firstResponse.body ?? '');
        members.push(...SiteMember.parse(site, firstHtml));

        // Check pager
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

        // Get remaining pages
        const bodies = [];
        for (let page = 2; page <= lastPage; page++) {
          bodies.push({
            moduleName: 'membership/MembersListModule',
            page,
            group,
          });
        }

        const additionalResults = await site.amcRequest(bodies);
        if (additionalResults.isErr()) {
          throw additionalResults.error;
        }

        for (const response of additionalResults.value) {
          const html = String(response?.body ?? '');
          members.push(...SiteMember.parse(site, html));
        }

        return members;
      })(),
      (error) => new UnexpectedError(`Failed to get members: ${String(error)}`)
    );
  }

  /**
   * Internal method to change group
   */
  @RequireLogin
  private changeGroup(
    event: 'toModerators' | 'removeModerator' | 'toAdmins' | 'removeAdmin'
  ): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            action: 'ManageSiteMembershipAction',
            event,
            user_id: this.user.id,
            moduleName: '',
          },
        ]);
        if (result.isErr()) {
          const error = result.error;
          if (error instanceof WikidotStatusError) {
            if (error.statusCode === 'not_already') {
              throw new TargetError(`User is not moderator/admin: ${this.user.name}`);
            }
            if (error.statusCode === 'already_admin' || error.statusCode === 'already_moderator') {
              throw new TargetError(
                `User is already ${error.statusCode.replace('already_', '')}: ${this.user.name}`
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
        return new UnexpectedError(`Failed to change member group: ${String(error)}`);
      }
    );
  }

  /**
   * Promote to moderator
   */
  toModerator(): WikidotResultAsync<void> {
    return this.changeGroup('toModerators');
  }

  /**
   * Remove moderator privileges
   */
  removeModerator(): WikidotResultAsync<void> {
    return this.changeGroup('removeModerator');
  }

  /**
   * Promote to admin
   */
  toAdmin(): WikidotResultAsync<void> {
    return this.changeGroup('toAdmins');
  }

  /**
   * Remove admin privileges
   */
  removeAdmin(): WikidotResultAsync<void> {
    return this.changeGroup('removeAdmin');
  }

  toString(): string {
    return `SiteMember(user=${this.user.name}, site=${this.site.unixName})`;
  }
}
