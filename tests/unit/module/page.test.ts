/**
 * Page module unit tests
 */
import { describe, expect, test } from 'bun:test';
import { Page, type PageData } from '../../../src/module/page/page';
import type { SiteRef } from '../../../src/module/types';
import { MockAMCClient } from '../../mocks/amc-client.mock';
import { TEST_PAGE_DATA, TEST_SITE_DATA } from '../../setup';

/**
 * Create test site
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
 * Create test page
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

describe('Page data class', () => {
  describe('Basic properties', () => {
    test('toString() returns correct string', () => {
      const page = createTestPage();

      const result = page.toString();

      expect(result).toContain('Page(');
      expect(result).toContain('fullname=test-page');
      expect(result).toContain('title=Test Page Title');
    });

    test('fullname is correctly set', () => {
      const page = createTestPage({ fullname: 'scp-001' });

      expect(page.fullname).toBe('scp-001');
    });

    test('name is correctly set', () => {
      const page = createTestPage({ name: 'scp-001' });

      expect(page.name).toBe('scp-001');
    });

    test('category is correctly set', () => {
      const page = createTestPage({ category: 'component' });

      expect(page.category).toBe('component');
    });

    test('title is correctly set', () => {
      const page = createTestPage({ title: 'Custom Title' });

      expect(page.title).toBe('Custom Title');
    });

    test('rating is correctly set', () => {
      const page = createTestPage({ rating: 100 });

      expect(page.rating).toBe(100);
    });

    test('tags are correctly set', () => {
      const page = createTestPage({ tags: ['scp', 'euclid'] });

      expect(page.tags).toEqual(['scp', 'euclid']);
    });
  });

  describe('URL generation', () => {
    test('getUrl() returns correct URL for SSL-enabled site', () => {
      const page = createTestPage({ fullname: 'scp-001' });

      const url = page.getUrl();

      expect(url).toBe('https://test-site.wikidot.com/scp-001');
    });
  });

  describe('Page ID', () => {
    test('id is null in initial state', () => {
      const page = createTestPage();

      expect(page.id).toBeNull();
    });

    test('isIdAcquired() returns false in initial state', () => {
      const page = createTestPage();

      expect(page.isIdAcquired()).toBe(false);
    });

    test('isIdAcquired() returns true after setting id', () => {
      const page = createTestPage();
      page.id = 12345;

      expect(page.isIdAcquired()).toBe(true);
      expect(page.id).toBe(12345);
    });
  });

  describe('Statistics', () => {
    test('childrenCount is correctly set', () => {
      const page = createTestPage({ childrenCount: 5 });

      expect(page.childrenCount).toBe(5);
    });

    test('commentsCount is correctly set', () => {
      const page = createTestPage({ commentsCount: 10 });

      expect(page.commentsCount).toBe(10);
    });

    test('size is correctly set', () => {
      const page = createTestPage({ size: 5000 });

      expect(page.size).toBe(5000);
    });

    test('votesCount is correctly set', () => {
      const page = createTestPage({ votesCount: 25 });

      expect(page.votesCount).toBe(25);
    });

    test('revisionsCount is correctly set', () => {
      const page = createTestPage({ revisionsCount: 10 });

      expect(page.revisionsCount).toBe(10);
    });
  });

  describe('Parent page', () => {
    test('parentFullname when null', () => {
      const page = createTestPage({ parentFullname: null });

      expect(page.parentFullname).toBeNull();
    });

    test('parentFullname when set', () => {
      const page = createTestPage({ parentFullname: 'parent-page' });

      expect(page.parentFullname).toBe('parent-page');
    });
  });

  describe('Timestamps', () => {
    test('createdAt is set', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const page = createTestPage({ createdAt: date });

      expect(page.createdAt).toEqual(date);
    });

    test('updatedAt is set', () => {
      const date = new Date('2024-01-02T00:00:00Z');
      const page = createTestPage({ updatedAt: date });

      expect(page.updatedAt).toEqual(date);
    });

    test('commentedAt when null', () => {
      const page = createTestPage({ commentedAt: null });

      expect(page.commentedAt).toBeNull();
    });

    test('commentedAt when set', () => {
      const date = new Date('2024-01-03T00:00:00Z');
      const page = createTestPage({ commentedAt: date });

      expect(page.commentedAt).toEqual(date);
    });
  });
});
