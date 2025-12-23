import type { ClientRef } from '../types';
import type { AbstractUser, UserType } from './abstract-user';

/**
 * ゲストユーザー
 */
export class GuestUser implements AbstractUser {
  public readonly client: ClientRef;

  /** ユーザーID（ゲストは0） */
  public readonly id: number = 0;

  /** ゲスト名 */
  public readonly name: string;

  /** UNIX形式のユーザー名（ゲストはnull） */
  public readonly unixName: string | null = null;

  /** アバターURL（Gravatarの場合あり） */
  public readonly avatarUrl: string | null;

  /** IPアドレス（ゲストはnull） */
  public readonly ip: string | null = null;

  /** ユーザー種別 */
  public readonly userType: UserType = 'guest';

  constructor(client: ClientRef, name: string, avatarUrl: string | null = null) {
    this.client = client;
    this.name = name;
    this.avatarUrl = avatarUrl;
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
    return true;
  }
  isWikidotUser(): boolean {
    return false;
  }

  toString(): string {
    return `GuestUser(name=${this.name})`;
  }
}
