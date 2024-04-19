import axios from 'axios'
import { NotFoundException } from '../common/exceptions'

/**
 * @class QMCUser
 * @description QuickModuleで得られるユーザー情報
 * @version 1.0.0
 * @since 1.0.0
 * @public
 */
class QMCUser {
    constructor(
        public id: number,
        public name: string,
    ) {
        this.id = id
        this.name = name
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
    constructor(
        public title: string,
        public unixName: string,
    ) {
        this.title = title
        this.unixName = unixName
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
    private static _request = async (moduleName: string, siteId: number, query: string): Promise<any> => {
        if (!['MemberLookupQModule', 'UserLookupQModule', 'PageLookupQModule'].includes(moduleName)) {
            throw new Error('Invalid module name')
        }

        const url = `https://www.wikidot.com/quickmodule.php?module=${moduleName}&s=${siteId}&q=${query}`
        try {
            const response = await axios.get(url, { timeout: 300 * 1000 })
            return response.data
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 500) {
                throw new NotFoundException('Site is not found')
            }
            throw error
        }
    }

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
    static memberLookup = async (siteId: number, query: string): Promise<QMCUser[]> => {
        const data = await QuickModule._request('MemberLookupQModule', siteId, query)
        return data.users.map((user: any) => new QMCUser(parseInt(user.user_id, 10), user.name))
    }

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
    static userLookup = async (siteId: number, query: string): Promise<QMCUser[]> => {
        const data = await QuickModule._request('UserLookupQModule', siteId, query)
        return data.users.map((user: any) => new QMCUser(parseInt(user.user_id, 10), user.name))
    }

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
    static pageLookup = async (siteId: number, query: string): Promise<QMCPage[]> => {
        const data = await QuickModule._request('PageLookupQModule', siteId, query)
        return data.pages.map((page: any) => new QMCPage(page.title, page.unix_name))
    }
}

export { QuickModule }
