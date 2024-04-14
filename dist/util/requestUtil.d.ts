import { AxiosResponse } from 'axios';
import { Client } from '../module/client';
/**
 * @class RequestUtil
 * @description ajax以外のリクエストに関するユーティリティクラス
 * @version 1.0.0
 * @since 1.0.0
 * @public
 * @exports
 */
declare class RequestUtil {
    /**
     * @method request
     * @description リクエストを送信する
     * @param client - クライアント
     * @param method - メソッド(GET/POST)
     * @param urls - URLリスト
     * @param returnExceptions - 例外を返すか（デフォルトはfalse）
     * @returns レスポンス・例外のリスト
     * @version 1.0.0
     * @since 1.0.0
     * @public
     */
    static request: (client: Client, method: 'GET' | 'POST', urls: string[], returnExceptions?: boolean) => Promise<(AxiosResponse | Error)[]>;
}
export { RequestUtil };
