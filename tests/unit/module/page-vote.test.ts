/**
 * PageVoteモジュールのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import type { Page } from '../../../src/module/page/page';
import { PageVote, PageVoteCollection } from '../../../src/module/page/page-vote';
import type { ClientRef, SiteRef } from '../../../src/module/types';
import { User } from '../../../src/module/user/user';
import { MockAMCClient } from '../../mocks/amc-client.mock';
import { TEST_SITE_DATA } from '../../setup';

/**
 * モッククライアント作成
 */
function createMockClient(): ClientRef {
  return {
    requireLogin: () => ({ isErr: () => false }),
    isLoggedIn: () => false,
  };
}

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
    client: createMockClient(),
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
  const client = createMockClient();
  return new User(client, {
    id: 12345,
    name,
    unixName: name.toLowerCase().replace(/\s/g, '-'),
  });
}

/**
 * テスト用投票作成
 */
function createTestVote(options: { value?: number; user?: User; page?: Page } = {}): PageVote {
  const user = options.user ?? createMockUser('Voter');
  const page = options.page ?? createMockPage();
  return new PageVote({
    page,
    user,
    value: options.value ?? 1,
  });
}

describe('PageVoteデータクラス', () => {
  describe('基本プロパティ', () => {
    test('toString()が正しい文字列を返す', () => {
      const vote = createTestVote();

      const result = vote.toString();

      expect(result).toContain('PageVote(');
      expect(result).toContain('user=Voter');
      expect(result).toContain('value=1');
    });

    test('valueが正の値の場合', () => {
      const vote = createTestVote({ value: 1 });

      expect(vote.value).toBe(1);
    });

    test('valueが負の値の場合', () => {
      const vote = createTestVote({ value: -1 });

      expect(vote.value).toBe(-1);
    });

    test('userが正しく設定される', () => {
      const user = createMockUser('TestVoter');
      const vote = createTestVote({ user });

      expect(vote.user.name).toBe('TestVoter');
    });
  });
});

describe('PageVoteCollection', () => {
  test('空のコレクションを作成できる', () => {
    const page = createMockPage();
    const collection = new PageVoteCollection(page);

    expect(collection.length).toBe(0);
  });

  test('投票を追加できる', () => {
    const page = createMockPage();
    const collection = new PageVoteCollection(page);
    const vote = createTestVote({ page });

    collection.push(vote);

    expect(collection.length).toBe(1);
    expect(collection[0]).toBe(vote);
  });

  test('複数投票で初期化できる', () => {
    const page = createMockPage();
    const votes = [
      createTestVote({ value: 1, page }),
      createTestVote({ value: -1, page }),
      createTestVote({ value: 1, page }),
    ];
    const collection = new PageVoteCollection(page, votes);

    expect(collection.length).toBe(3);
  });

  test('賛成票をカウントできる', () => {
    const page = createMockPage();
    const votes = [
      createTestVote({ value: 1, page }),
      createTestVote({ value: 1, page }),
      createTestVote({ value: -1, page }),
    ];
    const collection = new PageVoteCollection(page, votes);

    const positiveVotes = collection.filter((v) => v.value > 0);

    expect(positiveVotes.length).toBe(2);
  });

  test('反対票をカウントできる', () => {
    const page = createMockPage();
    const votes = [
      createTestVote({ value: 1, page }),
      createTestVote({ value: -1, page }),
      createTestVote({ value: -1, page }),
    ];
    const collection = new PageVoteCollection(page, votes);

    const negativeVotes = collection.filter((v) => v.value < 0);

    expect(negativeVotes.length).toBe(2);
  });
});
