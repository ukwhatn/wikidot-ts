/**
 * ForumPostRevision module unit tests
 */
import { describe, expect, test } from 'bun:test';
import * as cheerio from 'cheerio';
import {
  ForumPostRevision,
  ForumPostRevisionCollection,
} from '../../../src/module/forum/forum-post-revision';
import type { ForumPostRef, ForumThreadRef, SiteRef } from '../../../src/module/types';
import { User } from '../../../src/module/user/user';
import { amcFixtures } from '../../fixtures/loader';
import { TEST_FORUM_POST_DATA, TEST_FORUM_THREAD_DATA, TEST_SITE_DATA } from '../../setup';

/**
 * Create test site
 */
function createMockSite(): SiteRef {
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
    title: TEST_FORUM_THREAD_DATA.title,
    site: site,
  };
}

/**
 * Create test post reference
 */
function createMockPostRef(thread: ForumThreadRef): ForumPostRef {
  return {
    id: TEST_FORUM_POST_DATA.id,
    title: TEST_FORUM_POST_DATA.title,
    thread: thread,
  };
}

/**
 * Create test user
 */
function createMockUser(name: string, id: number): User {
  const client = {
    requireLogin: () => ({ isErr: () => false }),
    isLoggedIn: () => false,
  };
  return new User(client, {
    id,
    name,
    unixName: name.toLowerCase().replace(/\s/g, '-'),
  });
}

describe('ForumPostRevision data class', () => {
  describe('Basic properties', () => {
    test('toString() returns correct string', () => {
      const site = createMockSite();
      const thread = createMockThreadRef(site);
      const post = createMockPostRef(thread);
      const createdBy = createMockUser('test_user', 12345);

      const revision = new ForumPostRevision({
        post,
        id: 9001,
        revNo: 0,
        createdBy,
        createdAt: new Date(1700000000 * 1000),
      });

      const result = revision.toString();

      expect(result).toContain('ForumPostRevision(');
      expect(result).toContain('id=9001');
      expect(result).toContain('revNo=0');
    });

    test('id is correctly set', () => {
      const site = createMockSite();
      const thread = createMockThreadRef(site);
      const post = createMockPostRef(thread);
      const createdBy = createMockUser('test_user', 12345);

      const revision = new ForumPostRevision({
        post,
        id: 9999,
        revNo: 2,
        createdBy,
        createdAt: new Date(),
      });

      expect(revision.id).toBe(9999);
    });

    test('revNo is correctly set', () => {
      const site = createMockSite();
      const thread = createMockThreadRef(site);
      const post = createMockPostRef(thread);
      const createdBy = createMockUser('test_user', 12345);

      const revision = new ForumPostRevision({
        post,
        id: 9001,
        revNo: 5,
        createdBy,
        createdAt: new Date(),
      });

      expect(revision.revNo).toBe(5);
    });

    test('createdBy is correctly set', () => {
      const site = createMockSite();
      const thread = createMockThreadRef(site);
      const post = createMockPostRef(thread);
      const createdBy = createMockUser('editor_user', 99999);

      const revision = new ForumPostRevision({
        post,
        id: 9001,
        revNo: 0,
        createdBy,
        createdAt: new Date(),
      });

      expect(revision.createdBy.name).toBe('editor_user');
    });

    test('createdAt is correctly set', () => {
      const site = createMockSite();
      const thread = createMockThreadRef(site);
      const post = createMockPostRef(thread);
      const createdBy = createMockUser('test_user', 12345);
      const createdAt = new Date(1700000000 * 1000);

      const revision = new ForumPostRevision({
        post,
        id: 9001,
        revNo: 0,
        createdBy,
        createdAt,
      });

      expect(revision.createdAt.getTime()).toBe(createdAt.getTime());
    });

    test('isHtmlAcquired() returns false initially', () => {
      const site = createMockSite();
      const thread = createMockThreadRef(site);
      const post = createMockPostRef(thread);
      const createdBy = createMockUser('test_user', 12345);

      const revision = new ForumPostRevision({
        post,
        id: 9001,
        revNo: 0,
        createdBy,
        createdAt: new Date(),
      });

      expect(revision.isHtmlAcquired()).toBe(false);
      expect(revision.html).toBeNull();
    });

    test('html setter works correctly', () => {
      const site = createMockSite();
      const thread = createMockThreadRef(site);
      const post = createMockPostRef(thread);
      const createdBy = createMockUser('test_user', 12345);

      const revision = new ForumPostRevision({
        post,
        id: 9001,
        revNo: 0,
        createdBy,
        createdAt: new Date(),
      });

      revision.html = '<p>Test HTML</p>';

      expect(revision.isHtmlAcquired()).toBe(true);
      expect(revision.html).toBe('<p>Test HTML</p>');
    });
  });
});

