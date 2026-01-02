import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { NoElementError, NotFoundException, UnexpectedError } from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { DEFAULT_AMC_CONFIG } from '../../connector/amc-config';
import { fetchWithRetry } from '../../util/http';
import { toUnix } from '../../util/string-util';
import type { ClientRef } from '../types';
import type { AbstractUser, UserType } from './abstract-user';
import { UserCollection } from './user-collection';

/**
 * User data
 */
export interface UserData {
  id: number;
  name: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  unixName?: string;
}

/**
 * Regular user
 */
export class User implements AbstractUser {
  public readonly client: ClientRef;

  /** User ID */
  public readonly id: number;

  /** Username */
  public readonly name: string;

  /** Display name */
  public readonly displayName: string | null;

  /** Avatar URL */
  public readonly avatarUrl: string | null;

  /** UNIX format username */
  public readonly unixName: string;

  /** IP address (null for regular users) */
  public readonly ip: string | null = null;

  /** User type */
  public readonly userType: UserType = 'user';

  constructor(client: ClientRef, data: UserData) {
    this.client = client;
    this.id = data.id;
    this.name = data.name;
    this.displayName = data.displayName ?? null;
    this.avatarUrl = data.avatarUrl ?? `https://www.wikidot.com/avatar.php?userid=${data.id}`;
    this.unixName = data.unixName ?? toUnix(data.name);
  }

  /**
   * Get user from username
   * @param client - Client
   * @param name - Username
   * @returns User (null if not found)
   */
  static fromName(client: ClientRef, name: string): WikidotResultAsync<User | null> {
    return fromPromise(
      (async () => {
        const unixName = toUnix(name);
        const url = `https://www.wikidot.com/user:info/${unixName}`;

        const response = await fetchWithRetry(url, DEFAULT_AMC_CONFIG, {
          checkOk: false, // Handle HTTP errors manually
        });
        if (!response.ok) {
          throw new UnexpectedError(`Failed to fetch user info: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Check existence
        if ($('div.error-block').length > 0) {
          return null;
        }

        // Get id
        const userIdElem = $('a.btn.btn-default.btn-xs');
        if (userIdElem.length === 0) {
          throw new NoElementError('User ID element not found');
        }
        const href = userIdElem.attr('href');
        if (!href) {
          throw new NoElementError('User ID href not found');
        }
        const userId = Number.parseInt(href.split('/').pop() ?? '0', 10);

        // Get name
        const nameElem = $('h1.profile-title');
        if (nameElem.length === 0) {
          throw new NoElementError('User name element not found');
        }
        const userName = nameElem.text().trim();

        return new User(client, {
          id: userId,
          name: userName,
          unixName,
        });
      })(),
      (error) => {
        if (error instanceof NotFoundException || error instanceof NoElementError) {
          return error;
        }
        return new UnexpectedError(`Failed to get user: ${String(error)}`);
      }
    );
  }

  /**
   * Get users from multiple usernames
   * @param client - Client
   * @param names - Array of usernames
   * @returns User collection
   */
  static fromNames(client: ClientRef, names: string[]): WikidotResultAsync<UserCollection> {
    return fromPromise(
      (async () => {
        // Limit concurrent connections
        const limit = pLimit(DEFAULT_AMC_CONFIG.semaphoreLimit);

        const results = await Promise.all(
          names.map((name) =>
            limit(async () => {
              const result = await User.fromName(client, name);
              return result.isOk() ? result.value : null;
            })
          )
        );
        return new UserCollection(results);
      })(),
      (error) => new UnexpectedError(`Failed to get users: ${String(error)}`)
    );
  }

  // AbstractUser implementation
  isUser(): boolean {
    return true;
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
    return false;
  }

  toString(): string {
    return `User(id=${this.id}, name=${this.name}, unixName=${this.unixName})`;
  }
}
