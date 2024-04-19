import axios, { AxiosResponse } from 'axios'
import { Semaphore } from 'async-mutex'

import {
    AMCHttpStatusCodeException,
    NotFoundException,
    ResponseDataException,
    WikidotStatusCodeException,
} from '../common/exceptions'
import { logger } from '../common'

declare module 'axios' {
    interface AxiosRequestConfig {
        retryLimit?: number
        retryCount?: number
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
class AjaxRequestHeader {
    private readonly contentType: string
    private readonly userAgent: string
    private readonly referer: string
    private readonly cookie: { [key: string]: any }

    /**
     * @constructor
     * @param contentType Content-Type
     * @param userAgent User-Agent
     * @param referer Referer
     * @param cookie Cookie
     */
    constructor(
        contentType: string | null = null,
        userAgent: string | null = null,
        referer: string | null = null,
        cookie: { [key: string]: any } | null = null,
    ) {
        this.contentType = contentType ?? 'application/x-www-form-urlencoded; charset=UTF-8'
        this.userAgent = userAgent ?? 'WikidotTS'
        this.referer = referer ?? 'https://www.wikidot.com/'
        this.cookie = { wikidot_token7: 123456 }
        if (cookie) {
            this.cookie = { ...this.cookie, ...cookie }
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
    public setCookie(name: string, value: any): void {
        this.cookie[name] = value
    }

    /**
     * @method deleteCookie
     * @description Cookieを削除する
     * @param name Cookie名
     * @version 1.0.0
     * @since 1.0.0
     * @public
     */
    public deleteCookie(name: string): void {
        /**
         * Cookieを削除する
         *
         * @param name Cookie名
         */
        delete this.cookie[name]
    }

    /**
     * @method getHeader
     * @description ヘッダを構築して返す
     * @returns ヘッダ
     * @version 1.0.0
     * @since 1.0.0
     * @public
     */
    public getHeader(): { [key: string]: any } {
        return {
            'Content-Type': this.contentType,
            'User-Agent': this.userAgent,
            Referer: this.referer,
            Cookie: Object.entries(this.cookie)
                .map(([name, value]) => `${name}=${value};`)
                .join(''),
        }
    }
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
    requestTimeout: number
    attemptLimit: number
    retryInterval: number
    semaphoreLimit: number
}

/**
 * @constant defaultConfig
 * @description デフォルトの設定
 * @type {AjaxModuleConnectorConfig}
 * @version 1.0.0
 * @since 1.0.0
 * @public
 */
const defaultConfig: AjaxModuleConnectorConfig = {
    requestTimeout: 20,
    attemptLimit: 3,
    retryInterval: 5,
    semaphoreLimit: 10,
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
class AjaxModuleConnectorClient {
    private readonly siteName: string
    public config: AjaxModuleConnectorConfig
    private sslSupported: boolean
    header: AjaxRequestHeader
    private isInitialized: boolean
    private semaphore: Semaphore

    /**
     * @constructor
     * @description クライアントを初期化する
     * @param siteName サイト名
     * @param config 設定
     * @version 1.0.0
     * @since 1.0.0
     * @public
     */
    constructor(siteName: string | null = null, config: Partial<AjaxModuleConnectorConfig> | null = null) {
        this.siteName = siteName ?? 'www'
        this.config = { ...defaultConfig, ...(config ?? {}) }
        this.sslSupported = false
        this.header = new AjaxRequestHeader()

        // セマフォを初期化
        this.semaphore = new Semaphore(this.config.semaphoreLimit)

        // サイトの存在確認とSSL対応確認
        this.isInitialized = false
        this.checkExistenceAndSSL().then((sslSupported) => {
            this.sslSupported = sslSupported
            this.isInitialized = true
        })
    }

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
    private checkExistenceAndSSL = async (): Promise<boolean> => {
        // wwwは存在し、SSL対応している
        if (this.siteName === 'www') {
            return true
        }

        // サイトの存在確認
        const response = await axios.get(`http://${this.siteName}.wikidot.com`, {
            maxRedirects: 0,
            validateStatus: (status) => status === 200 || status === 301 || status === 404,
        })

        // サイトが存在しない場合は例外を投げる
        if (response.status === 404) {
            throw new NotFoundException(`Site is not found: ${this.siteName}.wikidot.com`)
        }

        // 301リダイレクトが発生し、かつhttpsにリダイレクトされている場合はSSL対応していると判断
        return (
            response.status === 301 && response.headers['location'] && response.headers['location'].startsWith('https')
        )
    }

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
    request = async (
        bodies: Record<string, any>[],
        returnExceptions: boolean = false,
        siteName?: string,
        siteSSLSupported?: boolean,
    ): Promise<(Error | AxiosResponse)[]> => {
        // 初期化が完了するまで待つ
        while (!this.isInitialized) {
            await new Promise((resolve) => setTimeout(resolve, 100))
        }

        const _siteName = siteName ?? this.siteName
        const _siteSSLSupported = siteSSLSupported ?? this.sslSupported

        // リクエストを送信するクライアントを生成
        const axiosClient = axios.create({
            headers: this.header.getHeader(),
            timeout: this.config.requestTimeout * 1000, // ms Pythonのrequestsと合わせるために秒からmsに変換
            validateStatus: (status) => status === 200,
            retryCount: 0,
            retryLimit: this.config.attemptLimit,
        })

        // リトライ処理をinterceptorで実装
        axiosClient.interceptors.response.use(
            // リクエスト成功時はそのまま返す
            (response) => response,
            // リクエスト失敗時はリトライ処理へ
            async (error) => {
                const config = error.config
                if (config && config.retryCount < config.retryLimit) {
                    // リトライ回数をインクリメント、リトライ間隔分待機してから再リクエスト
                    config.retryCount++
                    await new Promise((resolve) => setTimeout(resolve, this.config.retryInterval * 1000))
                    return axiosClient.request(config)
                }

                // リトライ回数が上限に達した場合はエラーを送出
                throw new AMCHttpStatusCodeException(
                    `AMC is respond HTTP error code: ${error.response.status}`,
                    error.response.status,
                )
            },
        )

        const requestPromises = bodies.map(async (body) => {
            let retryCount = 0

            // eslint-disable-next-line no-constant-condition
            while (true) {
                // Mutexで同時実行数制御
                await this.semaphore.acquire()

                const url = `http${_siteSSLSupported ? 's' : ''}://${_siteName}.wikidot.com/ajax-module-connector.php`
                body.wikidot_token7 = 123456

                logger.debug(`Ajax Request: ${url} -> ${JSON.stringify(body)}`)

                // リクエストを送信
                // 200以外のステータスコードが返ってきたらエラーとして扱う
                const response = await axiosClient.post(url, body)

                // Mutexを解放
                this.semaphore.release()

                // レスポンスが空だったらエラーとして扱う
                if (!response.data || Object.keys(response.data).length === 0) {
                    logger.error(`AMC is respond empty data -> ${JSON.stringify(body)}`)
                    throw new ResponseDataException('AMC is respond empty data')
                }

                // 中身のstatusがokでなかったらエラーとして扱う
                if ('status' in response.data) {
                    // statusがtry_againの場合はリトライ
                    if (response.data.status === 'try_again') {
                        retryCount++
                        // リトライ回数が上限に達した場合はエラーを送出
                        if (retryCount >= this.config.attemptLimit) {
                            logger.error(`AMC is respond status: "try_again" -> ${JSON.stringify(body)}`)
                            throw new WikidotStatusCodeException('AMC is respond status: "try_again"', 'try_again')
                        }
                        // リトライ回数が上限に達していない場合はリトライ
                        logger.info(`AMC is respond status: "try_again" (retry: ${retryCount})`)
                        await new Promise((resolve) => setTimeout(resolve, this.config.retryInterval * 1000))
                        continue
                    }
                    // それ以外でstatusがokでない場合はエラーとして扱う
                    else if (response.data.status !== 'ok') {
                        logger.error(
                            `AMC is respond error status: "${response.data.status}" -> ${JSON.stringify(body)}`,
                        )
                        throw new Error(`AMC is respond error status: "${response.data.status}"`)
                    }
                }

                // レスポンスを返す
                return response
            }
        })

        return Promise.all(requestPromises.map((p) => (returnExceptions ? p.catch((e) => e) : p)))
    }
}

export { AjaxModuleConnectorClient, AjaxModuleConnectorConfig, AjaxRequestHeader }
