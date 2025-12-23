/**
 * Siteモジュールのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import { Site } from '../../../src/module/site/site';
import type { ClientRef } from '../../../src/module/types';
import { MockAMCClient } from '../../mocks/amc-client.mock';

/**
 * モッククライアント作成
 */
function createMockClient(): ClientRef & { amcClient: MockAMCClient } {
  const amcClient = new MockAMCClient();
  return {
    requireLogin: () => ({ isErr: () => false }),
    isLoggedIn: () => false,
    amcClient,
  };
}

/**
 * テスト用サイト作成
 */
function createTestSite(
  options: Partial<{
    id: number;
    title: string;
    unixName: string;
    domain: string;
    sslSupported: boolean;
  }> = {}
): Site {
  const mockClient = createMockClient();
  return new Site(mockClient as unknown as Parameters<typeof Site.prototype.constructor>[0], {
    id: options.id ?? 123456,
    title: options.title ?? 'Test Site',
    unixName: options.unixName ?? 'test-site',
    domain: options.domain ?? 'test-site.wikidot.com',
    sslSupported: options.sslSupported ?? true,
  });
}

describe('Siteデータクラス', () => {
  describe('基本プロパティ', () => {
    test('toString()が正しい文字列を返す', () => {
      const site = createTestSite();

      const result = site.toString();

      expect(result).toContain('Site(');
      expect(result).toContain('id=123456');
      expect(result).toContain('title=Test Site');
      expect(result).toContain('unixName=test-site');
    });

    test('SSL対応サイトのURLはhttps', () => {
      const site = createTestSite({ sslSupported: true });

      expect(site.getBaseUrl()).toBe('https://test-site.wikidot.com');
    });

    test('SSL非対応サイトのURLはhttp', () => {
      const site = createTestSite({ sslSupported: false });

      expect(site.getBaseUrl()).toBe('http://test-site.wikidot.com');
    });

    test('idが正しく設定される', () => {
      const site = createTestSite({ id: 999 });

      expect(site.id).toBe(999);
    });

    test('titleが正しく設定される', () => {
      const site = createTestSite({ title: 'Custom Title' });

      expect(site.title).toBe('Custom Title');
    });

    test('unixNameが正しく設定される', () => {
      const site = createTestSite({ unixName: 'custom-site' });

      expect(site.unixName).toBe('custom-site');
    });

    test('domainが正しく設定される', () => {
      const site = createTestSite({ domain: 'custom.wikidot.com' });

      expect(site.domain).toBe('custom.wikidot.com');
    });
  });

  describe('アクセサ', () => {
    test('pagesアクセサが存在する', () => {
      const site = createTestSite();

      expect(site.pages).toBeDefined();
    });

    test('pageアクセサが存在する', () => {
      const site = createTestSite();

      expect(site.page).toBeDefined();
    });

    test('forumアクセサが存在する', () => {
      const site = createTestSite();

      expect(site.forum).toBeDefined();
    });

    test('memberアクセサが存在する', () => {
      const site = createTestSite();

      expect(site.member).toBeDefined();
    });
  });
});
