/**
 * 共有型定義のテスト
 */
import { describe, expect, test } from 'bun:test';
import { wdOkAsync } from '../../../src/common/types';
import type { AMCResponse } from '../../../src/connector';
import type {
  ClientRef,
  ForumCategoryRef,
  ForumThreadRef,
  PageRef,
  SiteRef,
} from '../../../src/module/types';

describe('共有型定義', () => {
  describe('ClientRef', () => {
    test('必須プロパティが定義されている', () => {
      // 型のテスト用のモックオブジェクト
      const mockClient: ClientRef = {
        requireLogin: () => ({ isErr: () => false }),
        isLoggedIn: () => true,
      };

      expect(mockClient.requireLogin).toBeDefined();
      expect(mockClient.isLoggedIn).toBeDefined();
    });
  });

  describe('SiteRef', () => {
    test('必須プロパティが定義されている', () => {
      const mockSite: SiteRef = {
        id: 123456,
        unixName: 'test-site',
        domain: 'test-site.wikidot.com',
        sslSupported: true,
        client: {
          requireLogin: () => ({ isErr: () => false }),
          isLoggedIn: () => true,
        },
        amcRequest: () => wdOkAsync<AMCResponse[]>([]),
        amcRequestSingle: () => wdOkAsync<AMCResponse>({} as AMCResponse),
      };

      expect(mockSite.id).toBe(123456);
      expect(mockSite.unixName).toBe('test-site');
      expect(mockSite.domain).toBe('test-site.wikidot.com');
      expect(mockSite.sslSupported).toBe(true);
    });
  });

  describe('ForumCategoryRef', () => {
    test('必須プロパティが定義されている', () => {
      const mockCategory: ForumCategoryRef = {
        id: 1,
        title: 'Test Category',
        site: {} as SiteRef,
      };

      expect(mockCategory.id).toBe(1);
      expect(mockCategory.title).toBe('Test Category');
    });
  });

  describe('ForumThreadRef', () => {
    test('必須プロパティが定義されている', () => {
      const mockThread: ForumThreadRef = {
        id: 100,
        title: 'Test Thread',
        site: {} as SiteRef,
        category: null,
      };

      expect(mockThread.id).toBe(100);
      expect(mockThread.title).toBe('Test Thread');
    });

    test('categoryはnullまたはForumCategoryRefを持てる', () => {
      const threadWithoutCategory: ForumThreadRef = {
        id: 100,
        title: 'Test Thread',
        site: {} as SiteRef,
        category: null,
      };

      const threadWithCategory: ForumThreadRef = {
        id: 100,
        title: 'Test Thread',
        site: {} as SiteRef,
        category: {
          id: 1,
          title: 'Category',
          site: {} as SiteRef,
        },
      };

      expect(threadWithoutCategory.category).toBeNull();
      expect(threadWithCategory.category?.id).toBe(1);
    });
  });

  describe('PageRef', () => {
    test('必須プロパティが定義されている', () => {
      const mockPage: PageRef = {
        id: 12345,
        fullname: 'scp-001',
        name: 'scp-001',
        category: '_default',
        site: {} as SiteRef,
      };

      expect(mockPage.id).toBe(12345);
      expect(mockPage.fullname).toBe('scp-001');
      expect(mockPage.name).toBe('scp-001');
      expect(mockPage.category).toBe('_default');
    });

    test('idはnullを持てる', () => {
      const pageWithoutId: PageRef = {
        id: null,
        fullname: 'new-page',
        name: 'new-page',
        category: '_default',
        site: {} as SiteRef,
      };

      expect(pageWithoutId.id).toBeNull();
    });
  });
});
