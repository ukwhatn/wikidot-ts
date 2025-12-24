/**
 * Decorator utilities
 */

import { LoginRequiredError } from './errors';
import { fromPromise, type WikidotResultAsync, wdErrAsync } from './types';

/**
 * Type for objects that have a client reference
 */
interface HasClient {
  client?: { requireLogin(): { isErr(): boolean; error?: Error } };
  site?: { client: { requireLogin(): { isErr(): boolean; error?: Error } } };
  thread?: { site: { client: { requireLogin(): { isErr(): boolean; error?: Error } } } };
}

/**
 * Get client reference from an object
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
 * Login required method decorator
 *
 * Methods decorated with this will check login status before execution.
 * Returns LoginRequiredError if not logged in.
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
