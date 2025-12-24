/**
 * ページリビジョン（編集履歴）の統合テスト
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Page } from '../../src';
import { safeDeletePage } from './helpers/cleanup';
import { cleanup, getSite } from './helpers/client';
import { generatePageName } from './helpers/page-name';
import { shouldSkipIntegration } from './setup';

describe.skipIf(shouldSkipIntegration())('Page Revision Integration Tests', () => {
  let pageName: string;
  let page: Page | null = null;

  beforeAll(async () => {
    pageName = generatePageName('revision');
    const site = await getSite();

    // テスト用ページを作成
    await site.page.create(pageName, {
      title: 'Revision Test Page',
      source: 'Initial content.',
    });

    const pageResult = await site.page.get(pageName);
    if (pageResult.isOk() && pageResult.value) {
      page = pageResult.value;

      // 編集してリビジョンを作成
      await page.edit({
        source: 'Updated content.',
        comment: 'First edit',
      });
    }
  }, 30000); // タイムアウトを30秒に設定

  afterAll(async () => {
    const site = await getSite();
    await safeDeletePage(site, pageName);
    await cleanup();
  });

  test('1. リビジョン一覧取得', async () => {
    const site = await getSite();
    const pageResult = await site.page.get(pageName);
    expect(pageResult.isOk()).toBe(true);

    const currentPage = pageResult.value!;
    const revisionsResult = await currentPage.getRevisions();
    expect(revisionsResult.isOk()).toBe(true);

    const revisions = revisionsResult.value;
    expect(revisions).not.toBeNull();
    // 作成 + 編集で少なくとも1つ以上のリビジョンがある
    expect(revisions!.length).toBeGreaterThanOrEqual(1);
  });

  test('2. リビジョンプロパティ確認', async () => {
    const site = await getSite();
    const pageResult = await site.page.get(pageName);
    expect(pageResult.isOk()).toBe(true);

    const currentPage = pageResult.value!;
    const revisionsResult = await currentPage.getRevisions();
    expect(revisionsResult.isOk()).toBe(true);

    const revisions = revisionsResult.value!;
    expect(revisions.length).toBeGreaterThanOrEqual(1);

    const latestRev = revisions[revisions.length - 1];
    expect(latestRev.id).toBeDefined();
    expect(latestRev.revNo).toBeDefined();
    expect(latestRev.createdBy).toBeDefined();
    expect(latestRev.createdAt).toBeDefined();
  });

  test('3. 最新リビジョン取得', async () => {
    const site = await getSite();
    const pageResult = await site.page.get(pageName);
    expect(pageResult.isOk()).toBe(true);

    const currentPage = pageResult.value!;
    await currentPage.getRevisions();

    const latest = currentPage.latestRevision;
    expect(latest).toBeDefined();
    expect(latest!.revNo).toBe(currentPage.revisionsCount);
  });
});
