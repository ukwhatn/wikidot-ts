/**
 * Forum module unit tests
 */
import { describe, expect, test } from 'bun:test';
import type { Element } from 'domhandler';
import { ForumCategory } from '../../../src/module/forum/forum-category';
import { ForumPost, ForumPostCollection } from '../../../src/module/forum/forum-post';
import { ForumThread } from '../../../src/module/forum/forum-thread';
import type { ForumThreadRef, SiteRef } from '../../../src/module/types';
import { User } from '../../../src/module/user/user';
import postsWithPseudoPost from '../../fixtures/amc_responses/forum/posts_with_pseudo_post.json';
import { MockAMCClient } from '../../mocks/amc-client.mock';
import {
  TEST_FORUM_CATEGORY_DATA,
  TEST_FORUM_POST_DATA,
  TEST_FORUM_THREAD_DATA,
  TEST_SITE_DATA,
} from '../../setup';

/**
 * Create test site
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
 * Create test thread reference
 */
function createMockThreadRef(site: SiteRef): ForumThreadRef {
  return {
    id: TEST_FORUM_THREAD_DATA.id,
    site: site as ForumThreadRef['site'],
  };
}

/**
 * Create test user
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

describe('ForumCategory data class', () => {
  describe('Basic properties', () => {
    test('toString() returns correct string', () => {
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

    test('id is correctly set', () => {
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

    test('title is correctly set', () => {
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

    test('description is correctly set', () => {
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

    test('threadsCount is correctly set', () => {
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

    test('postsCount is correctly set', () => {
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

describe('ForumThread data class', () => {
  describe('Basic properties', () => {
    test('toString() returns correct string', () => {
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

    test('id is correctly set', () => {
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

    test('title is correctly set', () => {
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

    test('description is correctly set', () => {
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

    test('postCount is correctly set', () => {
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

describe('ForumPost data class', () => {
  describe('Basic properties', () => {
    test('toString() returns correct string', () => {
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

    test('id is correctly set', () => {
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

    test('title is correctly set', () => {
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

    test('text is correctly set', () => {
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

    test('parentId when null', () => {
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

describe('ForumPostCollection', () => {
  describe('getPostSources', () => {
    test('can get sources for posts', async () => {
      const site = createMockSite();
      const threadRef = createMockThreadRef(site);
      const createdBy = createMockUser('TestUser');
      const mockElement = { type: 'tag', name: 'div' } as Element;

      const post1 = new ForumPost({
        thread: threadRef,
        id: 5001,
        title: 'Post 1',
        text: '<p>Content 1</p>',
        element: mockElement,
        createdBy,
        createdAt: new Date(),
        editedBy: null,
        editedAt: null,
        parentId: null,
      });

      const post2 = new ForumPost({
        thread: threadRef,
        id: 5002,
        title: 'Post 2',
        text: '<p>Content 2</p>',
        element: mockElement,
        createdBy,
        createdAt: new Date(),
        editedBy: null,
        editedAt: null,
        parentId: null,
      });

      const collection = new ForumPostCollection(threadRef, [post1, post2]);

      const mockResponse1 = {
        body: '<textarea name="source">Test source 1</textarea>',
      };
      const mockResponse2 = {
        body: '<textarea name="source">Test source 2</textarea>',
      };

      site.amcRequest = async () => ({
        isErr: () => false,
        value: [mockResponse1, mockResponse2],
      });

      const result = await collection.getPostSources();

      expect(result.isOk()).toBe(true);
      expect(post1._source).toBe('Test source 1');
      expect(post2._source).toBe('Test source 2');
    });

    test('skips already acquired sources', async () => {
      const site = createMockSite();
      const threadRef = createMockThreadRef(site);
      const createdBy = createMockUser('TestUser');
      const mockElement = { type: 'tag', name: 'div' } as Element;

      const post1 = new ForumPost({
        thread: threadRef,
        id: 5001,
        title: 'Post 1',
        text: '<p>Content 1</p>',
        element: mockElement,
        createdBy,
        createdAt: new Date(),
        editedBy: null,
        editedAt: null,
        parentId: null,
      });

      post1._source = 'cached source';

      const post2 = new ForumPost({
        thread: threadRef,
        id: 5002,
        title: 'Post 2',
        text: '<p>Content 2</p>',
        element: mockElement,
        createdBy,
        createdAt: new Date(),
        editedBy: null,
        editedAt: null,
        parentId: null,
      });

      const collection = new ForumPostCollection(threadRef, [post1, post2]);

      const mockResponse = {
        body: '<textarea name="source">Test source 2</textarea>',
      };

      let callCount = 0;
      site.amcRequest = async (requests) => {
        callCount++;
        // Only post2 should be requested
        expect(requests.length).toBe(1);
        expect(requests[0]?.postId).toBe(5002);
        return {
          isErr: () => false,
          value: [mockResponse],
        };
      };

      const result = await collection.getPostSources();

      expect(result.isOk()).toBe(true);
      expect(callCount).toBe(1);
      expect(post1._source).toBe('cached source');
      expect(post2._source).toBe('Test source 2');
    });

    test('handles empty collection', async () => {
      const site = createMockSite();
      const threadRef = createMockThreadRef(site);
      const collection = new ForumPostCollection(threadRef, []);

      const result = await collection.getPostSources();

      expect(result.isOk()).toBe(true);
      expect(collection.length).toBe(0);
    });
  });

  describe('acquireAllInThread', () => {
    test('ignores pseudo posts nested inside content', async () => {
      const site = createMockSite();
      const threadRef = createMockThreadRef(site);

      // Mock amcRequest to return HTML with pseudo posts
      site.amcRequest = async () => ({
        isErr: () => false,
        isOk: () => true,
        value: [postsWithPseudoPost],
      });

      const result = await ForumPostCollection.acquireAllInThread(threadRef);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const collection = result.value;
        // Should only have 2 top-level posts, not the pseudo post inside content
        expect(collection.length).toBe(2);
        expect(collection[0]?.id).toBe(5001);
        expect(collection[1]?.id).toBe(5002);
      }
    });

    test('parses posts correctly from HTML with pseudo posts', async () => {
      const site = createMockSite();
      const threadRef = createMockThreadRef(site);

      site.amcRequest = async () => ({
        isErr: () => false,
        isOk: () => true,
        value: [postsWithPseudoPost],
      });

      const result = await ForumPostCollection.acquireAllInThread(threadRef);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const collection = result.value;
        // First post should be from test_user_1
        expect(collection[0]?.createdBy.name).toBe('test_user_1');
        // Second post should be from test_user_2
        expect(collection[1]?.createdBy.name).toBe('test_user_2');
      }
    });
  });
});
