import ky, { type KyInstance } from 'ky';
import pLimit, { type LimitFunction } from 'p-limit';
import {
  AMCHttpError,
  ForbiddenError,
  NotFoundException,
  ResponseDataError,
  UnexpectedError,
  WikidotError,
  WikidotStatusError,
} from '../common/errors';
import { fromPromise, type WikidotResultAsync, wdErrAsync, wdOkAsync } from '../common/types';
import {
  type AMCConfig,
  DEFAULT_AMC_CONFIG,
  DEFAULT_HTTP_STATUS_CODE,
  WIKIDOT_TOKEN7,
} from './amc-config';
import { AMCHeader } from './amc-header';
import { type AMCRequestBody, type AMCResponse, amcResponseSchema } from './amc-types';

/**
 * 機密情報をマスクする（ログ出力用）
 * @param body - マスク対象のリクエストボディ
 * @returns マスクされたボディ
 */
export function maskSensitiveData(body: AMCRequestBody): Record<string, unknown> {
  const masked = { ...body };
  const sensitiveKeys = ['password', 'login', 'WIKIDOT_SESSION_ID', 'wikidot_token7'];
  for (const key of sensitiveKeys) {
    if (key in masked) {
      masked[key] = '***MASKED***';
    }
  }
  return masked;
}

/**
 * 指数バックオフ間隔を計算する（ジッター付き）
 * @param retryCount - 現在のリトライ回数（1から開始）
 * @param baseInterval - 基本間隔（ミリ秒）
 * @param backoffFactor - バックオフ係数
 * @param maxBackoff - 最大バックオフ間隔（ミリ秒）
 * @returns 計算されたバックオフ間隔（ミリ秒）
 */
function calculateBackoff(
  retryCount: number,
  baseInterval: number,
  backoffFactor: number,
  maxBackoff: number
): number {
  const backoff = baseInterval * backoffFactor ** (retryCount - 1);
  const jitter = Math.random() * backoff * 0.1;
  return Math.min(backoff + jitter, maxBackoff);
}

/**
 * 指定時間待機する
 * @param ms - 待機時間（ミリ秒）
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * AMCリクエストオプション
 */
export interface AMCRequestOptions {
  /** サイト名（デフォルト: www） */
  siteName?: string;
  /** SSL対応（省略時は自動検出） */
  sslSupported?: boolean;
  /** エラーを例外として投げずに結果に含める（デフォルト: false） */
  returnExceptions?: boolean;
}

/**
 * Ajax Module Connectorクライアント
 * Wikidot AMCエンドポイントへのリクエストを管理する
 */
export class AMCClient {
  /** kyインスタンス */
  private readonly ky: KyInstance;

  /** 並列リクエスト制限 */
  private readonly limit: LimitFunction;

  /** ヘッダー管理 */
  public readonly header: AMCHeader;

  /** 設定 */
  public readonly config: AMCConfig;

  /** ベースドメイン */
  public readonly domain: string;

  /** SSL対応状況のキャッシュ */
  private sslCache: Map<string, boolean> = new Map();

  /**
   * @param config - AMC設定（省略時はデフォルト値）
   * @param domain - ベースドメイン（デフォルト: wikidot.com）
   */
  constructor(config: Partial<AMCConfig> = {}, domain = 'wikidot.com') {
    this.config = { ...DEFAULT_AMC_CONFIG, ...config };
    this.domain = domain;
    this.header = new AMCHeader();
    this.limit = pLimit(this.config.semaphoreLimit);

    this.ky = ky.create({
      timeout: this.config.timeout,
      retry: 0, // 手動でリトライを制御
    });

    // wwwは常にSSL対応
    this.sslCache.set('www', true);
  }

  /**
   * サイトの存在とSSL対応状況を確認する
   * @param siteName - サイト名
   * @returns SSL対応状況（true: HTTPS、false: HTTP）
   */
  checkSiteSSL(siteName: string): WikidotResultAsync<boolean> {
    // キャッシュに存在すればそれを返す
    const cached = this.sslCache.get(siteName);
    if (cached !== undefined) {
      return wdOkAsync(cached);
    }

    // wwwは常にSSL対応
    if (siteName === 'www') {
      return wdOkAsync(true);
    }

    return fromPromise(
      (async () => {
        const response = await fetch(`http://${siteName}.${this.domain}`, {
          method: 'GET',
          redirect: 'manual',
        });

        // 404の場合はサイトが存在しない
        if (response.status === 404) {
          throw new NotFoundException(`Site is not found: ${siteName}.${this.domain}`);
        }

        // 301リダイレクトでhttpsに向かう場合はSSL対応
        const isSSL =
          response.status === 301 && response.headers.get('Location')?.startsWith('https') === true;

        // キャッシュに保存
        this.sslCache.set(siteName, isSSL);
        return isSSL;
      })(),
      (error) => {
        if (error instanceof WikidotError) {
          return error;
        }
        return new UnexpectedError(`Failed to check SSL for ${siteName}: ${String(error)}`);
      }
    );
  }

  /**
   * AMCリクエストを実行する
   * @param bodies - リクエストボディ配列
   * @param siteName - サイト名（省略時はwww）
   * @param sslSupported - SSL対応（省略時は自動検出）
   * @returns レスポンス配列
   */
  request(
    bodies: AMCRequestBody[],
    siteName = 'www',
    sslSupported?: boolean
  ): WikidotResultAsync<AMCResponse[]> {
    return this.requestWithOptions(bodies, {
      siteName,
      sslSupported,
      returnExceptions: false,
    }) as WikidotResultAsync<AMCResponse[]>;
  }

