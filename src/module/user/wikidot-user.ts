import type { ClientRef } from '../types';
import type { AbstractUser, UserType } from './abstract-user';

/**
 * Wikidotシステムユーザー
 */
export class WikidotUser implements AbstractUser {
  public readonly client: ClientRef;

  /** ユーザーID（Wikidotシステムは0） */
  public readonly id: number = 0;

  /** ユーザー名 */
  public readonly name: string = 'Wikidot';

  /** UNIX形式のユーザー名 */
  public readonly unixName: string = 'wikidot';

  /** アバターURL（システムユーザーはnull） */
  public readonly avatarUrl: string | null = null;

  /** IPアドレス（システムユーザーはnull） */
  public readonly ip: string | null = null;

  /** ユーザー種別 */
  public readonly userType: UserType = 'wikidot';

  constructor(client: ClientRef) {
    this.client = client;
  }

  // AbstractUser実装
  isUser(): boolean {
    return false;
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
    return true;
  }

  toString(): string {
    return `WikidotUser(name=${this.name}, unixName=${this.unixName})`;
  }
}
