/**
 * 循環依存を避けるための共通インターフェース定義
 */

import type { WikidotResultAsync } from '../common/types';
import type { AMCRequestBody, AMCResponse } from '../connector';

/**
 * クライアント参照インターフェース
 * Client型への直接依存を避けるために使用
 */
export interface ClientRef {
  /**
   * ログインが必要な操作の前に呼び出す
   * @returns ログインしていない場合はエラー
   */
  requireLogin(): { isErr(): boolean; error?: Error };

  /**
   * ログイン済みかどうか
   */
  isLoggedIn(): boolean;
}

/**
 * AMCHeaderの最小インターフェース
 */
export interface AMCHeaderRef {
  getHeaders(): Record<string, string>;
  setCookie(name: string, value: string): void;
  deleteCookie(name: string): void;
}

/**
 * AMCClientの最小インターフェース
 */
export interface AMCClientRef {
  header: AMCHeaderRef;
  request(bodies: AMCRequestBody[]): WikidotResultAsync<AMCResponse[]>;
}

/**
 * 認証処理で必要なクライアントコンテキスト
 * auth.tsがclient.tsに直接依存することを避けるために使用
 */
export interface AuthClientContext {
  amcClient: AMCClientRef;
}

/**
 * サイト参照インターフェース
 * Site型への直接依存を避けるために使用
 */
export interface SiteRef {
  /**
   * サイトID
   */
  readonly id: number;

  /**
   * UNIX名（例: scp-jp）
   */
  readonly unixName: string;

  /**
   * ドメイン
   */
  readonly domain: string;

  /**
   * SSL対応フラグ
   */
  readonly sslSupported: boolean;

  /**
   * クライアント参照
   */
  readonly client: ClientRef;

  /**
   * AMCリクエストを実行
   */
  amcRequest(bodies: AMCRequestBody[]): WikidotResultAsync<AMCResponse[]>;

  /**
   * 単一のAMCリクエストを実行
   */
  amcRequestSingle(body: AMCRequestBody): WikidotResultAsync<AMCResponse>;
}

/**
 * フォーラムカテゴリ参照インターフェース
 */
export interface ForumCategoryRef {
  /**
   * カテゴリID
   */
  readonly id: number;

  /**
   * カテゴリタイトル
   */
  readonly title: string;

  /**
   * サイト参照
   */
  readonly site: SiteRef;
}

/**
 * フォーラムスレッド参照インターフェース
 * ForumThread型への直接依存を避けるために使用
 */
export interface ForumThreadRef {
  /**
   * スレッドID
   */
  readonly id: number;

  /**
   * スレッドタイトル
   */
  readonly title: string;

  /**
   * サイト参照
   */
  readonly site: SiteRef;

  /**
   * カテゴリ参照（存在する場合）
   */
  readonly category?: ForumCategoryRef | null;
}

/**
 * ページ参照インターフェース
 * Page型への直接依存を避けるために使用
 */
export interface PageRef {
  /**
   * ページID（取得後に設定される）
   */
  readonly id: number | null;

  /**
   * フルネーム（category:name 形式）
   */
  readonly fullname: string;

  /**
   * ページ名
   */
  readonly name: string;

  /**
   * カテゴリ
   */
  readonly category: string;

  /**
   * サイト参照
   */
  readonly site: SiteRef;
}
