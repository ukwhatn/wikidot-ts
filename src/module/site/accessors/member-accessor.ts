import { RequireLogin } from '../../../common/decorators';
import {
  LoginRequiredError,
  TargetError,
  UnexpectedError,
  WikidotStatusError,
} from '../../../common/errors';
import { type WikidotResultAsync, fromPromise } from '../../../common/types';
import { type QMCUser, QuickModule } from '../../../util/quick-module';
import type { User } from '../../user/user';
import type { Site } from '../site';
import { SiteApplication } from '../site-application';
import { SiteMember } from '../site-member';

/**
 * サイトメンバー操作アクセサ
 */
export class MemberAccessor {
  public readonly site: Site;

  constructor(site: Site) {
    this.site = site;
  }

  /**
   * 全メンバーを取得する
   * @returns メンバー一覧
   */
  getAll(): WikidotResultAsync<SiteMember[]> {
    return SiteMember.getMembers(this.site, '');
  }

  /**
   * モデレーター一覧を取得する
   * @returns モデレーター一覧
   */
  getModerators(): WikidotResultAsync<SiteMember[]> {
    return SiteMember.getMembers(this.site, 'moderators');
  }

  /**
   * 管理者一覧を取得する
   * @returns 管理者一覧
   */
  getAdmins(): WikidotResultAsync<SiteMember[]> {
    return SiteMember.getMembers(this.site, 'admins');
  }

  /**
   * 未処理の参加申請を取得する
   * @returns 参加申請一覧
   */
  getApplications(): WikidotResultAsync<SiteApplication[]> {
    return SiteApplication.acquireAll(this.site);
  }

  /**
   * メンバーを検索する
   * @param query - 検索クエリ（ユーザー名の一部）
   * @returns マッチしたユーザー一覧（QMCUser形式）
   */
  lookup(query: string): WikidotResultAsync<QMCUser[]> {
    return QuickModule.memberLookup(this.site.id, query);
  }

  /**
   * ユーザーをサイトに招待する
   * @param user - 招待するユーザー
   * @param text - 招待メッセージ
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
