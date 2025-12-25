import type { ClientRef } from '../types';
import type { AbstractUser, UserType } from './abstract-user';

/**
 * Deleted user
 */
export class DeletedUser implements AbstractUser {
  public readonly client: ClientRef;

  /** Deleted user ID */
  public readonly id: number;

  /** Username ("account deleted" for deleted users) */
  public readonly name: string = 'account deleted';

  /** UNIX format username */
  public readonly unixName: string = 'account_deleted';

  /** Avatar URL (null for deleted) */
  public readonly avatarUrl: string | null = null;

  /** IP address (null for deleted) */
  public readonly ip: string | null = null;

  /** User type */
  public readonly userType: UserType = 'deleted';

  constructor(client: ClientRef, id: number) {
    this.client = client;
    this.id = id;
  }

  // AbstractUser implementation
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
