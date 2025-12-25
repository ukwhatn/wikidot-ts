/**
 * Page votes integration tests
 */
import { describe, expect, test } from 'bun:test';
import { getSite } from './helpers/client';
import { shouldSkipIntegration } from './setup';

describe.skipIf(shouldSkipIntegration())('Page Votes Integration Tests', () => {
  test('1. Get existing page votes', async () => {
    const site = await getSite();
    const pageResult = await site.page.get('start');
    expect(pageResult.isOk()).toBe(true);

    const page = pageResult.value!;
    const votesResult = await page.getVotes();
    expect(votesResult.isOk()).toBe(true);

    const votes = votesResult.value;
    expect(votes).not.toBeNull();
    // Empty collection is returned even if no votes exist
    expect(Array.isArray(votes)).toBe(true);
  });

  test('2. Verify vote properties', async () => {
    const site = await getSite();
    const pageResult = await site.page.get('start');
    expect(pageResult.isOk()).toBe(true);

    const page = pageResult.value!;
    const votesResult = await page.getVotes();
    expect(votesResult.isOk()).toBe(true);

    const votes = votesResult.value!;
    // Verify properties if votes exist
    if (votes.length > 0) {
      const vote = votes[0];
      expect(vote.page).toBeDefined();
      expect(vote.user).toBeDefined();
      expect(vote.value).toBeDefined();
    }
  });
});
