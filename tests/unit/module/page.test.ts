/**
 * Pageモジュールのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import { Page, type PageData } from '../../../src/module/page/page';
import type { SiteRef } from '../../../src/module/types';
import { MockAMCClient } from '../../mocks/amc-client.mock';
import { TEST_PAGE_DATA, TEST_SITE_DATA } from '../../setup';

/**
 * テスト用サイト作成
 */
function createMockSite(): SiteRef {
  const _amcClient = new MockAMCClient();
  const siteData = {
    id: TEST_SITE_DATA.id,
    unixName: TEST_SITE_DATA.unixName,
    domain: TEST_SITE_DATA.domain,
    sslSupported: TEST_SITE_DATA.sslSupported,
  };
  return {
    ...siteData,
    client: {
      requireLogin: () => ({ isErr: () => false }),
      isLoggedIn: () => false,
    },
    amcRequest: () => {
      throw new Error('Not implemented');
    },
    amcRequestSingle: () => {
      throw new Error('Not implemented');
    },
    getBaseUrl: () => {
      const protocol = siteData.sslSupported ? 'https' : 'http';
      return `${protocol}://${siteData.domain}`;
    },
  };
}

/**
 * テスト用ページ作成
 */
function createTestPage(options: Partial<PageData> = {}): Page {
  const site = createMockSite();
  return new Page({
    site: site as unknown as PageData['site'],
    fullname: options.fullname ?? TEST_PAGE_DATA.fullname,
    name: options.name ?? TEST_PAGE_DATA.name,
    category: options.category ?? TEST_PAGE_DATA.category,
    title: options.title ?? TEST_PAGE_DATA.title,
    childrenCount: options.childrenCount ?? TEST_PAGE_DATA.childrenCount,
    commentsCount: options.commentsCount ?? TEST_PAGE_DATA.commentsCount,
    size: options.size ?? TEST_PAGE_DATA.size,
    rating: options.rating ?? TEST_PAGE_DATA.rating,
    votesCount: options.votesCount ?? TEST_PAGE_DATA.votesCount,
    ratingPercent: options.ratingPercent ?? TEST_PAGE_DATA.ratingPercent,
    revisionsCount: options.revisionsCount ?? TEST_PAGE_DATA.revisionsCount,
    parentFullname: options.parentFullname ?? TEST_PAGE_DATA.parentFullname,
    tags: options.tags ?? [...TEST_PAGE_DATA.tags],
    createdBy: options.createdBy ?? null,
    createdAt: options.createdAt ?? new Date(),
    updatedBy: options.updatedBy ?? null,
    updatedAt: options.updatedAt ?? new Date(),
    commentedBy: options.commentedBy ?? null,
    commentedAt: options.commentedAt ?? null,
  });
}

describe('Pageデータクラス', () => {
  describe('基本プロパティ', () => {
    test('toString()が正しい文字列を返す', () => {
      const page = createTestPage();

      const result = page.toString();

      expect(result).toContain('Page(');
      expect(result).toContain('fullname=test-page');
      expect(result).toContain('title=Test Page Title');
    });

    test('fullnameが正しく設定される', () => {
      const page = createTestPage({ fullname: 'scp-001' });

      expect(page.fullname).toBe('scp-001');
    });

    test('nameが正しく設定される', () => {
      const page = createTestPage({ name: 'scp-001' });

      expect(page.name).toBe('scp-001');
    });

    test('categoryが正しく設定される', () => {
      const page = createTestPage({ category: 'component' });

      expect(page.category).toBe('component');
    });

    test('titleが正しく設定される', () => {
      const page = createTestPage({ title: 'Custom Title' });

      expect(page.title).toBe('Custom Title');
    });

    test('ratingが正しく設定される', () => {
      const page = createTestPage({ rating: 100 });

      expect(page.rating).toBe(100);
    });

    test('tagsが正しく設定される', () => {
      const page = createTestPage({ tags: ['scp', 'euclid'] });

      expect(page.tags).toEqual(['scp', 'euclid']);
    });
  });

  describe('URL生成', () => {
    test('getUrl()がSSL対応サイトの正しいURLを返す', () => {
      const page = createTestPage({ fullname: 'scp-001' });

      const url = page.getUrl();

      expect(url).toBe('https://test-site.wikidot.com/scp-001');
    });
  });

  describe('ページID', () => {
    test('初期状態ではidがnull', () => {
      const page = createTestPage();

      expect(page.id).toBeNull();
    });

    test('isIdAcquired()が初期状態でfalseを返す', () => {
      const page = createTestPage();

      expect(page.isIdAcquired()).toBe(false);
    });

    test('idを設定するとisIdAcquired()がtrueを返す', () => {
      const page = createTestPage();
      page.id = 12345;

      expect(page.isIdAcquired()).toBe(true);
      expect(page.id).toBe(12345);
    });
  });

  describe('統計情報', () => {
    test('childrenCountが正しく設定される', () => {
      const page = createTestPage({ childrenCount: 5 });

      expect(page.childrenCount).toBe(5);
    });

    test('commentsCountが正しく設定される', () => {
      const page = createTestPage({ commentsCount: 10 });

      expect(page.commentsCount).toBe(10);
    });

    test('sizeが正しく設定される', () => {
      const page = createTestPage({ size: 5000 });

      expect(page.size).toBe(5000);
    });

    test('votesCountが正しく設定される', () => {
      const page = createTestPage({ votesCount: 25 });

      expect(page.votesCount).toBe(25);
    });

    test('revisionsCountが正しく設定される', () => {
      const page = createTestPage({ revisionsCount: 10 });

      expect(page.revisionsCount).toBe(10);
    });
  });

  describe('親ページ', () => {
    test('parentFullnameがnullの場合', () => {
      const page = createTestPage({ parentFullname: null });

      expect(page.parentFullname).toBeNull();
    });

    test('parentFullnameが設定される場合', () => {
      const page = createTestPage({ parentFullname: 'parent-page' });

      expect(page.parentFullname).toBe('parent-page');
    });
  });

  describe('日時情報', () => {
    test('createdAtが設定される', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const page = createTestPage({ createdAt: date });

      expect(page.createdAt).toEqual(date);
    });

    test('updatedAtが設定される', () => {
      const date = new Date('2024-01-02T00:00:00Z');
      const page = createTestPage({ updatedAt: date });

      expect(page.updatedAt).toEqual(date);
    });

    test('commentedAtがnullの場合', () => {
      const page = createTestPage({ commentedAt: null });

      expect(page.commentedAt).toBeNull();
    });

    test('commentedAtが設定される場合', () => {
      const date = new Date('2024-01-03T00:00:00Z');
      const page = createTestPage({ commentedAt: date });

      expect(page.commentedAt).toEqual(date);
    });
  });
});
