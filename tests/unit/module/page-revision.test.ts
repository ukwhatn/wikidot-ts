/**
 * PageRevisionモジュールのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import type { Page } from '../../../src/module/page/page';
import { PageRevision, PageRevisionCollection } from '../../../src/module/page/page-revision';
import type { SiteRef } from '../../../src/module/types';
import { User } from '../../../src/module/user/user';
import { MockAMCClient } from '../../mocks/amc-client.mock';
import { TEST_SITE_DATA } from '../../setup';

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
 * テスト用ページモック作成
 */
function createMockPage(): Page {
  return {
    fullname: 'test-page',
    name: 'test-page',
    title: 'Test Page',
    site: createMockSite(),
  } as unknown as Page;
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

/**
 * テスト用リビジョン作成
 */
function createTestRevision(
  options: {
    id?: number;
    revNo?: number;
    comment?: string;
    page?: Page;
  } = {}
): PageRevision {
  const page = options.page ?? createMockPage();
  const createdBy = createMockUser('RevisionAuthor');
  return new PageRevision({
    page,
    id: options.id ?? 100001,
    revNo: options.revNo ?? 1,
    createdBy,
    createdAt: new Date(),
    comment: options.comment ?? 'Initial revision',
  });
}

describe('PageRevisionデータクラス', () => {
  describe('基本プロパティ', () => {
    test('toString()が正しい文字列を返す', () => {
      const revision = createTestRevision();

      const result = revision.toString();

      expect(result).toContain('PageRevision(');
      expect(result).toContain('id=100001');
      expect(result).toContain('revNo=1');
    });

    test('idが正しく設定される', () => {
      const revision = createTestRevision({ id: 999999 });

      expect(revision.id).toBe(999999);
    });

    test('revNoが正しく設定される', () => {
      const revision = createTestRevision({ revNo: 5 });

      expect(revision.revNo).toBe(5);
    });

    test('commentが正しく設定される', () => {
      const revision = createTestRevision({ comment: 'Updated content' });

      expect(revision.comment).toBe('Updated content');
    });

    test('createdByが設定される', () => {
      const revision = createTestRevision();

      expect(revision.createdBy).toBeDefined();
      expect(revision.createdBy.name).toBe('RevisionAuthor');
    });

    test('createdAtが設定される', () => {
      const revision = createTestRevision();

      expect(revision.createdAt).toBeInstanceOf(Date);
    });
  });
});

describe('PageRevisionCollection', () => {
  test('空のコレクションを作成できる', () => {
    const page = createMockPage();
    const collection = new PageRevisionCollection(page);

    expect(collection.length).toBe(0);
  });

  test('リビジョンを追加できる', () => {
    const page = createMockPage();
    const collection = new PageRevisionCollection(page);
    const revision = createTestRevision({ page });

    collection.push(revision);

    expect(collection.length).toBe(1);
    expect(collection[0]).toBe(revision);
  });

  test('複数リビジョンで初期化できる', () => {
    const page = createMockPage();
    const revisions = [
      createTestRevision({ revNo: 1, page }),
      createTestRevision({ revNo: 2, page }),
      createTestRevision({ revNo: 3, page }),
    ];
    const collection = new PageRevisionCollection(page, revisions);

    expect(collection.length).toBe(3);
  });

  test('nullページでも作成できる', () => {
    const collection = new PageRevisionCollection(null);

    expect(collection.length).toBe(0);
    expect(collection.page).toBeNull();
  });
});
