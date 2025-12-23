/**
 * AMCClient Mock
 *
 * AMCClientのモック実装（HTTPリクエストなし）
 */

import { err, ok, type ResultAsync } from 'neverthrow';
import type { WikidotError } from '../../src/common/errors';
import type { AMCConfig } from '../../src/connector/amc-config';
import { AMCHeader } from '../../src/connector/amc-header';
import type { AMCRequestBody, AMCResponse } from '../../src/connector/amc-types';
import { TEST_AMC_CONFIG } from '../setup';

/**
 * モックレスポンスハンドラー型
 */
export type MockResponseHandler = (body: AMCRequestBody) => AMCResponse | WikidotError;

/**
 * AMCClient モック
 */
export class MockAMCClient {
  public readonly header: AMCHeader;
  public readonly config: AMCConfig;
  public readonly domain: string;

  private responseHandlers: MockResponseHandler[] = [];
  private requestHistory: AMCRequestBody[] = [];

  constructor(config: Partial<AMCConfig> = {}, domain = 'wikidot.com') {
    this.config = { ...TEST_AMC_CONFIG, ...config };
    this.domain = domain;
    this.header = new AMCHeader();
  }

  /**
   * モックレスポンスハンドラーを追加
   */
  addResponseHandler(handler: MockResponseHandler): void {
    this.responseHandlers.push(handler);
  }

  /**
   * レスポンスハンドラーをクリア
   */
  clearResponseHandlers(): void {
    this.responseHandlers = [];
  }

  /**
   * リクエスト履歴を取得
   */
  getRequestHistory(): AMCRequestBody[] {
    return [...this.requestHistory];
  }

  /**
   * リクエスト履歴をクリア
   */
  clearRequestHistory(): void {
    this.requestHistory = [];
  }

  /**
   * SSL対応チェック（常にtrue）
   */
  checkSiteSSL(_siteName: string): ResultAsync<boolean, WikidotError> {
    return ok(true) as unknown as ResultAsync<boolean, WikidotError>;
  }

  /**
   * モックリクエスト実行
   */
  request(
    bodies: AMCRequestBody[],
    _siteName = 'www',
    _sslSupported?: boolean
  ): ResultAsync<AMCResponse[], WikidotError> {
    this.requestHistory.push(...bodies);

    const responses: AMCResponse[] = [];

    for (const body of bodies) {
      let response: AMCResponse | WikidotError | null = null;

      // ハンドラーを順番に試す
      for (const handler of this.responseHandlers) {
        const result = handler(body);
        if (result) {
          response = result;
          break;
        }
      }

      // ハンドラーが見つからない場合はデフォルトレスポンス
      if (!response) {
        response = {
          status: 'ok',
          body: '',
          CURRENT_TIMESTAMP: Date.now(),
        };
      }

      // エラーの場合
      if (response instanceof Error) {
        return err(response as WikidotError) as unknown as ResultAsync<AMCResponse[], WikidotError>;
      }

      responses.push(response);
    }

    return ok(responses) as unknown as ResultAsync<AMCResponse[], WikidotError>;
  }
}

/**
 * 成功レスポンスを作成
 */
export function createOkResponse(body = ''): AMCResponse {
  return {
    status: 'ok',
    body,
    CURRENT_TIMESTAMP: Date.now(),
  };
}

/**
 * エラーレスポンスを作成
 */
export function createErrorResponse(status: string, message = ''): AMCResponse {
  return {
    status,
    message,
    CURRENT_TIMESTAMP: Date.now(),
  };
}

/**
 * try_againレスポンスを作成
 */
export function createTryAgainResponse(): AMCResponse {
  return {
    status: 'try_again',
    CURRENT_TIMESTAMP: Date.now(),
  };
}

/**
 * no_permissionレスポンスを作成
 */
export function createNoPermissionResponse(): AMCResponse {
  return {
    status: 'no_permission',
    CURRENT_TIMESTAMP: Date.now(),
  };
}
