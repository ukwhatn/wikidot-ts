import * as cheerio from 'cheerio';
import { RequireLogin } from '../../common/decorators';
import {
  ForbiddenError,
  LoginRequiredError,
  NotFoundException,
  UnexpectedError,
  WikidotStatusError,
} from '../../common/errors';
import { type WikidotResultAsync, fromPromise } from '../../common/types';
import { parseUser } from '../../util/parser';
import type { AbstractUser } from '../user';
import type { Site } from './site';

/**
 * サイト参加申請データ
 */
export interface SiteApplicationData {
  site: Site;
  user: AbstractUser;
  text: string;
}

/**
 * サイト参加申請
 */
export class SiteApplication {
  public readonly site: Site;
  public readonly user: AbstractUser;
  public readonly text: string;

  constructor(data: SiteApplicationData) {
    this.site = data.site;
    this.user = data.user;
    this.text = data.text;
  }

  /**
   * 未処理の参加申請をすべて取得する
   * @param site - 対象サイト
   */
  static acquireAll(site: Site): WikidotResultAsync<SiteApplication[]> {
    const loginResult = site.client.requireLogin();
    if (loginResult.isErr()) {
      return fromPromise(
        Promise.reject(loginResult.error),
        () => new LoginRequiredError('Login required to get applications')
      );
    }

    return fromPromise(
      (async () => {
        const result = await site.amcRequest([
          { moduleName: 'managesite/ManageSiteMembersApplicationsModule' },
        ]);

        if (result.isErr()) {
          throw result.error;
        }

        const response = result.value[0];
        if (!response) {
          throw new UnexpectedError('Empty response');
        }

        const html = String(response.body ?? '');

        // 権限チェック
        if (html.includes('WIKIDOT.page.listeners.loginClick(event)')) {
          throw new ForbiddenError('You are not allowed to access this page');
        }

        const $ = cheerio.load(html);
        const applications: SiteApplication[] = [];

        const userElements = $('h3 span.printuser').toArray();
        const textWrapperElements = $('table').toArray();

        if (userElements.length !== textWrapperElements.length) {
          throw new UnexpectedError(
            'Length of user_elements and text_wrapper_elements are different'
          );
        }

        for (let i = 0; i < userElements.length; i++) {
          const userElement = userElements[i];
          const textWrapperElement = textWrapperElements[i];

          if (!userElement || !textWrapperElement) continue;

          const user = parseUser(site.client, $(userElement));
          const textElement = $(textWrapperElement).find('td').eq(1);
          const text = textElement.text().trim();

          applications.push(new SiteApplication({ site, user, text }));
        }

        return applications;
      })(),
      (error) => {
        if (error instanceof ForbiddenError || error instanceof LoginRequiredError) {
          return error;
        }
        return new UnexpectedError(`Failed to get applications: ${String(error)}`);
      }
    );
  }

  /**
   * 申請を処理する内部メソッド
   */
  @RequireLogin
  private process(action: 'accept' | 'decline'): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            action: 'ManageSiteMembershipAction',
            event: 'acceptApplication',
            user_id: this.user.id,
            text: `your application has been ${action}ed`,
            type: action,
            moduleName: 'Empty',
          },
        ]);
        if (result.isErr()) {
          const error = result.error;
          if (error instanceof WikidotStatusError && error.statusCode === 'no_application') {
            throw new NotFoundException(`Application not found: ${this.user.name}`);
          }
          throw error;
        }
      })(),
      (error) => {
        if (error instanceof NotFoundException || error instanceof LoginRequiredError) {
          return error;
        }
        return new UnexpectedError(`Failed to process application: ${String(error)}`);
      }
    );
  }

  /**
   * 参加申請を承認する
   */
  accept(): WikidotResultAsync<void> {
    return this.process('accept');
  }

  /**
   * 参加申請を拒否する
   */
  decline(): WikidotResultAsync<void> {
    return this.process('decline');
  }

  toString(): string {
    return `SiteApplication(user=${this.user.name}, site=${this.site.unixName}, text=${this.text})`;
  }
}
