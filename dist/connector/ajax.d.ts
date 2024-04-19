import { AxiosResponse } from 'axios';
declare module 'axios' {
    interface AxiosRequestConfig {
        retryLimit?: number;
        retryCount?: number;
    }
}
/**
 * @class AjaxRequestHeader
 * @description ajax-module-connector.phpへのリクエスト時に利用するヘッダの構築用クラス
 * @property contentType Content-Type
 * @property userAgent User-Agent
 * @property referer Referer
 * @property cookie Cookie
 * @version 1.0.0
 * @since 1.0.0
 * @public
 * @exports
 */
declare class AjaxRequestHeader {
    private readonly contentType;
    private readonly userAgent;
    private readonly referer;
    private readonly cookie;
    /**
     * @constructor
     * @param contentType Content-Type
     * @param userAgent User-Agent
     * @param referer Referer
     * @param cookie Cookie
     */
    constructor(contentType?: string | null, userAgent?: string | null, referer?: string | null, cookie?: {
        [key: string]: any;
    } | null);
    /**
     * @method setCookie
     * @description Cookieを設定する
     * @param name Cookie名
     * @param value Cookie値
     * @version 1.0.0
     * @since 1.0.0
     * @public
     */
    setCookie(name: string, value: any): void;
    /**
     * @method deleteCookie
     * @description Cookieを削除する
     * @param name Cookie名
     * @version 1.0.0
     * @since 1.0.0
     * @public
     */
    deleteCookie(name: string): void;
    /**
     * @method getHeader
     * @description ヘッダを構築して返す
     * @returns ヘッダ
     * @version 1.0.0
     * @since 1.0.0
     * @public
     */
    getHeader(): {
        [key: string]: any;
    };
}
/**
 * @interface AjaxModuleConnectorConfig
 * @description ajax-module-connector.phpの設定
 * @property requestTimeout - リクエストのタイムアウト時間
 * @property attemptLimit - リトライ回数
 * @property retryInterval - リトライ間隔
 * @property semaphoreLimit - セマフォの上限
 * @version 1.0.0
 * @since 1.0.0
 * @public
 * @exports
 */
interface AjaxModuleConnectorConfig {
    requestTimeout: number;
    attemptLimit: number;
    retryInterval: number;
    semaphoreLimit: number;
}
/**
 * @class AjaxModuleConnectorClient
 * @description ajax-module-connector.phpへのリクエストを行うクライアント
 * @property siteName サイト名
 * @property config 設定
 * @property sslSupported SSL対応しているか
 * @property header ヘッダ
 * @property semaphore セマフォ
 * @version 1.0.0
 * @since 1.0.0
 * @public
 * @exports
 */
declare class AjaxModuleConnectorClient {
    private readonly siteName;
    config: AjaxModuleConnectorConfig;
    private sslSupported;
    header: AjaxRequestHeader;
    private isInitialized;
    private semaphore;
    /**
     * @constructor
     * @description クライアントを初期化する
     * @param siteName サイト名
     * @param config 設定
     * @version 1.0.0
     * @since 1.0.0
     * @public
     */
    constructor(siteName?: string | null, config?: Partial<AjaxModuleConnectorConfig> | null);
    /**
     * @method checkExistenceAndSSL
     * @description サイトの存在確認とSSL対応確認を行う
     * @returns サイトが存在し、かつSSL対応しているか
     * @version 1.0.0
     * @since 1.0.0
     * @private
     * @async
     * @throws {NotFoundException} サイトが見つからない場合
     * @throws {Error} その他のエラー
     * @exports
     */
    private checkExistenceAndSSL;
    /**
     * @method request
     * @description リクエストを送信する
     * @param bodies リクエストボディ
     * @param returnExceptions 例外を返すか
     * @param siteName サイト名
     * @param siteSSLSupported SSL対応しているか
     * @returns レスポンス
     * @version 1.0.0
     * @since 1.0.0
     * @public
     * @async
     */
    request: (bodies: Record<string, any>[], returnExceptions?: boolean, siteName?: string, siteSSLSupported?: boolean) => Promise<(Error | AxiosResponse)[]>;
}
export { AjaxModuleConnectorClient, AjaxModuleConnectorConfig, AjaxRequestHeader };
