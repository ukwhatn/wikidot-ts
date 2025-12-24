/**
 * 統合テスト用セットアップ
 */

/**
 * テスト設定
 */
export const TEST_CONFIG = {
  siteUnixName: 'ukwhatn-ci',
  username: process.env.WIKIDOT_USERNAME,
  password: process.env.WIKIDOT_PASSWORD,
} as const;

/**
 * 認証情報が設定されているかチェック
 */
export function hasCredentials(): boolean {
  return Boolean(TEST_CONFIG.username && TEST_CONFIG.password);
}

/**
 * 認証情報を必須としてチェック
 * @throws Error 認証情報が未設定の場合
 */
export function requireCredentials(): void {
  if (!hasCredentials()) {
    throw new Error('WIKIDOT_USERNAME and WIKIDOT_PASSWORD environment variables are required');
  }
}

/**
 * 統合テストをスキップするべきかどうか
 */
export function shouldSkipIntegration(): boolean {
  return !hasCredentials();
}
