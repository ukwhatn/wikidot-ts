import { RequireLogin } from '../../../common/decorators';
import {
  LoginRequiredError,
  TargetError,
  UnexpectedError,
  WikidotStatusError,
} from '../../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../../common/types';
import { type QMCUser, QuickModule } from '../../../util/quick-module';
import type { User } from '../../user/user';
import type { Site } from '../site';
import { SiteApplication } from '../site-application';
import { SiteMember } from '../site-member';

/**
 * Site member operations accessor
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
}

export { SiteMember, SiteApplication };
