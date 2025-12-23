/**
 * SiteApplicationモジュールのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import { SiteApplication } from '../../../src/module/site/site-application';
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
 * テスト用申請作成
 */
function createTestApplication(
  options: {
    user?: User;
    text?: string;
  } = {}
): SiteApplication {
  const site = createMockSite();
  const user = options.user ?? createMockUser('Applicant');
  return new SiteApplication({
    site: site as unknown as Parameters<typeof SiteApplication.prototype.constructor>[0]['site'],
    user,
    text: options.text ?? 'I would like to join this site.',
  });
}

describe('SiteApplicationデータクラス', () => {
  describe('基本プロパティ', () => {
    test('toString()が正しい文字列を返す', () => {
      const application = createTestApplication();

      const result = application.toString();

      expect(result).toContain('SiteApplication(');
      expect(result).toContain('user=Applicant');
    });

    test('userが正しく設定される', () => {
      const user = createMockUser('CustomApplicant');
      const application = createTestApplication({ user });

      expect(application.user.name).toBe('CustomApplicant');
    });

    test('textが正しく設定される', () => {
      const application = createTestApplication({ text: 'Custom application text' });

      expect(application.text).toBe('Custom application text');
    });

    test('siteが正しく設定される', () => {
      const application = createTestApplication();

      expect(application.site.unixName).toBe(TEST_SITE_DATA.unixName);
    });
  });
});
