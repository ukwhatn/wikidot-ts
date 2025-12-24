import type { ClientRef } from '../types';
import type { AbstractUser, UserType } from './abstract-user';

/**
 * Guest user
 */
export class GuestUser implements AbstractUser {
  public readonly client: ClientRef;

  /** User ID (0 for guest) */
  public readonly id: number = 0;

  /** Guest name */
  public readonly name: string;

  /** UNIX format username (null for guest) */
  public readonly unixName: string | null = null;

  /** Avatar URL (may be Gravatar) */
  public readonly avatarUrl: string | null;

  /** IP address (null for guest) */
  public readonly ip: string | null = null;

  /** User type */
  public readonly userType: UserType = 'guest';

  constructor(client: ClientRef, name: string, avatarUrl: string | null = null) {
    this.client = client;
    this.name = name;
    this.avatarUrl = avatarUrl;
  }

  // AbstractUser implementation
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
