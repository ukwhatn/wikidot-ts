/**
 * ページ投票の統合テスト
 */
import { describe, expect, test } from 'bun:test';
import { getSite } from './helpers/client';
import { shouldSkipIntegration } from './setup';

describe.skipIf(shouldSkipIntegration())('Page Votes Integration Tests', () => {
  test('1. 既存ページの投票情報取得', async () => {
    const site = await getSite();
    const pageResult = await site.page.get('start');
    expect(pageResult.isOk()).toBe(true);

    const page = pageResult.value!;
    const votesResult = await page.getVotes();
    expect(votesResult.isOk()).toBe(true);

    const votes = votesResult.value;
    expect(votes).not.toBeNull();
    // 投票がなくても空のコレクションが返る
    expect(Array.isArray(votes)).toBe(true);
  });

  test('2. 投票プロパティ確認', async () => {
    const site = await getSite();
    const pageResult = await site.page.get('start');
    expect(pageResult.isOk()).toBe(true);

    const page = pageResult.value!;
    const votesResult = await page.getVotes();
    expect(votesResult.isOk()).toBe(true);

    const votes = votesResult.value!;
    // 投票がある場合はプロパティを確認
    if (votes.length > 0) {
      const vote = votes[0];
      expect(vote.page).toBeDefined();
      expect(vote.user).toBeDefined();
      expect(vote.value).toBeDefined();
    }
  });
});
