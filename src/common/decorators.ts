/**
 * デコレータユーティリティ
 */

import { LoginRequiredError } from './errors';
import { fromPromise, type WikidotResultAsync, wdErrAsync } from './types';

/**
 * クライアント参照を持つオブジェクトの型
 */
interface HasClient {
  client?: { requireLogin(): { isErr(): boolean; error?: Error } };
  site?: { client: { requireLogin(): { isErr(): boolean; error?: Error } } };
  thread?: { site: { client: { requireLogin(): { isErr(): boolean; error?: Error } } } };
}

/**
 * オブジェクトからクライアント参照を取得する
 */
function getClientRef(
  obj: HasClient
): { requireLogin(): { isErr(): boolean; error?: Error } } | null {
  if (obj.client) return obj.client;
  if (obj.site?.client) return obj.site.client;
  if (obj.thread?.site?.client) return obj.thread.site.client;
  return null;
}

/**
 * ログイン必須メソッドデコレータ
 *
 * このデコレータを適用したメソッドは、実行前にログイン状態をチェックする。
 * ログインしていない場合は LoginRequiredError を返す。
 *
 * @example
 * class Page {
 *   @RequireLogin
 *   destroy(): WikidotResultAsync<void> {
 *     return fromPromise(async () => { ... }, (e) => new UnexpectedError(...));
 *   }
 * }
 */
export function RequireLogin<
  This extends HasClient,
  Args extends unknown[],
  Return extends WikidotResultAsync<unknown>,
>(
  target: (this: This, ...args: Args) => Return,
  _context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
): (this: This, ...args: Args) => Return {
  return function (this: This, ...args: Args): Return {
    const clientRef = getClientRef(this);
    if (!clientRef) {
      return wdErrAsync(new LoginRequiredError('Client reference not found')) as unknown as Return;
    }

    const loginResult = clientRef.requireLogin();
    if (loginResult.isErr()) {
      return fromPromise(
        Promise.reject(loginResult.error),
        () => new LoginRequiredError('Login required')
      ) as unknown as Return;
    }

    return target.call(this, ...args);
  };
}
