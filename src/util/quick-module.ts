/**
 * QuickModule - Wikidot軽量API
 *
 * quickmodule.phpエンドポイントを使用した検索機能
 */

import { z } from 'zod';
import { NotFoundException, UnexpectedError } from '../common/errors';
import { fromPromise, type WikidotResultAsync } from '../common/types';

/**
 * QuickModuleモジュール名
 */
export type QuickModuleName = 'MemberLookupQModule' | 'UserLookupQModule' | 'PageLookupQModule';

/**
 * QuickModuleユーザー情報
 */
export interface QMCUser {
  id: number;
  name: string;
}

/**
 * QuickModuleページ情報
 */
export interface QMCPage {
  title: string;
  unixName: string;
}

/**
 * QuickModuleレスポンススキーマ
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
 * QuickModuleエンドポイントにリクエストを送信
 */
async function requestQuickModule(
  moduleName: QuickModuleName,
  siteId: number,
  query: string
): Promise<unknown> {
  const url = `https://www.wikidot.com/quickmodule.php?module=${moduleName}&s=${siteId}&q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
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
 * サイトメンバーを検索
 * @param siteId - サイトID
 * @param query - 検索クエリ（ユーザー名の一部）
 * @returns マッチしたユーザー一覧
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
 * Wikidot全体からユーザーを検索
 * @param siteId - サイトID（任意のサイトIDで可）
 * @param query - 検索クエリ（ユーザー名の一部）
 * @returns マッチしたユーザー一覧
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
 * サイト内のページを検索
 * @param siteId - サイトID
 * @param query - 検索クエリ（ページ名の一部）
 * @returns マッチしたページ一覧
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
 * QuickModule API（後方互換性のため維持）
 * @deprecated 代わりに個別の関数（memberLookup, userLookup, pageLookup）を使用してください
 */
export const QuickModule = {
  memberLookup,
  userLookup,
  pageLookup,
};
