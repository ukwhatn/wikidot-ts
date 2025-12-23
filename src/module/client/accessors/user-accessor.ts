import { NotFoundException } from '../../../common/errors';
import { type WikidotResultAsync, wdErrAsync, wdOkAsync } from '../../../common/types';
import { User, type UserCollection } from '../../user';
import type { Client } from '../client';

/**
 * ユーザー取得オプション
 */
export interface GetUserOptions {
  /** ユーザーが見つからない場合にエラーを発生させる（デフォルト: false） */
  raiseWhenNotFound?: boolean;
}

/**
 * ユーザー操作アクセサ
 */
export class UserAccessor {
  public readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * ユーザー名からユーザーを取得する
   * @param name - ユーザー名
   * @param options - 取得オプション
   * @returns ユーザー（存在しない場合はnull、raiseWhenNotFoundがtrueの場合はエラー）
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
   * 複数ユーザー名からユーザーを取得する
   * @param names - ユーザー名配列
   * @param options - 取得オプション
   * @returns ユーザーコレクション（存在しないユーザーはnull、raiseWhenNotFoundがtrueの場合はエラー）
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
