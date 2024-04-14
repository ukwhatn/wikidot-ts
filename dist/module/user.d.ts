import { Client } from './client';
/**
 * @class UserCollection
 * @extends Array
 * @description ユーザーオブジェクトのリスト
 */
declare class UserCollection extends Array<User | null> {
    /**
     * @method fromNames
     * @description ユーザー名のリストからユーザーオブジェクトのリストを取得
     * @param client - クライアント
     * @param names - ユーザー名のリスト
     * @param raiseWhenNotFound - ユーザーが見つからなかった場合に例外を発生させるかどうか（デフォルトは false）
     */
    static fromNames(client: Client, names: string[], raiseWhenNotFound?: boolean): Promise<UserCollection>;
}
declare abstract class AbstractUser {
    client: Client;
    id: number | null;
    name: string | null;
    unixName: string | null;
    avatarUrl: string | null;
    ip: string | null;
    constructor(client: Client, id?: number | null, name?: string | null, unixName?: string | null, avatarUrl?: string | null, ip?: string | null);
    toString(): string;
}
declare class User extends AbstractUser {
    ip: null;
    static fromName(client: Client, name: string, raiseWhenNotFound?: boolean): Promise<User | null>;
}
declare class DeletedUser extends AbstractUser {
    name: string;
    unixName: string;
    avatarUrl: null;
    ip: null;
}
declare class AnonymousUser extends AbstractUser {
    id: null;
    name: string;
    unixName: string;
    avatarUrl: null;
}
declare class GuestUser extends AbstractUser {
    id: null;
    unixName: null;
    avatarUrl: null;
    ip: null;
}
declare class WikidotUser extends AbstractUser {
    id: null;
    name: string;
    unixName: string;
    avatarUrl: null;
    ip: null;
}
export { UserCollection, AbstractUser, User, DeletedUser, AnonymousUser, GuestUser, WikidotUser };
