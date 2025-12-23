import { WikidotError } from './base';

/**
 * Ajax Module Connector関連の基底エラー
 */
export class AMCError extends WikidotError {}

/**
 * HTTPステータスコードエラー
 * AMCへのリクエストがHTTPエラーで失敗した場合
 */
export class AMCHttpError extends AMCError {
  /** HTTPステータスコード */
  public readonly statusCode: number;

  /**
   * @param message - エラーメッセージ
   * @param statusCode - HTTPステータスコード
   */
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Wikidotステータスコードエラー
 * AMCレスポンスのstatusがokでない場合
 */
export class WikidotStatusError extends AMCError {
  /** Wikidotステータスコード文字列 */
  public readonly statusCode: string;

  /**
   * @param message - エラーメッセージ
   * @param statusCode - ステータスコード（例: 'not_ok', 'try_again'）
   */
  constructor(message: string, statusCode: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * レスポンスデータエラー
 * レスポンスのパースに失敗した場合
 */
export class ResponseDataError extends AMCError {}
