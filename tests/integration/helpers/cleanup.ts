/**
 * クリーンアップユーティリティ
 */
import type { Site } from '../../../src';

/**
 * ページを安全に削除
 */
export async function safeDeletePage(site: Site, fullname: string): Promise<void> {
  try {
    const pageResult = await site.page.get(fullname);
    if (pageResult.isOk() && pageResult.value) {
      await pageResult.value.destroy();
    }
  } catch {
    // 削除失敗は無視（既に存在しない可能性）
  }
}