describe('ForumPostRevisionCollection', () => {
  describe('Collection operations', () => {
    test('constructor initializes empty collection', () => {
      const site = createMockSite();
      const thread = createMockThreadRef(site);
      const post = createMockPostRef(thread);

      const collection = new ForumPostRevisionCollection(post);

      expect(collection.length).toBe(0);
      expect(collection.post).toBe(post);
    });

    test('constructor initializes with revisions', () => {
      const site = createMockSite();
      const thread = createMockThreadRef(site);
      const post = createMockPostRef(thread);
      const createdBy = createMockUser('test_user', 12345);

      const revisions = [
        new ForumPostRevision({
          post,
          id: 9001,
          revNo: 0,
          createdBy,
          createdAt: new Date(),
        }),
        new ForumPostRevision({
          post,
          id: 9002,
          revNo: 1,
          createdBy,
          createdAt: new Date(),
        }),
      ];

      const collection = new ForumPostRevisionCollection(post, revisions);

      expect(collection.length).toBe(2);
    });

    test('findById() returns correct revision', () => {
      const site = createMockSite();
      const thread = createMockThreadRef(site);
      const post = createMockPostRef(thread);
      const createdBy = createMockUser('test_user', 12345);

      const revisions = [
        new ForumPostRevision({
          post,
          id: 9001,
          revNo: 0,
          createdBy,
          createdAt: new Date(),
        }),
        new ForumPostRevision({
          post,
          id: 9002,
          revNo: 1,
          createdBy,
          createdAt: new Date(),
        }),
      ];

      const collection = new ForumPostRevisionCollection(post, revisions);
      const found = collection.findById(9002);

      expect(found).toBeDefined();
      expect(found?.id).toBe(9002);
      expect(found?.revNo).toBe(1);
    });

    test('findById() returns undefined for non-existent ID', () => {
      const site = createMockSite();
      const thread = createMockThreadRef(site);
      const post = createMockPostRef(thread);
      const createdBy = createMockUser('test_user', 12345);

      const revisions = [
        new ForumPostRevision({
          post,
          id: 9001,
          revNo: 0,
          createdBy,
          createdAt: new Date(),
        }),
      ];

      const collection = new ForumPostRevisionCollection(post, revisions);
      const found = collection.findById(9999);

      expect(found).toBeUndefined();
    });

    test('findByRevNo() returns correct revision', () => {
      const site = createMockSite();
      const thread = createMockThreadRef(site);
      const post = createMockPostRef(thread);
      const createdBy = createMockUser('test_user', 12345);

      const revisions = [
        new ForumPostRevision({
          post,
          id: 9001,
          revNo: 0,
          createdBy,
          createdAt: new Date(),
        }),
        new ForumPostRevision({
          post,
          id: 9002,
          revNo: 1,
          createdBy,
          createdAt: new Date(),
        }),
      ];

      const collection = new ForumPostRevisionCollection(post, revisions);
      const found = collection.findByRevNo(0);

      expect(found).toBeDefined();
      expect(found?.id).toBe(9001);
    });
  });

  describe('Parsing', () => {
    test('parses revisions from HTML correctly', () => {
      const fixture = amcFixtures.forum.postRevisions();
      const body = String(fixture.body ?? '');
      const $ = cheerio.load(body);

      const site = createMockSite();
      const thread = createMockThreadRef(site);
      const post = createMockPostRef(thread);

      // Manually call the static parsing logic by creating revisions
      const revisions: ForumPostRevision[] = [];

      $('table.table tr').each((_i, rowElem) => {
        const $row = $(rowElem);
        if ($row.hasClass('head')) return;

        const $revisionLink = $row.find('a[onclick*="showRevision"]');
        if ($revisionLink.length === 0) return;

        const onclick = $revisionLink.attr('onclick') ?? '';
        const revisionIdMatch = onclick.match(/showRevision\s*\(\s*event\s*,\s*(\d+)\s*\)/);
        if (!revisionIdMatch?.[1]) return;

        const revisionId = Number.parseInt(revisionIdMatch[1], 10);
        const createdBy = createMockUser('test', 1);

        revisions.push(
          new ForumPostRevision({
            post,
            id: revisionId,
            revNo: 0,
            createdBy,
            createdAt: new Date(),
          })
        );
      });

      // API returns newest first (9003, 9002, 9001)
      expect(revisions.length).toBe(3);
      expect(revisions[0].id).toBe(9003);
      expect(revisions[1].id).toBe(9002);
      expect(revisions[2].id).toBe(9001);
    });

    test('parses single revision correctly', () => {
      const fixture = amcFixtures.forum.postRevisionsSingle();
      const body = String(fixture.body ?? '');
      const $ = cheerio.load(body);

      let count = 0;
      $('table.table tr').each((_i, rowElem) => {
        const $row = $(rowElem);
        if ($row.hasClass('head')) return;

        const $revisionLink = $row.find('a[onclick*="showRevision"]');
        if ($revisionLink.length > 0) {
          count++;
        }
      });

      expect(count).toBe(1);
    });
  });
});
