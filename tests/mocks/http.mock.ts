/**
 * HTTP Mock
 *
 * fetch/kyのモック実装
 */

/**
 * モックレスポンス定義
 */
export interface MockResponse {
  status: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string | object;
  ok?: boolean;
}

/**
 * モックリクエストマッチャー
 */
export interface MockRequestMatcher {
  url?: string | RegExp;
  method?: string;
}

/**
 * モックエントリ
 */
interface MockEntry {
  matcher: MockRequestMatcher;
  response: MockResponse;
}

/**
 * HTTPモッククラス
 */
export class HttpMock {
  private mocks: MockEntry[] = [];
  private requestHistory: { url: string; options?: RequestInit }[] = [];
  private originalFetch: typeof fetch;

  constructor() {
    this.originalFetch = globalThis.fetch;
  }

  /**
   * モックを追加
   */
  addMock(matcher: MockRequestMatcher, response: MockResponse): void {
    this.mocks.push({ matcher, response });
  }

  /**
   * モックをクリア
   */
  clearMocks(): void {
    this.mocks = [];
  }

  /**
   * リクエスト履歴を取得
   */
  getRequestHistory(): { url: string; options?: RequestInit }[] {
    return [...this.requestHistory];
  }

  /**
   * リクエスト履歴をクリア
   */
  clearRequestHistory(): void {
    this.requestHistory = [];
  }

  /**
   * fetchをモックに置き換え
   */
  install(): void {
    const self = this;
    globalThis.fetch = async function mockFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      self.requestHistory.push({ url, options: init });

      // マッチするモックを検索
      for (const mock of self.mocks) {
        const urlMatch =
          !mock.matcher.url ||
          (typeof mock.matcher.url === 'string'
            ? url === mock.matcher.url || url.includes(mock.matcher.url)
            : mock.matcher.url.test(url));

        const methodMatch =
          !mock.matcher.method || mock.matcher.method.toUpperCase() === method.toUpperCase();

        if (urlMatch && methodMatch) {
          return self.createResponse(mock.response);
        }
      }

      // デフォルト: 404
      return self.createResponse({ status: 404, body: 'Not Found' });
    } as typeof fetch;
  }

  /**
   * 元のfetchを復元
   */
  restore(): void {
    globalThis.fetch = this.originalFetch;
  }

  /**
   * Responseオブジェクトを作成
   */
  private createResponse(mock: MockResponse): Response {
    const body = typeof mock.body === 'object' ? JSON.stringify(mock.body) : (mock.body ?? '');

    const headers = new Headers(mock.headers ?? {});
    if (typeof mock.body === 'object' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    return new Response(body, {
      status: mock.status,
      statusText: mock.statusText ?? '',
      headers,
    });
  }
}

/**
 * HTTPモックインスタンスを作成して設定
 */
export function createHttpMock(): HttpMock {
  const mock = new HttpMock();
  mock.install();
  return mock;
}
