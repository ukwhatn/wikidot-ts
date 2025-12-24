/**
 * Forum category integration tests
 */
import { describe, expect, test } from 'bun:test';
import { getSite } from './helpers/client';
import { shouldSkipIntegration } from './setup';

describe.skipIf(shouldSkipIntegration())('Forum Category Integration Tests', () => {
  test('1. Get forum category list', async () => {
    const site = await getSite();
    const result = await site.forum.getCategories();
    expect(result.isOk()).toBe(true);

    const categories = result.value!;
    // Empty collection is returned even if no categories exist
    expect(Array.isArray(categories)).toBe(true);
  });

  test('2. Verify category properties', async () => {
    const site = await getSite();
    const result = await site.forum.getCategories();
    expect(result.isOk()).toBe(true);

    const categories = result.value!;
    // Verify properties if categories exist
    if (categories.length > 0) {
      const category = categories[0];
      expect(category.id).toBeDefined();
      expect(category.title).toBeDefined();
      expect(category.site).toBeDefined();
    }
  });

  test('3. Get thread list from category', async () => {
    const site = await getSite();
    const result = await site.forum.getCategories();
    expect(result.isOk()).toBe(true);

    const categories = result.value!;
    // Get threads if categories exist
    if (categories.length > 0) {
      const category = categories[0];
      const threadsResult = await category.getThreads();
      expect(threadsResult.isOk()).toBe(true);
      expect(Array.isArray(threadsResult.value)).toBe(true);
    }
  });
});
