/**
 * @class QMCUser
 * @description QuickModuleで得られるユーザー情報
 * @version 1.0.0
 * @since 1.0.0
 * @public
 */
declare class QMCUser {
    id: number;
    name: string;
    constructor(id: number, name: string);
}
/**
 * @class QMCPage
 * @description QuickModuleで得られるページ情報
 * @version 1.0.0
 * @since 1.0.0
 * @public
 */
declare class QMCPage {
    title: string;
    unixName: string;
    constructor(title: string, unixName: string);
}
/**
 * @class QuickModule
 * @description QuickModuleを利用するためのユーティリティクラス
 * @version 1.0.0
 * @since 1.0.0
 * @public
 * @exports
 */
declare class QuickModule {
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
    private static _request;
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
    static memberLookup: (siteId: number, query: string) => Promise<QMCUser[]>;
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
    static userLookup: (siteId: number, query: string) => Promise<QMCUser[]>;
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
    static pageLookup: (siteId: number, query: string) => Promise<QMCPage[]>;
}
export { QuickModule };
