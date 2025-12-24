import type { User } from './user';

/**
 * User collection
 */
export class UserCollection extends Array<User | null> {
  constructor(users?: (User | null)[]) {
    super();
    if (users) {
      this.push(...users);
    }
  }

  /**
   * Find by username
   * @param name - Username
   * @returns User or undefined
   */
  findByName(name: string): User | undefined {
    const lowerName = name.toLowerCase();
    for (const user of this) {
      if (user && user.name.toLowerCase() === lowerName) {
        return user;
      }
    }
    return undefined;
  }

  /**
   * Find by user ID
   * @param id - User ID
   * @returns User or undefined
   */
  findById(id: number): User | undefined {
    for (const user of this) {
      if (user && user.id === id) {
        return user;
      }
    }
    return undefined;
  }

  /**
   * Return only non-null users
   * @returns Array of non-null users
   */
  filterNonNull(): User[] {
    return this.filter((user): user is User => user !== null);
  }
}
