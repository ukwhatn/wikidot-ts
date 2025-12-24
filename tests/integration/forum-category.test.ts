/**
 * フォーラムカテゴリの統合テスト
 */
import { describe, expect, test } from 'bun:test';
import { getSite } from './helpers/client';
import { shouldSkipIntegration } from './setup';

describe.skipIf(shouldSkipIntegration())('Forum Category Integration Tests', () => {
  test('1. フォーラムカテゴリ一覧取得', async () => {
    const site = await getSite();
    const result = await site.forum.getCategories();
    expect(result.isOk()).toBe(true);

    const categories = result.value!;
    // カテゴリがなくても空のコレクションが返る
    expect(Array.isArray(categories)).toBe(true);
  });

  test('2. カテゴリプロパティ確認', async () => {
    const site = await getSite();
    const result = await site.forum.getCategories();
    expect(result.isOk()).toBe(true);

    const categories = result.value!;
    // カテゴリがある場合はプロパティを確認
    if (categories.length > 0) {
      const category = categories[0];
      expect(category.id).toBeDefined();
      expect(category.title).toBeDefined();
      expect(category.site).toBeDefined();
    }
  });

  test('3. カテゴリのスレッド一覧取得', async () => {
    const site = await getSite();
    const result = await site.forum.getCategories();
    expect(result.isOk()).toBe(true);

    const categories = result.value!;
    // カテゴリがある場合はスレッドを取得
    if (categories.length > 0) {
      const category = categories[0];
      const threadsResult = await category.getThreads();
      expect(threadsResult.isOk()).toBe(true);
      expect(Array.isArray(threadsResult.value)).toBe(true);
    }
  });
});
