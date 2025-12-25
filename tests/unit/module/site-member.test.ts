/**
 * SiteMember module unit tests
 */
import { describe, expect, test } from 'bun:test';
import { SiteMember } from '../../../src/module/site/site-member';
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
 * Create test member
 */
function createTestMember(
  options: { user?: User; joinedAt?: Date; role?: string } = {}
): SiteMember {
  const site = createMockSite();
  const user = options.user ?? createMockUser('TestMember');
  return new SiteMember({
    site: site as unknown as Parameters<typeof SiteMember.prototype.constructor>[0]['site'],
    user,
    joinedAt: options.joinedAt ?? new Date(),
  });
}

describe('SiteMember data class', () => {
  describe('Basic properties', () => {
    test('toString() returns correct string', () => {
      const member = createTestMember();

      const result = member.toString();

      expect(result).toContain('SiteMember(');
      expect(result).toContain('user=TestMember');
    });

    test('user is correctly set', () => {
      const user = createMockUser('CustomUser');
      const member = createTestMember({ user });

      expect(member.user.name).toBe('CustomUser');
    });

    test('joinedAt is correctly set', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const member = createTestMember({ joinedAt: date });

      expect(member.joinedAt).toEqual(date);
    });
  });
});
