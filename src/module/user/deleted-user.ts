import type { ClientRef } from '../types';
import type { AbstractUser, UserType } from './abstract-user';

/**
 * 削除済みユーザー
 */
export class DeletedUser implements AbstractUser {
  public readonly client: ClientRef;

  /** 削除済みユーザーID */
  public readonly id: number;

  /** ユーザー名（削除済みは"account deleted"） */
  public readonly name: string = 'account deleted';

  /** UNIX形式のユーザー名 */
  public readonly unixName: string = 'account_deleted';

  /** アバターURL（削除済みはnull） */
  public readonly avatarUrl: string | null = null;

  /** IPアドレス（削除済みはnull） */
  public readonly ip: string | null = null;

  /** ユーザー種別 */
  public readonly userType: UserType = 'deleted';

  constructor(client: ClientRef, id: number) {
    this.client = client;
    this.id = id;
  }

  // AbstractUser実装
  isUser(): boolean {
    return false;
  }
  isDeletedUser(): boolean {
    return true;
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
    return `DeletedUser(id=${this.id}, name=${this.name}, unixName=${this.unixName})`;
  }
}
