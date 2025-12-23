/**
 * Ajax Module Connector設定
 */
export interface AMCConfig {
  /** リクエストタイムアウト（ミリ秒） */
  timeout: number;

  /** リトライ上限回数 */
  retryLimit: number;

  /** リトライ基本間隔（ミリ秒） */
  retryInterval: number;

  /** 最大バックオフ（ミリ秒） */
  maxBackoff: number;

  /** バックオフ係数 */
  backoffFactor: number;

  /** 最大並列リクエスト数 */
  semaphoreLimit: number;
}

/** デフォルトAMC設定 */
export const DEFAULT_AMC_CONFIG: AMCConfig = {
  timeout: 20000,
  retryLimit: 3,
  retryInterval: 1000,
  maxBackoff: 60000,
  backoffFactor: 2.0,
  semaphoreLimit: 10,
};

/**
 * Wikidotが要求する固定トークン値
 * これはWikidotのフロントエンドから取得される固定値で、
 * セキュリティトークンではなく単なる識別子として使用される
 */
export const WIKIDOT_TOKEN7 = '123456';

/**
 * HTTPエラー時のフォールバックステータスコード
 * レスポンスからステータスコードを取得できない場合に使用
 */
export const DEFAULT_HTTP_STATUS_CODE = 999;
