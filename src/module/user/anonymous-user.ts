import type { ClientRef } from '../types';
import type { AbstractUser, UserType } from './abstract-user';

/**
 * 匿名ユーザー
 */
export class AnonymousUser implements AbstractUser {
  public readonly client: ClientRef;

  /** ユーザーID（匿名は0） */
  public readonly id: number = 0;

  /** ユーザー名（匿名は"Anonymous"） */
  public readonly name: string = 'Anonymous';

  /** UNIX形式のユーザー名 */
  public readonly unixName: string = 'anonymous';

  /** アバターURL（匿名はnull） */
  public readonly avatarUrl: string | null = null;

  /** IPアドレス */
  public readonly ip: string;

  /** ユーザー種別 */
  public readonly userType: UserType = 'anonymous';

  constructor(client: ClientRef, ip: string) {
    this.client = client;
    this.ip = ip;
  }

  // AbstractUser実装
  isUser(): boolean {
    return false;
  }
  isDeletedUser(): boolean {
    return false;
  }
  isAnonymousUser(): boolean {
    return true;
  }
  isGuestUser(): boolean {
    return false;
  }
  isWikidotUser(): boolean {
    return false;
  }

  toString(): string {
    return `AnonymousUser(name=${this.name}, unixName=${this.unixName}, ip=${this.ip})`;
  }
}
