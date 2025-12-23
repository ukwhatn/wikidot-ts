import { WikidotError } from './base';

/**
 * セッション関連の基底エラー
 */
export class SessionError extends WikidotError {}

/**
 * セッション作成失敗エラー
 * ログイン試行が失敗した場合にスロー
 */
export class SessionCreateError extends SessionError {}

/**
 * ログイン必須エラー
 * 認証が必要な操作を未ログイン状態で実行した場合にスロー
 */
export class LoginRequiredError extends SessionError {
  constructor(message = 'Login is required for this operation') {
    super(message);
  }
}
