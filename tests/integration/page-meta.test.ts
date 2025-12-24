/**
 * ページメタ操作の統合テスト
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Page } from '../../src';
import { safeDeletePage } from './helpers/cleanup';
import { cleanup, getSite } from './helpers/client';
import { generatePageName } from './helpers/page-name';
import { shouldSkipIntegration } from './setup';

describe.skipIf(shouldSkipIntegration())('Page Meta Integration Tests', () => {
  let pageName: string;
  let page: Page | null = null;

  beforeAll(async () => {
    pageName = generatePageName('meta');
    const site = await getSite();

    // テスト用ページを作成
    await site.page.create(pageName, {
      title: 'Meta Test Page',
      source: 'Content for meta test.',
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

  test('1. メタ設定', async () => {
    expect(page).not.toBeNull();

    const result = await page!.setMeta('description', 'Test description');
    expect(result.isOk()).toBe(true);
  });

  test('2. メタ取得', async () => {
    const site = await getSite();
    const pageResult = await site.page.get(pageName);
    expect(pageResult.isOk()).toBe(true);

    const currentPage = pageResult.value!;
    const metasResult = await currentPage.getMetas();
    expect(metasResult.isOk()).toBe(true);

    const metas = metasResult.value!;
    const descMeta = metas.findByName('description');
    expect(descMeta).toBeDefined();
    expect(descMeta?.content).toBe('Test description');
  });

  test('3. メタ更新', async () => {
    const site = await getSite();
    const pageResult = await site.page.get(pageName);
    expect(pageResult.isOk()).toBe(true);

    const currentPage = pageResult.value!;
    const result = await currentPage.setMeta('description', 'Updated description');
    expect(result.isOk()).toBe(true);

    // 確認
    const metasResult = await currentPage.getMetas();
    expect(metasResult.isOk()).toBe(true);
    const descMeta = metasResult.value?.findByName('description');
    expect(descMeta?.content).toBe('Updated description');
  });

  test('4. メタ削除', async () => {
    const site = await getSite();
    const pageResult = await site.page.get(pageName);
    expect(pageResult.isOk()).toBe(true);

    const currentPage = pageResult.value!;
    const result = await currentPage.deleteMeta('description');
    expect(result.isOk()).toBe(true);

    // 確認
    const metasResult = await currentPage.getMetas();
    expect(metasResult.isOk()).toBe(true);
    const descMeta = metasResult.value?.findByName('description');
    expect(descMeta).toBeUndefined();
  });

  test('5. 複数メタの設定', async () => {
    const site = await getSite();
    const pageResult = await site.page.get(pageName);
    expect(pageResult.isOk()).toBe(true);

    const currentPage = pageResult.value!;

    // 複数メタを設定
    await currentPage.setMeta('description', 'Page description');
    await currentPage.setMeta('keywords', 'keyword1, keyword2');
    await currentPage.setMeta('author', 'Test Author');

    // 確認
    const metasResult = await currentPage.getMetas();
    expect(metasResult.isOk()).toBe(true);
    expect(metasResult.value?.findByName('description')?.content).toBe('Page description');
    expect(metasResult.value?.findByName('keywords')?.content).toBe('keyword1, keyword2');
    expect(metasResult.value?.findByName('author')?.content).toBe('Test Author');
  });
});
