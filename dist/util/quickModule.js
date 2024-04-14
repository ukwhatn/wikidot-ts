"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuickModule = void 0;
const axios_1 = __importDefault(require("axios"));
const exceptions_1 = require("../common/exceptions");
/**
 * @class QMCUser
 * @description QuickModuleで得られるユーザー情報
 * @version 1.0.0
 * @since 1.0.0
 * @public
 */
class QMCUser {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.id = id;
        this.name = name;
    }
}
/**
 * @class QMCPage
 * @description QuickModuleで得られるページ情報
 * @version 1.0.0
 * @since 1.0.0
 * @public
 */
class QMCPage {
    constructor(title, unixName) {
        this.title = title;
        this.unixName = unixName;
        this.title = title;
        this.unixName = unixName;
    }
}
/**
 * @class QuickModule
 * @description QuickModuleを利用するためのユーティリティクラス
 * @version 1.0.0
 * @since 1.0.0
 * @public
 * @exports
 */
class QuickModule {
}
exports.QuickModule = QuickModule;
_a = QuickModule;
/**
 * @method _request
 * @description QuickModuleにリクエストを送信する
 * @param moduleName モジュール名
 * @param siteId サイトID
 * @param query クエリ
 * @returns レスポンスボディ
 * @version 1.0.0
 * @since 1.0.0
 * @private
 * @static
 * @async
 * @throws {NotFoundException} サイトが見つからない場合
 * @throws {Error} その他のエラー
 */
QuickModule._request = async (moduleName, siteId, query) => {
    if (!['MemberLookupQModule', 'UserLookupQModule', 'PageLookupQModule'].includes(moduleName)) {
        throw new Error('Invalid module name');
    }
    const url = `https://www.wikidot.com/quickmodule.php?module=${moduleName}&s=${siteId}&q=${query}`;
    try {
        const response = await axios_1.default.get(url, { timeout: 300 * 1000 });
        return response.data;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error) && error.response?.status === 500) {
            throw new exceptions_1.NotFoundException('Site is not found');
        }
        throw error;
    }
};
/**
 * @method memberLookup
 * @description メンバーを検索する
 * @param siteId サイトID
 * @param query クエリ（ユーザ名の一部）
 * @returns ヒットしたユーザ情報のリスト
 * @version 1.0.0
 * @since 1.0.0
 * @public
 * @static
 * @async
 * @throws {NotFoundException} サイトが見つからない場合
 * @throws {Error} その他のエラー
 */
QuickModule.memberLookup = async (siteId, query) => {
    const data = await _a._request('MemberLookupQModule', siteId, query);
    return data.users.map((user) => new QMCUser(user.user_id, user.name));
};
/**
 * @method userLookup
 * @description ユーザーを検索する
 * @param siteId サイトID
 * @param query クエリ（ユーザ名の一部）
 * @returns ヒットしたユーザ情報のリスト
 * @version 1.0.0
 * @since 1.0.0
 * @public
 * @static
 * @async
 * @throws {NotFoundException} サイトが見つからない場合
 * @throws {Error} その他のエラー
 */
QuickModule.userLookup = async (siteId, query) => {
    const data = await _a._request('UserLookupQModule', siteId, query);
    return data.users.map((user) => new QMCUser(user.user_id, user.name));
};
/**
 * @method pageLookup
 * @description ページを検索する
 * @param siteId サイトID
 * @param query クエリ（ページ名の一部）
 * @returns ヒットしたページ情報のリスト
 * @version 1.0.0
 * @since 1.0.0
 * @public
 * @static
 * @async
 * @throws {NotFoundException} サイトが見つからない場合
 * @throws {Error} その他のエラー
 */
QuickModule.pageLookup = async (siteId, query) => {
    const data = await _a._request('PageLookupQModule', siteId, query);
    return data.pages.map((page) => new QMCPage(page.title, page.unix_name));
};
//# sourceMappingURL=quickModule.js.map