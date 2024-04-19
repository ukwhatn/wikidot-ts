import axios, { AxiosResponse } from 'axios'
import { Semaphore } from 'async-mutex'
import { Client } from '../module/client'

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
  static request = async (
    client: Client,
    method: 'GET' | 'POST',
    urls: string[],
    returnExceptions: boolean = false,
  ): Promise<(AxiosResponse | Error)[]> => {
    const config = client.amcClient.config
    const semaphore = new Semaphore(config.semaphoreLimit)

    const _get = async (url: string): Promise<AxiosResponse> => {
      await semaphore.acquire()
      try {
        return await axios.get(url)
      } finally {
        semaphore.release()
      }
    }

    const _post = async (url: string): Promise<AxiosResponse> => {
      await semaphore.acquire()
      try {
        return await axios.post(url)
      } finally {
        semaphore.release()
      }
    }

    const _execute = async (): Promise<(AxiosResponse | Error)[]> => {
      if (method === 'GET') {
        return Promise.all(
          urls.map((url) => _get(url).catch((error) => (returnExceptions ? error : Promise.reject(error)))),
        )
      } else if (method === 'POST') {
        return Promise.all(
          urls.map((url) => _post(url).catch((error) => (returnExceptions ? error : Promise.reject(error)))),
        )
      } else {
        throw new Error('Invalid method')
      }
    }

    return _execute()
  }
}

export { RequestUtil }
