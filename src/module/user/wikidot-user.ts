import type { ClientRef } from '../types';
import type { AbstractUser, UserType } from './abstract-user';

/**
 * Wikidot system user
 */
export class WikidotUser implements AbstractUser {
  public readonly client: ClientRef;

  /** User ID (0 for Wikidot system) */
  public readonly id: number = 0;

  /** Username */
  public readonly name: string = 'Wikidot';

  /** UNIX format username */
  public readonly unixName: string = 'wikidot';

  /** Avatar URL (null for system user) */
  public readonly avatarUrl: string | null = null;

  /** IP address (null for system user) */
  public readonly ip: string | null = null;

  /** User type */
  public readonly userType: UserType = 'wikidot';

  constructor(client: ClientRef) {
    this.client = client;
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
    return false;
  }
  isWikidotUser(): boolean {
    return true;
  }

  toString(): string {
    return `WikidotUser(name=${this.name}, unixName=${this.unixName})`;
  }
}
