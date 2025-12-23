import { LoginRequiredError } from '../../common/errors';
import {
  fromPromise,
  type WikidotResult,
  type WikidotResultAsync,
  wdErr,
  wdOk,
  wdOkAsync,
} from '../../common/types';
import { AMCClient, type AMCConfig, login, logout } from '../../connector';
import type { User } from '../user/user';
import { PrivateMessageAccessor } from './accessors/pm-accessor';
import { SiteAccessor } from './accessors/site-accessor';
import { UserAccessor } from './accessors/user-accessor';

/**
 * クライアント作成オプション
 */
export interface ClientOptions {
  /** Wikidotユーザー名 */
  username?: string;

  /** Wikidotパスワード */
  password?: string;

  /** ベースドメイン（デフォルト: wikidot.com） */
  domain?: string;

  /** AMC設定オーバーライド */
  amcConfig?: Partial<AMCConfig>;
}

/**
 * Wikidotクライアント
 * ライブラリのメインエントリポイント
 */
export class Client {
  /** AMCクライアント */
  public readonly amcClient: AMCClient;

  /** ベースドメイン */
  public readonly domain: string;

  /** ユーザー操作アクセサ */
  public readonly user: UserAccessor;

  /** サイト操作アクセサ */
  public readonly site: SiteAccessor;

  /** プライベートメッセージ操作アクセサ */
  public readonly privateMessage: PrivateMessageAccessor;

  /** ログイン中のユーザー名 */
  private _username: string | null;

  /** ログイン中のユーザー */
  private _me: User | null = null;

  /**
   * プライベートコンストラクタ
   * createメソッドを使用してインスタンスを作成する
   */
  private constructor(amcClient: AMCClient, domain: string, username: string | null = null) {
    this.amcClient = amcClient;
    this.domain = domain;
    this._username = username;

    // アクセサを初期化
    this.user = new UserAccessor(this);
    this.site = new SiteAccessor(this);
    this.privateMessage = new PrivateMessageAccessor(this);
  }

  /**
   * ログイン中のユーザー名を取得
   */
  get username(): string | null {
    return this._username;
  }

  /**
   * ログイン中のユーザーを取得
   * ログインしていない場合はnull
   */
  get me(): User | null {
    return this._me;
  }

  /**
   * クライアントを作成する
   * @param options - クライアントオプション
   * @returns クライアントインスタンス
   */
  static create(options: ClientOptions = {}): WikidotResultAsync<Client> {
    const { username, password, domain = 'wikidot.com', amcConfig = {} } = options;

    // AMCクライアントを作成
    const amcClient = new AMCClient(amcConfig, domain);

    // 認証情報がある場合はログイン
    if (username && password) {
      return fromPromise(
        (async () => {
          const client = new Client(amcClient, domain, username);
          const loginResult = await login(client, username, password);
          if (loginResult.isErr()) {
            throw loginResult.error;
          }

          // ログイン中のユーザー情報を取得
          const { User } = await import('../user/user');
          const userResult = await User.fromName(client, username);
          if (userResult.isOk() && userResult.value) {
            client._me = userResult.value;
          }

          return client;
        })(),
        (error) => {
          if (error instanceof LoginRequiredError) {
            return error;
          }
          return new LoginRequiredError(`Failed to create client: ${String(error)}`);
        }
      );
    }

    // 認証なしのクライアントを返す
    return wdOkAsync(new Client(amcClient, domain));
  }

  /**
   * 未認証クライアントを作成する
   * @param options - クライアントオプション（認証情報以外）
   * @returns クライアントインスタンス
   */
  static createAnonymous(options: Omit<ClientOptions, 'username' | 'password'> = {}): Client {
    const { domain = 'wikidot.com', amcConfig = {} } = options;
    const amcClient = new AMCClient(amcConfig, domain);
    return new Client(amcClient, domain);
  }

  /**
   * ログイン状態を確認する
   * @returns ログイン済みならtrue
   */
  isLoggedIn(): boolean {
    return this._username !== null;
  }

  /**
   * ログインを要求する
   * ログイン済みでない場合はLoginRequiredErrorを返す
   * @returns 成功時はvoid
   */
  requireLogin(): WikidotResult<void> {
    if (!this.isLoggedIn()) {
      return wdErr(new LoginRequiredError());
    }
    return wdOk(undefined);
  }

  /**
   * クライアントをクローズする
   * セッションがある場合はログアウトを試みる
   */
  close(): WikidotResultAsync<void> {
    if (this.isLoggedIn()) {
      return logout(this).map(() => {
        this._username = null;
        return undefined;
      });
    }
    return wdOkAsync(undefined);
  }
}
