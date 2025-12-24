/**
 * クライアント作成ヘルパー
 */
import { Client, type Site } from '../../../src';
import { requireCredentials, TEST_CONFIG } from '../setup';

let cachedClient: Client | null = null;
let cachedSite: Site | null = null;

/**
 * 認証済みクライアントを取得（キャッシュ）
 */
export async function getClient(): Promise<Client> {
  if (cachedClient) return cachedClient;

  requireCredentials();
  // requireCredentials()で検証済みなのでstring型として扱う
  const username = TEST_CONFIG.username as string;
  const password = TEST_CONFIG.password as string;
  const result = await Client.create({
    username,
    password,
  });

  if (result.isErr()) {
    throw new Error(`Failed to create client: ${result.error.message}`);
  }

  cachedClient = result.value;
  return cachedClient;
}

/**
 * テストサイトを取得（キャッシュ）
 */
export async function getSite(): Promise<Site> {
  if (cachedSite) return cachedSite;

  const client = await getClient();
  const result = await client.site.get(TEST_CONFIG.siteUnixName);

  if (result.isErr()) {
    throw new Error(`Failed to get site: ${result.error.message}`);
  }

  cachedSite = result.value;
  return cachedSite;
}

/**
 * テスト終了時のクリーンアップ
 */
export async function cleanup(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedSite = null;
  }
}
