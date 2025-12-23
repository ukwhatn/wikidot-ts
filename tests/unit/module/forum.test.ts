/**
 * Forumモジュールのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import type { Element } from 'domhandler';
import { ForumCategory } from '../../../src/module/forum/forum-category';
import { ForumPost } from '../../../src/module/forum/forum-post';
import { ForumThread } from '../../../src/module/forum/forum-thread';
import type { ForumThreadRef, SiteRef } from '../../../src/module/types';
import { User } from '../../../src/module/user/user';
import { MockAMCClient } from '../../mocks/amc-client.mock';
import {
  TEST_FORUM_CATEGORY_DATA,
  TEST_FORUM_POST_DATA,
  TEST_FORUM_THREAD_DATA,
  TEST_SITE_DATA,
} from '../../setup';

/**
 * テスト用サイト作成
 */
function createMockSite(): SiteRef {
  const _amcClient = new MockAMCClient();
  return {
    id: TEST_SITE_DATA.id,
    unixName: TEST_SITE_DATA.unixName,
    domain: TEST_SITE_DATA.domain,
    sslSupported: TEST_SITE_DATA.sslSupported,
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
  };
}

/**
 * テスト用スレッド参照作成
 */
function createMockThreadRef(site: SiteRef): ForumThreadRef {
  return {
    id: TEST_FORUM_THREAD_DATA.id,
    site: site as ForumThreadRef['site'],
  };
}

/**
 * テスト用ユーザー作成
 */
function createMockUser(name: string): User {
  const client = {
    requireLogin: () => ({ isErr: () => false }),
    isLoggedIn: () => false,
  };
  return new User(client, {
    id: 12345,
    name,
    unixName: name.toLowerCase().replace(/\s/g, '-'),
  });
}

describe('ForumCategoryデータクラス', () => {
  describe('基本プロパティ', () => {
    test('toString()が正しい文字列を返す', () => {
      const site = createMockSite();
      const category = new ForumCategory({
        site: site as unknown as Parameters<typeof ForumCategory.prototype.constructor>[0]['site'],
        id: TEST_FORUM_CATEGORY_DATA.id,
        title: TEST_FORUM_CATEGORY_DATA.title,
        description: TEST_FORUM_CATEGORY_DATA.description,
        threadsCount: TEST_FORUM_CATEGORY_DATA.threadsCount,
        postsCount: TEST_FORUM_CATEGORY_DATA.postsCount,
      });

      const result = category.toString();

      expect(result).toContain('ForumCategory(');
      expect(result).toContain(`id=${TEST_FORUM_CATEGORY_DATA.id}`);
      expect(result).toContain(`title=${TEST_FORUM_CATEGORY_DATA.title}`);
    });

    test('idが正しく設定される', () => {
      const site = createMockSite();
      const category = new ForumCategory({
        site: site as unknown as Parameters<typeof ForumCategory.prototype.constructor>[0]['site'],
        id: 999,
        title: 'Test',
        description: 'Description',
        threadsCount: 0,
        postsCount: 0,
      });

      expect(category.id).toBe(999);
    });

    test('titleが正しく設定される', () => {
      const site = createMockSite();
      const category = new ForumCategory({
        site: site as unknown as Parameters<typeof ForumCategory.prototype.constructor>[0]['site'],
        id: 1,
        title: 'Custom Title',
        description: 'Description',
        threadsCount: 0,
        postsCount: 0,
      });

      expect(category.title).toBe('Custom Title');
    });

    test('descriptionが正しく設定される', () => {
      const site = createMockSite();
      const category = new ForumCategory({
        site: site as unknown as Parameters<typeof ForumCategory.prototype.constructor>[0]['site'],
        id: 1,
        title: 'Test',
        description: 'Custom Description',
        threadsCount: 0,
        postsCount: 0,
      });

      expect(category.description).toBe('Custom Description');
    });

    test('threadsCountが正しく設定される', () => {
      const site = createMockSite();
      const category = new ForumCategory({
        site: site as unknown as Parameters<typeof ForumCategory.prototype.constructor>[0]['site'],
        id: 1,
        title: 'Test',
        description: 'Description',
        threadsCount: 50,
        postsCount: 0,
      });

      expect(category.threadsCount).toBe(50);
    });

    test('postsCountが正しく設定される', () => {
      const site = createMockSite();
      const category = new ForumCategory({
        site: site as unknown as Parameters<typeof ForumCategory.prototype.constructor>[0]['site'],
        id: 1,
        title: 'Test',
        description: 'Description',
        threadsCount: 0,
        postsCount: 100,
      });

      expect(category.postsCount).toBe(100);
    });
  });
});