  /**
   * AMCリクエストを実行する（オプション指定版）
   * @param bodies - リクエストボディ配列
   * @param options - リクエストオプション
   * @returns レスポンス配列（returnExceptionsがtrueの場合はエラーも含む）
   */
  requestWithOptions(
    bodies: AMCRequestBody[],
    options: AMCRequestOptions = {}
  ): WikidotResultAsync<(AMCResponse | WikidotError)[]> {
    const { siteName = 'www', sslSupported, returnExceptions = false } = options;

    return fromPromise(
      (async () => {
        // SSL対応状況を取得
        let ssl = sslSupported;
        if (ssl === undefined) {
          const sslResult = await this.checkSiteSSL(siteName);
          if (sslResult.isErr()) {
            throw sslResult.error;
          }
          ssl = sslResult.value;
        }

        const protocol = ssl ? 'https' : 'http';
        const url = `${protocol}://${siteName}.${this.domain}/ajax-module-connector.php`;

        // 並列でリクエストを実行
        const results = await Promise.all(
          bodies.map((body) => this.limit(() => this.singleRequest(body, url)))
        );

        if (returnExceptions) {
          // エラーも含めてすべての結果を返す
          return results.map((r) => {
            if (r.isOk()) {
              return r.value;
            }
            return r.error;
          });
        }

        // エラーがあれば最初のエラーをスロー
        const firstError = results.find((r) => r.isErr());
        if (firstError?.isErr()) {
          throw firstError.error;
        }

        return results.map((r) => {
          if (r.isOk()) {
            return r.value;
          }
          throw new UnexpectedError('Unexpected error in result processing');
        });
      })(),
      (error) => {
        if (error instanceof WikidotError) {
          return error;
        }
        return new UnexpectedError(`AMC request failed: ${String(error)}`);
      }
    );
  }

  /**
   * 単一リクエストを実行する内部メソッド
   * @param body - リクエストボディ
   * @param url - リクエストURL
   * @returns レスポンス
   */
  private async singleRequest(
    body: AMCRequestBody,
    url: string
  ): Promise<WikidotResultAsync<AMCResponse>> {
    let retryCount = 0;

    while (true) {
      try {
        // wikidot_token7を追加
        const requestBody = { ...body, wikidot_token7: WIKIDOT_TOKEN7 };

        // URLエンコードされたボディを作成
        const formData = new URLSearchParams();
        for (const [key, value] of Object.entries(requestBody)) {
          if (value !== undefined) {
            formData.append(key, String(value));
          }
        }

        const response = await this.ky.post(url, {
          headers: this.header.getHeaders(),
          body: formData.toString(),
        });

        // JSONとしてパース
        let responseData: unknown;
        try {
          responseData = await response.json();
        } catch {
          return wdErrAsync(
            new ResponseDataError(`AMC responded with non-JSON data: ${await response.text()}`)
          );
        }

        // zodでバリデーション
        const parseResult = amcResponseSchema.safeParse(responseData);
        if (!parseResult.success) {
          return wdErrAsync(
            new ResponseDataError(`Invalid AMC response format: ${parseResult.error.message}`)
          );
        }

        const amcResponse = parseResult.data;

        // try_againの場合はリトライ
        if (amcResponse.status === 'try_again') {
          retryCount++;
          if (retryCount >= this.config.retryLimit) {
            return wdErrAsync(new WikidotStatusError('AMC responded with try_again', 'try_again'));
          }
          const backoff = calculateBackoff(
            retryCount,
            this.config.retryInterval,
            this.config.backoffFactor,
            this.config.maxBackoff
          );
          await sleep(backoff);
          continue;
        }

        // no_permissionの場合はForbiddenError
        if (amcResponse.status === 'no_permission') {
          const targetStr = body.moduleName
            ? `moduleName: ${body.moduleName}`
            : body.action
              ? `action: ${body.action}/${body.event ?? ''}`
              : 'unknown';
          return wdErrAsync(
            new ForbiddenError(
              `Your account has no permission to perform this action: ${targetStr}`
            )
          );
        }

        // okでない場合はエラー
        if (amcResponse.status !== 'ok') {
          return wdErrAsync(
            new WikidotStatusError(
              `AMC responded with error status: "${amcResponse.status}"`,
              amcResponse.status
            )
          );
        }

        return wdOkAsync(amcResponse);
      } catch (error) {
        // HTTPエラーの場合はリトライ
        retryCount++;
        if (retryCount >= this.config.retryLimit) {
          const statusCode =
            error instanceof Error && 'response' in error
              ? ((error as { response?: { status?: number } }).response?.status ??
                DEFAULT_HTTP_STATUS_CODE)
              : DEFAULT_HTTP_STATUS_CODE;
          return wdErrAsync(
            new AMCHttpError(`AMC HTTP request failed: ${String(error)}`, statusCode)
          );
        }

        const backoff = calculateBackoff(
          retryCount,
          this.config.retryInterval,
          this.config.backoffFactor,
          this.config.maxBackoff
        );
        await sleep(backoff);
      }
    }
  }
}
