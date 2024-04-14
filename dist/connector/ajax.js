"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AjaxRequestHeader = exports.AjaxModuleConnectorClient = void 0;
const axios_1 = __importDefault(require("axios"));
const async_mutex_1 = require("async-mutex");
const exceptions_1 = require("../common/exceptions");
const common_1 = require("../common");
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
class AjaxRequestHeader {
    /**
     * @constructor
     * @param contentType Content-Type
     * @param userAgent User-Agent
     * @param referer Referer
     * @param cookie Cookie
     */
    constructor(contentType = null, userAgent = null, referer = null, cookie = null) {
        this.contentType = contentType ?? 'application/x-www-form-urlencoded; charset=UTF-8';
        this.userAgent = userAgent ?? 'WikidotTS';
        this.referer = referer ?? 'https://www.wikidot.com/';
        this.cookie = { wikidot_token7: 123456 };
        if (cookie) {
            this.cookie = { ...this.cookie, ...cookie };
        }
    }
    /**
     * @method setCookie
     * @description Cookieを設定する
     * @param name Cookie名
     * @param value Cookie値
     * @version 1.0.0
     * @since 1.0.0
     * @public
     */
    setCookie(name, value) {
        this.cookie[name] = value;
    }
    /**
     * @method deleteCookie
     * @description Cookieを削除する
     * @param name Cookie名
     * @version 1.0.0
     * @since 1.0.0
     * @public
     */
    deleteCookie(name) {
        /**
         * Cookieを削除する
         *
         * @param name Cookie名
         */
        delete this.cookie[name];
    }
    /**
     * @method getHeader
     * @description ヘッダを構築して返す
     * @returns ヘッダ
     * @version 1.0.0
     * @since 1.0.0
     * @public
     */
    getHeader() {
        return {
            'Content-Type': this.contentType,
            'User-Agent': this.userAgent,
            Referer: this.referer,
            Cookie: Object.entries(this.cookie).map(([name, value]) => `${name}=${value};`).join(''),
        };
    }
}
exports.AjaxRequestHeader = AjaxRequestHeader;
/**
 * @constant defaultConfig
 * @description デフォルトの設定
 * @type {AjaxModuleConnectorConfig}
 * @version 1.0.0
 * @since 1.0.0
 * @public
 */
const defaultConfig = {
    requestTimeout: 20,
    attemptLimit: 3,
    retryInterval: 5,
    semaphoreLimit: 10,
};
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
class AjaxModuleConnectorClient {
    /**
     * @constructor
     * @description クライアントを初期化する
     * @param siteName サイト名
     * @param config 設定
     * @version 1.0.0
     * @since 1.0.0
     * @public
     */
    constructor(siteName = null, config = null) {
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
        this.checkExistenceAndSSL = async () => {
            // wwwは存在し、SSL対応している
            if (this.siteName === 'www') {
                return true;
            }
            // サイトの存在確認
            const response = await axios_1.default.get(`http://${this.siteName}.wikidot.com`, {
                maxRedirects: 0,
                validateStatus: (status) => status === 200 || status === 301 || status === 404,
            });
            // サイトが存在しない場合は例外を投げる
            if (response.status === 404) {
                throw new exceptions_1.NotFoundException(`Site is not found: ${this.siteName}.wikidot.com`);
            }
            // 301リダイレクトが発生し、かつhttpsにリダイレクトされている場合はSSL対応していると判断
            return (response.status === 301 &&
                response.headers['location'] &&
                response.headers['location'].startsWith('https'));
        };
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
        this.request = async (bodies, returnExceptions = false, siteName, siteSSLSupported) => {
            // 初期化が完了するまで待つ
            while (!this.isInitialized) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            const _siteName = siteName ?? this.siteName;
            const _siteSSLSupported = siteSSLSupported ?? this.sslSupported;
            const axiosClient = axios_1.default.create({
                headers: this.header.getHeader(),
                timeout: this.config.requestTimeout,
                validateStatus: (status) => status === 200,
                retryCount: 0,
                retryLimit: this.config.attemptLimit,
            });
            axiosClient.interceptors.response.use((response) => response, async (error) => {
                const config = error.config;
                if (config && config.retryCount < config.retryLimit) {
                    config.retryCount++;
                    await new Promise(resolve => setTimeout(resolve, this.config.retryInterval * 1000));
                    return axiosClient.request(config);
                }
                throw error;
            });
            const requestPromises = bodies.map(async (body) => {
                let retryCount = 0;
                while (true) {
                    // Mutexで同時実行数制御
                    await this.semaphore.acquire();
                    const url = `http${_siteSSLSupported ? 's' : ''}://${_siteName}.wikidot.com/ajax-module-connector.php`;
                    body.wikidot_token7 = 123456;
                    common_1.logger.debug(`Ajax Request: ${url} -> ${JSON.stringify(body)}`);
                    // リクエストを送信
                    // 200以外のステータスコードが返ってきたらエラーとして扱う
                    const response = await axiosClient.post(url, body);
                    // Mutexを解放
                    this.semaphore.release();
                    // レスポンスが空だったらエラーとして扱う
                    if (!response.data || Object.keys(response.data).length === 0) {
                        common_1.logger.error(`AMC is respond empty data -> ${JSON.stringify(body)}`);
                        throw new exceptions_1.ResponseDataException('AMC is respond empty data');
                    }
                    // 中身のstatusがokでなかったらエラーとして扱う
                    if ('status' in response.data) {
                        // statusがtry_againの場合はリトライ
                        if (response.data.status === 'try_again') {
                            retryCount++;
                            if (retryCount >= this.config.attemptLimit) {
                                common_1.logger.error(`AMC is respond status: "try_again" -> ${JSON.stringify(body)}`);
                                throw new exceptions_1.WikidotStatusCodeException('AMC is respond status: "try_again"', 'try_again');
                            }
                            common_1.logger.info(`AMC is respond status: "try_again" (retry: ${retryCount})`);
                            await new Promise((resolve) => setTimeout(resolve, this.config.retryInterval * 1000));
                            continue;
                        }
                        // それ以外でstatusがokでない場合はエラーとして扱う
                        else if (response.data.status !== 'ok') {
                            common_1.logger.error(`AMC is respond error status: "${response.data.status}" -> ${JSON.stringify(body)}`);
                            throw new Error(`AMC is respond error status: "${response.data.status}"`);
                        }
                    }
                    // レスポンスを返す
                    return response;
                }
            });
            return Promise.all(requestPromises.map((p) => (returnExceptions ? p.catch((e) => e) : p)));
        };
        this.siteName = siteName ?? 'www';
        this.config = { ...defaultConfig, ...(config ?? {}) };
        this.sslSupported = false;
        this.header = new AjaxRequestHeader();
        // セマフォを初期化
        this.semaphore = new async_mutex_1.Semaphore(this.config.semaphoreLimit);
        // サイトの存在確認とSSL対応確認
        this.isInitialized = false;
        this.checkExistenceAndSSL().then((sslSupported) => {
            this.sslSupported = sslSupported;
            this.isInitialized = true;
        });
    }
}
exports.AjaxModuleConnectorClient = AjaxModuleConnectorClient;
//# sourceMappingURL=ajax.js.map