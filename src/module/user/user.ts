import * as cheerio from 'cheerio';
import { NoElementError, NotFoundException, UnexpectedError } from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { toUnix } from '../../util/string-util';
import type { ClientRef } from '../types';
import type { AbstractUser, UserType } from './abstract-user';
import { UserCollection } from './user-collection';

/**
 * ユーザーデータ
 */
export interface UserData {
  id: number;
  name: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  unixName?: string;
}

/**
 * 通常ユーザー
 */
export class User implements AbstractUser {
  public readonly client: ClientRef;

  /** ユーザーID */
  public readonly id: number;

  /** ユーザー名 */
  public readonly name: string;

  /** 表示名 */
  public readonly displayName: string | null;

  /** アバターURL */
  public readonly avatarUrl: string | null;

  /** UNIX形式のユーザー名 */
  public readonly unixName: string;

  /** IPアドレス（通常ユーザーではnull） */
  public readonly ip: string | null = null;

  /** ユーザー種別 */
  public readonly userType: UserType = 'user';

  constructor(client: ClientRef, data: UserData) {
    this.client = client;
    this.id = data.id;
    this.name = data.name;
    this.displayName = data.displayName ?? null;
    this.avatarUrl = data.avatarUrl ?? `https://www.wikidot.com/avatar.php?userid=${data.id}`;
    this.unixName = data.unixName ?? toUnix(data.name);
  }

  /**
   * ユーザー名からユーザーを取得する
   * @param client - クライアント
   * @param name - ユーザー名
   * @returns ユーザー（存在しない場合はnull）
   */
  static fromName(client: ClientRef, name: string): WikidotResultAsync<User | null> {
    return fromPromise(
      (async () => {
        const unixName = toUnix(name);
        const url = `https://www.wikidot.com/user:info/${unixName}`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new UnexpectedError(`Failed to fetch user info: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // 存在チェック
        if ($('div.error-block').length > 0) {
          return null;
        }

        // id取得
        const userIdElem = $('a.btn.btn-default.btn-xs');
        if (userIdElem.length === 0) {
          throw new NoElementError('User ID element not found');
        }
        const href = userIdElem.attr('href');
        if (!href) {
          throw new NoElementError('User ID href not found');
        }
        const userId = Number.parseInt(href.split('/').pop() ?? '0', 10);

        // name取得
        const nameElem = $('h1.profile-title');
        if (nameElem.length === 0) {
          throw new NoElementError('User name element not found');
        }
        const userName = nameElem.text().trim();

        return new User(client, {
          id: userId,
          name: userName,
          unixName,
        });
      })(),
      (error) => {
        if (error instanceof NotFoundException || error instanceof NoElementError) {
          return error;
        }
        return new UnexpectedError(`Failed to get user: ${String(error)}`);
      }
    );
  }

  /**
   * 複数ユーザー名からユーザーを取得する
   * @param client - クライアント
   * @param names - ユーザー名配列
   * @returns ユーザーコレクション
   */
  static fromNames(client: ClientRef, names: string[]): WikidotResultAsync<UserCollection> {
    return fromPromise(
      (async () => {
        const results = await Promise.all(
          names.map(async (name) => {
            const result = await User.fromName(client, name);
            return result.isOk() ? result.value : null;
          })
        );
        return new UserCollection(results);
      })(),
      (error) => new UnexpectedError(`Failed to get users: ${String(error)}`)
    );
  }

  // AbstractUser実装
  isUser(): boolean {
    return true;
  }
  isDeletedUser(): boolean {
    return false;
  }
  isAnonymousUser(): boolean {
    return false;
  }
  isGuestUser(): boolean {
    return false;
  }
  isWikidotUser(): boolean {
    return false;
  }

  toString(): string {
    return `User(id=${this.id}, name=${this.name}, unixName=${this.unixName})`;
  }
}