describe('ForumThreadデータクラス', () => {
  describe('基本プロパティ', () => {
    test('toString()が正しい文字列を返す', () => {
      const site = createMockSite();
      const thread = new ForumThread({
        site: site as unknown as Parameters<typeof ForumThread.prototype.constructor>[0]['site'],
        id: TEST_FORUM_THREAD_DATA.id,
        title: TEST_FORUM_THREAD_DATA.title,
        description: TEST_FORUM_THREAD_DATA.description,
        postCount: TEST_FORUM_THREAD_DATA.postCount,
        createdBy: null,
        createdAt: new Date(),
      });

      const result = thread.toString();

      expect(result).toContain('ForumThread(');
      expect(result).toContain(`id=${TEST_FORUM_THREAD_DATA.id}`);
      expect(result).toContain(`title=${TEST_FORUM_THREAD_DATA.title}`);
    });

    test('idが正しく設定される', () => {
      const site = createMockSite();
      const thread = new ForumThread({
        site: site as unknown as Parameters<typeof ForumThread.prototype.constructor>[0]['site'],
        id: 5000,
        title: 'Test',
        description: 'Description',
        postCount: 0,
        createdBy: null,
        createdAt: new Date(),
      });

      expect(thread.id).toBe(5000);
    });

    test('titleが正しく設定される', () => {
      const site = createMockSite();
      const thread = new ForumThread({
        site: site as unknown as Parameters<typeof ForumThread.prototype.constructor>[0]['site'],
        id: 1,
        title: 'Custom Title',
        description: 'Description',
        postCount: 0,
        createdBy: null,
        createdAt: new Date(),
      });

      expect(thread.title).toBe('Custom Title');
    });

    test('descriptionが正しく設定される', () => {
      const site = createMockSite();
      const thread = new ForumThread({
        site: site as unknown as Parameters<typeof ForumThread.prototype.constructor>[0]['site'],
        id: 1,
        title: 'Test',
        description: 'Custom Description',
        postCount: 0,
        createdBy: null,
        createdAt: new Date(),
      });

      expect(thread.description).toBe('Custom Description');
    });

    test('postCountが正しく設定される', () => {
      const site = createMockSite();
      const thread = new ForumThread({
        site: site as unknown as Parameters<typeof ForumThread.prototype.constructor>[0]['site'],
        id: 1,
        title: 'Test',
        description: 'Description',
        postCount: 25,
        createdBy: null,
        createdAt: new Date(),
      });

      expect(thread.postCount).toBe(25);
    });
  });
});

describe('ForumPostデータクラス', () => {
  describe('基本プロパティ', () => {
    test('toString()が正しい文字列を返す', () => {
      const site = createMockSite();
      const threadRef = createMockThreadRef(site);
      const createdBy = createMockUser('TestUser');
      const mockElement = { type: 'tag', name: 'div' } as Element;
      const post = new ForumPost({
        thread: threadRef,
        id: TEST_FORUM_POST_DATA.id,
        title: TEST_FORUM_POST_DATA.title,
        text: TEST_FORUM_POST_DATA.text,
        element: mockElement,
        createdBy,
        createdAt: new Date(),
        editedBy: null,
        editedAt: null,
        parentId: null,
      });

      const result = post.toString();

      expect(result).toContain('ForumPost(');
      expect(result).toContain(`id=${TEST_FORUM_POST_DATA.id}`);
      expect(result).toContain(`title=${TEST_FORUM_POST_DATA.title}`);
    });

    test('idが正しく設定される', () => {
      const site = createMockSite();
      const threadRef = createMockThreadRef(site);
      const createdBy = createMockUser('TestUser');
      const mockElement = { type: 'tag', name: 'div' } as Element;
      const post = new ForumPost({
        thread: threadRef,
        id: 9999,
        title: 'Test',
        text: 'Text',
        element: mockElement,
        createdBy,
        createdAt: new Date(),
        editedBy: null,
        editedAt: null,
        parentId: null,
      });

      expect(post.id).toBe(9999);
    });

    test('titleが正しく設定される', () => {
      const site = createMockSite();
      const threadRef = createMockThreadRef(site);
      const createdBy = createMockUser('TestUser');
      const mockElement = { type: 'tag', name: 'div' } as Element;
      const post = new ForumPost({
        thread: threadRef,
        id: 1,
        title: 'Custom Title',
        text: 'Text',
        element: mockElement,
        createdBy,
        createdAt: new Date(),
        editedBy: null,
        editedAt: null,
        parentId: null,
      });

      expect(post.title).toBe('Custom Title');
    });

    test('textが正しく設定される', () => {
      const site = createMockSite();
      const threadRef = createMockThreadRef(site);
      const createdBy = createMockUser('TestUser');
      const mockElement = { type: 'tag', name: 'div' } as Element;
      const post = new ForumPost({
        thread: threadRef,
        id: 1,
        title: 'Test',
        text: '<p>Custom content</p>',
        element: mockElement,
        createdBy,
        createdAt: new Date(),
        editedBy: null,
        editedAt: null,
        parentId: null,
      });

      expect(post.text).toBe('<p>Custom content</p>');
    });

    test('parentIdがnullの場合', () => {
      const site = createMockSite();
      const threadRef = createMockThreadRef(site);
      const createdBy = createMockUser('TestUser');
      const mockElement = { type: 'tag', name: 'div' } as Element;
      const post = new ForumPost({
        thread: threadRef,
        id: 1,
        title: 'Root Post',
        text: 'Text',
        element: mockElement,
        createdBy,
        createdAt: new Date(),
        editedBy: null,
        editedAt: null,
        parentId: null,
      });

      expect(post.parentId).toBeNull();
    });
  });
});
