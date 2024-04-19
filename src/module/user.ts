import { Client } from './client'
import { NotFoundException } from '../common/exceptions'
import { StringUtil, RequestUtil } from '../util'
import { load } from 'cheerio'

/**
 * @class UserCollection
 * @extends Array
 * @description ユーザーオブジェクトのリスト
 */
class UserCollection extends Array<User | null> {
    /**
     * @method fromNames
     * @description ユーザー名のリストからユーザーオブジェクトのリストを取得
     * @param client - クライアント
     * @param names - ユーザー名のリスト
     * @param raiseWhenNotFound - ユーザーが見つからなかった場合に例外を発生させるかどうか（デフォルトは false）
     */
    static async fromNames(
        client: Client,
        names: string[],
        raiseWhenNotFound: boolean = false,
    ): Promise<UserCollection> {
        const responses = await RequestUtil.request(
            client,
            'GET',
            names.map((name) => `https://www.wikidot.com/user:info/${StringUtil.toUnix(name)}`),
        )

        const users: (User | null)[] = []

        for (const response of responses) {
            if (response instanceof Error) {
                throw response
            }

            const html = load(response.data)

            // Check if user exists
            if (html('div.error-block').length > 0) {
                if (raiseWhenNotFound) {
                    throw new NotFoundException(`User not found: ${response.config.url}`)
                } else {
                    users.push(null)
                    continue
                }
            }

            // Get user ID
            const userId = Number(html('a.btn.btn-default.btn-xs').attr('href')?.split('/')?.pop())

            // Get user name
            const name = html('h1.profile-title').text().trim()

            // Get avatar URL
            const avatarUrl = `https://www.wikidot.com/avatar.php?userid=${userId}`

            users.push(new User(client, userId, name, StringUtil.toUnix(name), avatarUrl))
        }

        return new UserCollection(...users)
    }
}

abstract class AbstractUser {
    constructor(
        public client: Client,
        public id: number | null = null,
        public name: string | null = null,
        public unixName: string | null = null,
        public avatarUrl: string | null = null,
        public ip: string | null = null,
    ) {}

    toString(): string {
        return `${this.constructor.name}(id=${this.id}, name=${this.name}, unixName=${this.unixName})`
    }
}

class User extends AbstractUser {
    ip: null = null

    static async fromName(client: Client, name: string, raiseWhenNotFound: boolean = false): Promise<User | null> {
        return (await UserCollection.fromNames(client, [name], raiseWhenNotFound))[0]
    }
}

class DeletedUser extends AbstractUser {
    name: string = 'account deleted'
    unixName: string = 'account_deleted'
    avatarUrl: null = null
    ip: null = null
}

class AnonymousUser extends AbstractUser {
    id: null = null
    name: string = 'Anonymous'
    unixName: string = 'anonymous'
    avatarUrl: null = null
}

class GuestUser extends AbstractUser {
    id: null = null
    unixName: null = null
    avatarUrl: null = null
    ip: null = null
}

class WikidotUser extends AbstractUser {
    id: null = null
    name: string = 'Wikidot'
    unixName: string = 'wikidot'
    avatarUrl: null = null
    ip: null = null
}

export { UserCollection, AbstractUser, User, DeletedUser, AnonymousUser, GuestUser, WikidotUser }
