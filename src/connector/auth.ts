import { SessionCreateError } from '../common/errors';
import { fromPromise, type WikidotResultAsync, wdOkAsync } from '../common/types';
import type { AuthClientContext } from '../module/types';
import { fetchWithRetry } from '../util/http';
import { DEFAULT_AMC_CONFIG } from './amc-config';

const LOGIN_URL = 'https://www.wikidot.com/default--flow/login__LoginPopupScreen';

/** Login retry limit (reduced to prevent account lockout) */
const LOGIN_RETRY_LIMIT = 3;

/**
 * Login to Wikidot with username and password
 * @param client - Client context (object with AMCClient)
 * @param username - Username
 * @param password - Password
 * @returns void on success, SessionCreateError on failure
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

      // Use reduced retry limit for login to prevent account lockout
      const loginConfig = {
        ...DEFAULT_AMC_CONFIG,
        retryLimit: LOGIN_RETRY_LIMIT,
      };
      const response = await fetchWithRetry(LOGIN_URL, loginConfig, {
        method: 'POST',
        headers: client.amcClient.header.getHeaders(),
        body: formData.toString(),
        checkOk: false, // Handle HTTP errors manually for better error messages
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
 * Logout from Wikidot
 * @param client - Client context (object with AMCClient)
 * @returns void on success
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
      return undefined;
    })
    .orElse(() => {
      // Even if logout request fails, we still want to clear the session locally
      client.amcClient.header.deleteCookie('WIKIDOT_SESSION_ID');
      return wdOkAsync(undefined);
    });
}
