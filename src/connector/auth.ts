import { SessionCreateError } from '../common/errors';
import { type WikidotResultAsync, fromPromise, wdOkAsync } from '../common/types';
import type { AuthClientContext } from '../module/types';

const LOGIN_URL = 'https://www.wikidot.com/default--flow/login__LoginPopupScreen';

/**
 * ユーザー名とパスワードでWikidotにログインする
 * @param client - クライアントコンテキスト（AMCClientを持つオブジェクト）
 * @param username - ユーザー名
 * @param password - パスワード
 * @returns 成功時はvoid、失敗時はSessionCreateError
 */
export function login(
  client: AuthClientContext,
  username: string,
  password: string
): WikidotResultAsync<void> {
  return fromPromise(
    (async () => {
      const formData = new URLSearchParams({
        login: username,
        password: password,
        action: 'Login2Action',
        event: 'login',
      });

      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: client.amcClient.header.getHeaders(),
        body: formData.toString(),
      });

      // Check status code
      if (!response.ok) {
        throw new SessionCreateError(
          `Login attempt failed due to HTTP status code: ${response.status}`
        );
      }

      // Check body for error message
      const body = await response.text();
      if (body.includes('The login and password do not match')) {
        throw new SessionCreateError('Login attempt failed due to invalid username or password');
      }

      // Check cookies
      const cookies = response.headers.get('Set-Cookie');
      if (!cookies) {
        throw new SessionCreateError('Login attempt failed due to missing cookies');
      }

      // Extract WIKIDOT_SESSION_ID from cookies
      const sessionIdMatch = cookies.match(/WIKIDOT_SESSION_ID=([^;]+)/);
      if (!sessionIdMatch?.[1]) {
        throw new SessionCreateError(
          'Login attempt failed due to missing WIKIDOT_SESSION_ID cookie'
        );
      }

      // Set session cookie
      client.amcClient.header.setCookie('WIKIDOT_SESSION_ID', sessionIdMatch[1]);
    })(),
    (error) => {
      if (error instanceof SessionCreateError) {
        return error;
      }
      return new SessionCreateError(`Login failed: ${String(error)}`);
    }
  );
}

/**
 * ログアウトする
 * @param client - クライアントコンテキスト（AMCClientを持つオブジェクト）
 * @returns 成功時はvoid
 */
export function logout(client: AuthClientContext): WikidotResultAsync<void> {
  // Try to logout via AMC, then always remove session cookie
  return client.amcClient
    .request([
      {
        moduleName: 'Empty',
        action: 'Login2Action',
        event: 'logout',
      },
    ])
    .map(() => {
      // Logout succeeded, remove session cookie
      client.amcClient.header.deleteCookie('WIKIDOT_SESSION_ID');
    })
    .orElse(() => {
      // Even if logout request fails, we still want to clear the session locally
      client.amcClient.header.deleteCookie('WIKIDOT_SESSION_ID');
      return wdOkAsync(undefined);
    });
}
