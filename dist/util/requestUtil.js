"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestUtil = void 0;
const axios_1 = __importDefault(require("axios"));
const async_mutex_1 = require("async-mutex");
// TODO: パラメータセット用のclassを作成し、POSTのbodyを設定できるようにする
/**
 * @class RequestUtil
 * @description ajax以外のリクエストに関するユーティリティクラス
 * @version 1.0.0
 * @since 1.0.0
 * @public
 * @exports
 */
class RequestUtil {
}
exports.RequestUtil = RequestUtil;
_a = RequestUtil;
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
RequestUtil.request = async (client, method, urls, returnExceptions = false) => {
    const config = client.amcClient.config;
    const semaphore = new async_mutex_1.Semaphore(config.semaphoreLimit);
    const _get = async (url) => {
        await semaphore.acquire();
        try {
            return await axios_1.default.get(url);
        }
        finally {
            semaphore.release();
        }
    };
    const _post = async (url) => {
        await semaphore.acquire();
        try {
            return await axios_1.default.post(url);
        }
        finally {
            semaphore.release();
        }
    };
    const _execute = async () => {
        if (method === 'GET') {
            return Promise.all(urls.map((url) => _get(url).catch((error) => (returnExceptions ? error : Promise.reject(error)))));
        }
        else if (method === 'POST') {
            return Promise.all(urls.map((url) => _post(url).catch((error) => (returnExceptions ? error : Promise.reject(error)))));
        }
        else {
            throw new Error('Invalid method');
        }
    };
    return _execute();
};
//# sourceMappingURL=requestUtil.js.map