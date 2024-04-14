"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikidotUser = exports.GuestUser = exports.AnonymousUser = exports.DeletedUser = exports.User = exports.AbstractUser = exports.UserCollection = void 0;
const exceptions_1 = require("../common/exceptions");
const util_1 = require("../util");
const cheerio_1 = require("cheerio");
/**
 * @class UserCollection
 * @extends Array
 * @description ユーザーオブジェクトのリスト
 */
class UserCollection extends Array {
    /**
     * @method fromNames
     * @description ユーザー名のリストからユーザーオブジェクトのリストを取得
     * @param client - クライアント
     * @param names - ユーザー名のリスト
     * @param raiseWhenNotFound - ユーザーが見つからなかった場合に例外を発生させるかどうか（デフォルトは false）
     */
    static async fromNames(client, names, raiseWhenNotFound = false) {
        const responses = await util_1.RequestUtil.request(client, 'GET', names.map(name => `https://www.wikidot.com/user:info/${util_1.StringUtil.toUnix(name)}`));
        const users = [];
        for (const response of responses) {
            if (response instanceof Error) {
                throw response;
            }
            const html = (0, cheerio_1.load)(response.data);
            // Check if user exists
            if (html('div.error-block').length > 0) {
                if (raiseWhenNotFound) {
                    throw new exceptions_1.NotFoundException(`User not found: ${response.config.url}`);
                }
                else {
                    users.push(null);
                    continue;
                }
            }
            // Get user ID
            const userId = Number(html('a.btn.btn-default.btn-xs').attr('href')?.split('/')?.pop());
            // Get user name
            const name = html('h1.profile-title').text().trim();
            // Get avatar URL
            const avatarUrl = `https://www.wikidot.com/avatar.php?userid=${userId}`;
            users.push(new User(client, userId, name, util_1.StringUtil.toUnix(name), avatarUrl));
        }
        return new UserCollection(...users);
    }
}
exports.UserCollection = UserCollection;
class AbstractUser {
    constructor(client, id = null, name = null, unixName = null, avatarUrl = null, ip = null) {
        this.client = client;
        this.id = id;
        this.name = name;
        this.unixName = unixName;
        this.avatarUrl = avatarUrl;
        this.ip = ip;
    }
    toString() {
        return `${this.constructor.name}(id=${this.id}, name=${this.name}, unixName=${this.unixName})`;
    }
}
exports.AbstractUser = AbstractUser;
class User extends AbstractUser {
    constructor() {
        super(...arguments);
        this.ip = null;
    }
    static async fromName(client, name, raiseWhenNotFound = false) {
        return (await UserCollection.fromNames(client, [name], raiseWhenNotFound))[0];
    }
}
exports.User = User;
class DeletedUser extends AbstractUser {
    constructor() {
        super(...arguments);
        this.name = "account deleted";
        this.unixName = "account_deleted";
        this.avatarUrl = null;
        this.ip = null;
    }
}
exports.DeletedUser = DeletedUser;
class AnonymousUser extends AbstractUser {
    constructor() {
        super(...arguments);
        this.id = null;
        this.name = "Anonymous";
        this.unixName = "anonymous";
        this.avatarUrl = null;
    }
}
exports.AnonymousUser = AnonymousUser;
class GuestUser extends AbstractUser {
    constructor() {
        super(...arguments);
        this.id = null;
        this.unixName = null;
        this.avatarUrl = null;
        this.ip = null;
    }
}
exports.GuestUser = GuestUser;
class WikidotUser extends AbstractUser {
    constructor() {
        super(...arguments);
        this.id = null;
        this.name = "Wikidot";
        this.unixName = "wikidot";
        this.avatarUrl = null;
        this.ip = null;
    }
}
exports.WikidotUser = WikidotUser;
//# sourceMappingURL=user.js.map