/**
 * QuickModule - Wikidot lightweight API
 *
 * Search functionality using quickmodule.php endpoint
 */

import { z } from 'zod';
import { NotFoundException, UnexpectedError } from '../common/errors';
import { fromPromise, type WikidotResultAsync } from '../common/types';
import { DEFAULT_AMC_CONFIG } from '../connector/amc-config';
import { fetchWithRetry } from './http';

/**
 * QuickModule module name
 */
export type QuickModuleName = 'MemberLookupQModule' | 'UserLookupQModule' | 'PageLookupQModule';

/**
 * QuickModule user information
 */
export interface QMCUser {
  id: number;
  name: string;
}

/**
 * QuickModule page information
 */
export interface QMCPage {
  title: string;
  unixName: string;
}

/**
 * QuickModule response schema
 */
const quickModuleUserResponseSchema = z.object({
  users: z.union([
    z.array(
      z.object({
        user_id: z.union([z.string(), z.number()]),
        name: z.string(),
      })
    ),
    z.literal(false),
  ]),
});

const quickModulePageResponseSchema = z.object({
  pages: z.union([
    z.array(
      z.object({
        title: z.string(),
        unix_name: z.string(),
      })
    ),
    z.literal(false),
  ]),
});

/**
 * Send request to QuickModule endpoint
 */
async function requestQuickModule(
  moduleName: QuickModuleName,
  siteId: number,
  query: string
): Promise<unknown> {
  const url = `https://www.wikidot.com/quickmodule.php?module=${moduleName}&s=${siteId}&q=${encodeURIComponent(query)}`;

  const response = await fetchWithRetry(url, DEFAULT_AMC_CONFIG, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    checkOk: false, // Handle HTTP errors manually
  });

  if (response.status === 500) {
    throw new NotFoundException(`Site not found: siteId=${siteId}`);
  }

  if (!response.ok) {
    throw new UnexpectedError(`QuickModule request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Search site members
 * @param siteId - Site ID
 * @param query - Search query (partial username)
 * @returns List of matching users
 */
export function memberLookup(siteId: number, query: string): WikidotResultAsync<QMCUser[]> {
  return fromPromise(
    (async () => {
      const data = await requestQuickModule('MemberLookupQModule', siteId, query);
      const parsed = quickModuleUserResponseSchema.parse(data);

      if (parsed.users === false) {
        return [];
      }

      return parsed.users.map((user) => ({
        id: typeof user.user_id === 'string' ? Number.parseInt(user.user_id, 10) : user.user_id,
        name: user.name,
      }));
    })(),
    (error) => {
      if (error instanceof NotFoundException) return error;
      return new UnexpectedError(`Member lookup failed: ${String(error)}`);
    }
  );
}

/**
 * Search users across all Wikidot
 * @param siteId - Site ID (any site ID works)
 * @param query - Search query (partial username)
 * @returns List of matching users
 */
export function userLookup(siteId: number, query: string): WikidotResultAsync<QMCUser[]> {
  return fromPromise(
    (async () => {
      const data = await requestQuickModule('UserLookupQModule', siteId, query);
      const parsed = quickModuleUserResponseSchema.parse(data);

      if (parsed.users === false) {
        return [];
      }

      return parsed.users.map((user) => ({
        id: typeof user.user_id === 'string' ? Number.parseInt(user.user_id, 10) : user.user_id,
        name: user.name,
      }));
    })(),
    (error) => {
      if (error instanceof NotFoundException) return error;
      return new UnexpectedError(`User lookup failed: ${String(error)}`);
    }
  );
}

/**
 * Search pages within site
 * @param siteId - Site ID
 * @param query - Search query (partial page name)
 * @returns List of matching pages
 */
export function pageLookup(siteId: number, query: string): WikidotResultAsync<QMCPage[]> {
  return fromPromise(
    (async () => {
      const data = await requestQuickModule('PageLookupQModule', siteId, query);
      const parsed = quickModulePageResponseSchema.parse(data);

      if (parsed.pages === false) {
        return [];
      }

      return parsed.pages.map((page) => ({
        title: page.title,
        unixName: page.unix_name,
      }));
    })(),
    (error) => {
      if (error instanceof NotFoundException) return error;
      return new UnexpectedError(`Page lookup failed: ${String(error)}`);
    }
  );
}

/**
 * QuickModule API (maintained for backwards compatibility)
 * @deprecated Use individual functions (memberLookup, userLookup, pageLookup) instead
 */
export const QuickModule: {
  memberLookup: typeof memberLookup;
  userLookup: typeof userLookup;
  pageLookup: typeof pageLookup;
} = {
  memberLookup: memberLookup,
  userLookup: userLookup,
  pageLookup: pageLookup,
};
