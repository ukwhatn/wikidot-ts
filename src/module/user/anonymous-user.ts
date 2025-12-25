import type { ClientRef } from '../types';
import type { AbstractUser, UserType } from './abstract-user';

/**
 * Anonymous user
 */
export class AnonymousUser implements AbstractUser {
  public readonly client: ClientRef;

  /** User ID (0 for anonymous) */
  public readonly id: number = 0;

  /** Username ("Anonymous" for anonymous users) */
  public readonly name: string = 'Anonymous';

  /** UNIX format username */
  public readonly unixName: string = 'anonymous';

  /** Avatar URL (null for anonymous) */
  public readonly avatarUrl: string | null = null;

  /** IP address */
  public readonly ip: string;

  /** User type */
  public readonly userType: UserType = 'anonymous';

  constructor(client: ClientRef, ip: string) {
    this.client = client;
    this.ip = ip;
  }

  // AbstractUser implementation
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
