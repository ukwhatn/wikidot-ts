import type { ClientRef } from '../types';

/**
 * ユーザー種別
 */
export type UserType = 'user' | 'deleted' | 'anonymous' | 'guest' | 'wikidot';

/**
 * ユーザー基底インターフェース
 */
export interface AbstractUser {
  /** クライアント */
  readonly client: ClientRef;

  /** ユーザーID */
  readonly id: number;

  /** ユーザー名 */
  readonly name: string;

  /** UNIX形式のユーザー名 */
  readonly unixName: string | null;

  /** アバターURL */
  readonly avatarUrl: string | null;

  /** IPアドレス（匿名ユーザーの場合のみ） */
  readonly ip: string | null;

  /** ユーザー種別 */
  readonly userType: UserType;

  /** ユーザー種別を判定 */
  isUser(): boolean;
  isDeletedUser(): boolean;
  isAnonymousUser(): boolean;
  isGuestUser(): boolean;
  isWikidotUser(): boolean;
}
