/**
 * Site module unit tests
 */
import { describe, expect, test } from 'bun:test';
import { Site } from '../../../src/module/site/site';
import type { ClientRef } from '../../../src/module/types';
import { MockAMCClient } from '../../mocks/amc-client.mock';

/**
 * Create mock client
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
 * Create test site
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

describe('Site data class', () => {
  describe('Basic properties', () => {
    test('toString() returns correct string', () => {
      const site = createTestSite();

      const result = site.toString();

      expect(result).toContain('Site(');
      expect(result).toContain('id=123456');
      expect(result).toContain('title=Test Site');
      expect(result).toContain('unixName=test-site');
    });

    test('SSL-enabled site URL uses https', () => {
      const site = createTestSite({ sslSupported: true });

      expect(site.getBaseUrl()).toBe('https://test-site.wikidot.com');
    });

    test('Non-SSL site URL uses http', () => {
      const site = createTestSite({ sslSupported: false });

      expect(site.getBaseUrl()).toBe('http://test-site.wikidot.com');
    });

    test('id is correctly set', () => {
      const site = createTestSite({ id: 999 });

      expect(site.id).toBe(999);
    });

    test('title is correctly set', () => {
      const site = createTestSite({ title: 'Custom Title' });

      expect(site.title).toBe('Custom Title');
    });

    test('unixName is correctly set', () => {
      const site = createTestSite({ unixName: 'custom-site' });

      expect(site.unixName).toBe('custom-site');
    });

    test('domain is correctly set', () => {
      const site = createTestSite({ domain: 'custom.wikidot.com' });

      expect(site.domain).toBe('custom.wikidot.com');
    });
  });

  describe('Accessors', () => {
    test('pages accessor exists', () => {
      const site = createTestSite();

      expect(site.pages).toBeDefined();
    });

    test('page accessor exists', () => {
      const site = createTestSite();

      expect(site.page).toBeDefined();
    });

    test('forum accessor exists', () => {
      const site = createTestSite();

      expect(site.forum).toBeDefined();
    });

    test('member accessor exists', () => {
      const site = createTestSite();

      expect(site.member).toBeDefined();
    });
  });
});
