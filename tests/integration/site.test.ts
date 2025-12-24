/**
 * Site and page retrieval integration tests
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

  describe('Site retrieval', () => {
    test('Get site', async () => {
      const site = await getSite();
      expect(site.unixName).toBe('ukwhatn-ci');
      expect(site.id).toBeGreaterThan(0);
    });

    test('Site has title', async () => {
      const site = await getSite();
      expect(site.title).toBeDefined();
      expect(site.title.length).toBeGreaterThan(0);
    });
  });

  describe('Page retrieval', () => {
    test('Get existing page (start page)', async () => {
      const site = await getSite();
      const pageResult = await site.page.get('start');
      expect(pageResult.isOk()).toBe(true);
      expect(pageResult.value).not.toBeNull();
      expect(pageResult.value?.fullname).toBe('start');
    });

    test('Get non-existent page', async () => {
      const site = await getSite();
      const pageResult = await site.page.get('nonexistent-page-12345678');
      expect(pageResult.isOk()).toBe(true);
      expect(pageResult.value).toBeNull();
    });

    test('Page has properties', async () => {
      const site = await getSite();
      const pageResult = await site.page.get('start');
      expect(pageResult.isOk()).toBe(true);

      const page = pageResult.value!;
      expect(page.fullname).toBeDefined();
      expect(page.title).toBeDefined();
      expect(page.createdAt).toBeDefined();
      expect(page.rating).toBeDefined();
      // NOTE: Initial page may have revisionsCount of 0
      expect(page.revisionsCount).toBeGreaterThanOrEqual(0);
    });
  });
});
