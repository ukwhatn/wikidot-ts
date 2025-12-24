/**
 * ページディスカッション（コメント）操作の統合テスト
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { ForumThread, Page } from '../../src';
import { safeDeletePage } from './helpers/cleanup';
import { cleanup, getSite } from './helpers/client';
import { generatePageName } from './helpers/page-name';
import { waitForCondition } from './helpers/retry';
import { shouldSkipIntegration } from './setup';

describe.skipIf(shouldSkipIntegration())('Page Discussion Integration Tests', () => {
  let pageName: string;
  let page: Page | null = null;
  let discussion: ForumThread | null = null;

  beforeAll(async () => {
    pageName = generatePageName('discussion');
    const site = await getSite();

    // テスト用ページを作成
    await site.page.create(pageName, {
      title: 'Discussion Test Page',
      source: 'Content for discussion test.',
    });

    const pageResult = await site.page.get(pageName);
    if (pageResult.isOk() && pageResult.value) {
      page = pageResult.value;
    }

    // ディスカッションが利用可能になるまで待機
    if (page) {
      discussion = await waitForCondition(
        async () => {
          const res = await page!.getDiscussion();
          return res.isOk() ? res.value : null;
        },
        (d) => d !== null
      );
    }
  }, 60000);

  afterAll(async () => {
    const site = await getSite();
    await safeDeletePage(site, pageName);
    await cleanup();
  });

  test('1. ディスカッション取得', () => {
    expect(page).not.toBeNull();
    expect(discussion).not.toBeNull();
  });

  test('2. コメント投稿', async () => {
    expect(page).not.toBeNull();
    expect(discussion).not.toBeNull();

    const initialPostCount = discussion!.postCount;

    // コメントを投稿
    const replyResult = await discussion!.reply('This is a test comment.', 'Test Comment');
    expect(replyResult.isOk()).toBe(true);

    // 投稿数が増えたことを確認
    expect(discussion!.postCount).toBe(initialPostCount + 1);
  });

  test('3. 投稿一覧取得', async () => {
    expect(page).not.toBeNull();
    expect(discussion).not.toBeNull();

    // 投稿一覧を取得
    const postsResult = await discussion!.getPosts();
    expect(postsResult.isOk()).toBe(true);
    // 投稿がある場合は配列の長さをチェック
    expect(postsResult.value!.length).toBeGreaterThanOrEqual(0);
  });

  test('4. 投稿への返信', async () => {
    expect(page).not.toBeNull();
    expect(discussion).not.toBeNull();

    // 投稿一覧を取得
    const postsResult = await discussion!.getPosts();
    expect(postsResult.isOk()).toBe(true);

    const posts = postsResult.value!;
    if (posts.length === 0) {
      // 投稿がない場合は親投稿を作成
      await discussion!.reply('Parent post.', 'Parent');
      const newPostsResult = await discussion!.getPosts();
      expect(newPostsResult.isOk()).toBe(true);
    }

    // 再取得
    const refreshedPostsResult = await discussion!.getPosts();
    expect(refreshedPostsResult.isOk()).toBe(true);

    const refreshedPosts = refreshedPostsResult.value!;
    expect(refreshedPosts.length).toBeGreaterThan(0);

    const parentPost = refreshedPosts[0];
    const initialCount = discussion!.postCount;

    // 親投稿に返信
    const replyResult = await discussion!.reply('This is a reply.', 'Reply', parentPost.id);
    expect(replyResult.isOk()).toBe(true);
    expect(discussion!.postCount).toBe(initialCount + 1);
  });
});
