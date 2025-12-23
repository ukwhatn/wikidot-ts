import type { User } from './user';

/**
 * ユーザーコレクション
 */
export class UserCollection extends Array<User | null> {
  constructor(users?: (User | null)[]) {
    super();
    if (users) {
      this.push(...users);
    }
  }

  /**
   * ユーザー名で検索
   * @param name - ユーザー名
   * @returns ユーザーまたはundefined
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
   * ユーザーIDで検索
   * @param id - ユーザーID
   * @returns ユーザーまたはundefined
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
   * nullを除いたユーザーのみを返す
   * @returns null以外のユーザー配列
   */
  filterNonNull(): User[] {
    return this.filter((user): user is User => user !== null);
  }
}
