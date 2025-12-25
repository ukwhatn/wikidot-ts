import { NotFoundException } from '../../../common/errors';
import { type WikidotResultAsync, wdErrAsync, wdOkAsync } from '../../../common/types';
import { User, type UserCollection } from '../../user';
import type { Client } from '../client';

/**
 * User retrieval options
 */
export interface GetUserOptions {
  /** Throw error if user not found (default: false) */
  raiseWhenNotFound?: boolean;
}

/**
 * User operations accessor
 */
export class UserAccessor {
  public readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Get user by username
   *
   * @param name - Username
   * @param options - Retrieval options
   * @returns User wrapped in Result type (null if not found, error if raiseWhenNotFound is true)
   *
   * @example
   * ```typescript
   * const userResult = await client.user.get('username');
   * if (!userResult.isOk()) {
   *   throw new Error('Failed to get user');
   * }
   * const user = userResult.value;
   * ```
   */
  get(name: string, options: GetUserOptions = {}): WikidotResultAsync<User | null> {
    const { raiseWhenNotFound = false } = options;

    return User.fromName(this.client, name).andThen((user) => {
      if (user === null && raiseWhenNotFound) {
        return wdErrAsync(new NotFoundException(`User not found: ${name}`));
      }
      return wdOkAsync(user);
    });
  }

  /**
   * Get users from multiple usernames
   * @param names - Array of usernames
   * @param options - Retrieval options
   * @returns User collection (null for non-existent users, error if raiseWhenNotFound is true)
   */
  getMany(names: string[], options: GetUserOptions = {}): WikidotResultAsync<UserCollection> {
    const { raiseWhenNotFound = false } = options;

    return User.fromNames(this.client, names).andThen((collection) => {
      if (raiseWhenNotFound) {
        const notFoundNames: string[] = [];
        for (let i = 0; i < names.length; i++) {
          const name = names[i];
          if (collection[i] === null && name !== undefined) {
            notFoundNames.push(name);
          }
        }
        if (notFoundNames.length > 0) {
          return wdErrAsync(new NotFoundException(`Users not found: ${notFoundNames.join(', ')}`));
        }
      }
      return wdOkAsync(collection);
    });
  }
}
