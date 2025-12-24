/**
 * サイト取得・ページ取得の統合テスト
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { cleanup, getClient, getSite } from './helpers/client';
import { shouldSkipIntegration } from './setup';

describe.skipIf(shouldSkipIntegration())('Site Integration Tests', () => {
  beforeAll(async () => {
    await getClient();
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('Site取得', () => {
    test('サイト取得', async () => {
      const site = await getSite();
      expect(site.unixName).toBe('ukwhatn-ci');
      expect(site.id).toBeGreaterThan(0);
    });

    test('サイトにタイトルがある', async () => {
      const site = await getSite();
      expect(site.title).toBeDefined();
      expect(site.title.length).toBeGreaterThan(0);
    });
  });

  describe('Page取得', () => {
    test('既存ページ取得（startページ）', async () => {
      const site = await getSite();
      const pageResult = await site.page.get('start');
      expect(pageResult.isOk()).toBe(true);
      expect(pageResult.value).not.toBeNull();
      expect(pageResult.value?.fullname).toBe('start');
    });

    test('存在しないページ取得', async () => {
      const site = await getSite();
      const pageResult = await site.page.get('nonexistent-page-12345678');
      expect(pageResult.isOk()).toBe(true);
      expect(pageResult.value).toBeNull();
    });

    test('ページにプロパティがある', async () => {
      const site = await getSite();
      const pageResult = await site.page.get('start');
      expect(pageResult.isOk()).toBe(true);

      const page = pageResult.value!;
      expect(page.fullname).toBeDefined();
      expect(page.title).toBeDefined();
      expect(page.createdAt).toBeDefined();
      expect(page.rating).toBeDefined();
      // NOTE: 初期ページはrevisionsCountが0になる場合がある
      expect(page.revisionsCount).toBeGreaterThanOrEqual(0);
    });
  });
});
