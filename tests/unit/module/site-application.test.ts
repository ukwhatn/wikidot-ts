/**
 * SiteApplication module unit tests
 */
import { describe, expect, test } from 'bun:test';
import { SiteApplication } from '../../../src/module/site/site-application';
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
 * Create test application
 */
function createTestApplication(options: { user?: User; text?: string } = {}): SiteApplication {
  const site = createMockSite();
  const user = options.user ?? createMockUser('Applicant');
  return new SiteApplication({
    site: site as unknown as Parameters<typeof SiteApplication.prototype.constructor>[0]['site'],
    user,
    text: options.text ?? 'I would like to join this site.',
  });
}

describe('SiteApplication data class', () => {
  describe('Basic properties', () => {
    test('toString() returns correct string', () => {
      const application = createTestApplication();

      const result = application.toString();

      expect(result).toContain('SiteApplication(');
      expect(result).toContain('user=Applicant');
    });

    test('user is correctly set', () => {
      const user = createMockUser('CustomApplicant');
      const application = createTestApplication({ user });

      expect(application.user.name).toBe('CustomApplicant');
    });

    test('text is correctly set', () => {
      const application = createTestApplication({ text: 'Custom application text' });

      expect(application.text).toBe('Custom application text');
    });

    test('site is correctly set', () => {
      const application = createTestApplication();

      expect(application.site.unixName).toBe(TEST_SITE_DATA.unixName);
    });
  });
});
