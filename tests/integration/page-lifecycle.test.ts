/**
 * ページライフサイクル（作成→取得→編集→削除）の統合テスト
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Page } from '../../src';
import { safeDeletePage } from './helpers/cleanup';
import { cleanup, getSite } from './helpers/client';
import { generatePageName } from './helpers/page-name';
import { shouldSkipIntegration } from './setup';

describe.skipIf(shouldSkipIntegration())('Page Lifecycle Integration Tests', () => {
  let pageName: string;
  let createdPage: Page | null = null;

  beforeAll(async () => {
    pageName = generatePageName('lifecycle');
  });

  afterAll(async () => {
    // テスト失敗時のクリーンアップ
    const site = await getSite();
    await safeDeletePage(site, pageName);
    await cleanup();
  });

  test('1. ページ作成', async () => {
    const site = await getSite();

    const createResult = await site.page.create(pageName, {
      title: 'Test Page',
      source: 'This is test content.',
      comment: 'Initial creation',
    });

    expect(createResult.isOk()).toBe(true);
  });

  test('2. 作成ページ取得', async () => {
    const site = await getSite();

    const pageResult = await site.page.get(pageName);
    expect(pageResult.isOk()).toBe(true);
    expect(pageResult.value).not.toBeNull();

    createdPage = pageResult.value!;
    expect(createdPage.fullname).toBe(pageName);
    expect(createdPage.title).toBe('Test Page');
  });

  test('3. ページソース取得', async () => {
    const site = await getSite();
    const pageResult = await site.page.get(pageName);
    expect(pageResult.isOk()).toBe(true);

    const page = pageResult.value!;
    const sourceResult = await page.getSource();
    expect(sourceResult.isOk()).toBe(true);
    expect(sourceResult.value?.wikiText).toBe('This is test content.');
  });

  test('4. ページ編集', async () => {
    const site = await getSite();
    const pageResult = await site.page.get(pageName);
    expect(pageResult.isOk()).toBe(true);

    const page = pageResult.value!;
    const editResult = await page.edit({
      title: 'Updated Test Page',
      source: 'Updated content.',
      comment: 'Test edit',
    });

    expect(editResult.isOk()).toBe(true);

    // 再取得して確認
    const updatedResult = await site.page.get(pageName);
    expect(updatedResult.isOk()).toBe(true);
    expect(updatedResult.value?.title).toBe('Updated Test Page');

    const sourceResult = await updatedResult.value!.getSource();
    expect(sourceResult.isOk()).toBe(true);
    expect(sourceResult.value?.wikiText).toBe('Updated content.');
  });

  test('5. ページ削除', async () => {
    const site = await getSite();
    const pageResult = await site.page.get(pageName);
    expect(pageResult.isOk()).toBe(true);

    const page = pageResult.value!;
    const deleteResult = await page.destroy();
    expect(deleteResult.isOk()).toBe(true);

    // NOTE: 削除確認はWikidotのeventual consistencyにより不安定なためスキップ
    // destroy()の成功をもって削除完了とする（afterAllでクリーンアップも実行される）
  });
});
