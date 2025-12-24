/**
 * テスト用ランダムページ名生成
 */

/**
 * テスト用ランダムページ名を生成
 * フォーマット: {prefix}-{timestamp}-{random6chars}
 * 例: test-1703404800000-abc123
 */
export function generatePageName(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}
