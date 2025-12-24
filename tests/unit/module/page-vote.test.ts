/**
 * PageVote module unit tests
 */
import { describe, expect, test } from 'bun:test';
import type { Page } from '../../../src/module/page/page';
import { PageVote, PageVoteCollection } from '../../../src/module/page/page-vote';
import type { ClientRef, SiteRef } from '../../../src/module/types';
import { User } from '../../../src/module/user/user';
import { MockAMCClient } from '../../mocks/amc-client.mock';
import { TEST_SITE_DATA } from '../../setup';

/**
 * Create mock client
 */
function createMockClient(): ClientRef {
  return {
    requireLogin: () => ({ isErr: () => false }),
    isLoggedIn: () => false,
  };
}

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
 * Create test page mock
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
 * Create test user
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
 * Create test vote
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

describe('PageVote data class', () => {
  describe('Basic properties', () => {
    test('toString() returns correct string', () => {
      const vote = createTestVote();

      const result = vote.toString();

      expect(result).toContain('PageVote(');
      expect(result).toContain('user=Voter');
      expect(result).toContain('value=1');
    });

    test('Value is positive', () => {
      const vote = createTestVote({ value: 1 });

      expect(vote.value).toBe(1);
    });

    test('Value is negative', () => {
      const vote = createTestVote({ value: -1 });

      expect(vote.value).toBe(-1);
    });

    test('User is correctly set', () => {
      const user = createMockUser('TestVoter');
      const vote = createTestVote({ user });

      expect(vote.user.name).toBe('TestVoter');
    });
  });
});

describe('PageVoteCollection', () => {
  test('Can create empty collection', () => {
    const page = createMockPage();
    const collection = new PageVoteCollection(page);

    expect(collection.length).toBe(0);
  });

  test('Can add vote', () => {
    const page = createMockPage();
    const collection = new PageVoteCollection(page);
    const vote = createTestVote({ page });

    collection.push(vote);

    expect(collection.length).toBe(1);
    expect(collection[0]).toBe(vote);
  });

  test('Can initialize with multiple votes', () => {
    const page = createMockPage();
    const votes = [
      createTestVote({ value: 1, page }),
      createTestVote({ value: -1, page }),
      createTestVote({ value: 1, page }),
    ];
    const collection = new PageVoteCollection(page, votes);

    expect(collection.length).toBe(3);
  });

  test('Can count positive votes', () => {
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

  test('Can count negative votes', () => {
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
