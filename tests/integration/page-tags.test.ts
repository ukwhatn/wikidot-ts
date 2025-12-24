/**
 * ページタグ操作の統合テスト
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Page } from '../../src';
import { safeDeletePage } from './helpers/cleanup';
import { cleanup, getSite } from './helpers/client';
import { generatePageName } from './helpers/page-name';
import { shouldSkipIntegration } from './setup';

describe.skipIf(shouldSkipIntegration())('Page Tags Integration Tests', () => {
  let pageName: string;
  let page: Page | null = null;

  beforeAll(async () => {
    pageName = generatePageName('tags');
    const site = await getSite();

    // テスト用ページを作成
    await site.page.create(pageName, {
      title: 'Tags Test Page',
      source: 'Content for tags test.',
    });

    const pageResult = await site.page.get(pageName);
    if (pageResult.isOk() && pageResult.value) {
      page = pageResult.value;
    }
  });

  afterAll(async () => {
    const site = await getSite();
    await safeDeletePage(site, pageName);
    await cleanup();
  });

  test('1. タグ追加と確認', async () => {
    expect(page).not.toBeNull();

    page!.tags = ['test-tag-1', 'test-tag-2'];
    const result = await page!.commitTags();
    expect(result.isOk()).toBe(true);

    // Wikidot APIの eventual consistency を考慮して少し待機
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 再取得して確認
    const site = await getSite();
    const refreshedPage = await site.page.get(pageName);
    expect(refreshedPage.isOk()).toBe(true);
    expect(refreshedPage.value?.tags).toContain('test-tag-1');
    expect(refreshedPage.value?.tags).toContain('test-tag-2');
  });

  test('2. タグ更新', async () => {
    const site = await getSite();
    const pageResult = await site.page.get(pageName);
    expect(pageResult.isOk()).toBe(true);

    const currentPage = pageResult.value!;
    currentPage.tags = ['test-tag-updated'];
    const result = await currentPage.commitTags();
    expect(result.isOk()).toBe(true);

    // Wikidot APIの eventual consistency を考慮して少し待機
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 確認
    const updatedResult = await site.page.get(pageName);
    expect(updatedResult.isOk()).toBe(true);
    expect(updatedResult.value?.tags).toContain('test-tag-updated');
    expect(updatedResult.value?.tags).not.toContain('test-tag-1');
  });

  test('3. タグ削除（空配列）', async () => {
    const site = await getSite();
    const pageResult = await site.page.get(pageName);
    expect(pageResult.isOk()).toBe(true);

    const currentPage = pageResult.value!;
    currentPage.tags = [];
    const result = await currentPage.commitTags();
    expect(result.isOk()).toBe(true);

    // Wikidot APIの eventual consistency を考慮して少し待機
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 確認
    const updatedResult = await site.page.get(pageName);
    expect(updatedResult.isOk()).toBe(true);
    expect(updatedResult.value?.tags.length).toBe(0);
  });
});
