import type { ClientRef } from '../types';

/**
 * User type
 */
export type UserType = 'user' | 'deleted' | 'anonymous' | 'guest' | 'wikidot';

/**
 * User base interface
 */
export interface AbstractUser {
  /** Client */
  readonly client: ClientRef;

  /** User ID */
  readonly id: number;

  /** Username */
  readonly name: string;

  /** UNIX format username */
  readonly unixName: string | null;

  /** Avatar URL */
  readonly avatarUrl: string | null;

  /** IP address (only for anonymous users) */
  readonly ip: string | null;

  /** User type */
  readonly userType: UserType;

  /** Check user type */
  isUser(): boolean;
  isDeletedUser(): boolean;
  isAnonymousUser(): boolean;
  isGuestUser(): boolean;
  isWikidotUser(): boolean;
}
