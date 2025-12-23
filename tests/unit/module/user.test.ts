/**
 * Userモジュールのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import type { ClientRef } from '../../../src/module/types';
import { AnonymousUser } from '../../../src/module/user/anonymous-user';
import { DeletedUser } from '../../../src/module/user/deleted-user';
import { GuestUser } from '../../../src/module/user/guest-user';
import { User } from '../../../src/module/user/user';
import { WikidotUser } from '../../../src/module/user/wikidot-user';

/**
 * モッククライアント作成
 */
function createMockClient(): ClientRef {
  return {
    requireLogin: () => ({ isErr: () => false }),
    isLoggedIn: () => false,
  };
}

describe('Userデータクラス', () => {
  describe('User', () => {
    test('toString()が正しい文字列を返す', () => {
      const client = createMockClient();
      const user = new User(client, {
        id: 12345,
        name: 'test-user',
        unixName: 'test-user',
        avatarUrl: 'http://example.com/avatar.png',
      });

      const result = user.toString();

      expect(result).toContain('User(');
      expect(result).toContain('id=12345');
      expect(result).toContain('name=test-user');
    });

    test('userTypeが"user"である', () => {
      const client = createMockClient();
      const user = new User(client, {
        id: 12345,
        name: 'test-user',
        unixName: 'test-user',
      });

      expect(user.userType).toBe('user');
    });

    test('isUser()がtrueを返す', () => {
      const client = createMockClient();
      const user = new User(client, {
        id: 12345,
        name: 'test-user',
        unixName: 'test-user',
      });

      expect(user.isUser()).toBe(true);
      expect(user.isDeletedUser()).toBe(false);
      expect(user.isAnonymousUser()).toBe(false);
      expect(user.isGuestUser()).toBe(false);
      expect(user.isWikidotUser()).toBe(false);
    });

    test('avatarUrlが設定される', () => {
      const client = createMockClient();
      const user = new User(client, {
        id: 12345,
        name: 'test-user',
        unixName: 'test-user',
        avatarUrl: 'http://example.com/avatar.png',
      });

      expect(user.avatarUrl).toBe('http://example.com/avatar.png');
    });

    test('avatarUrlが未指定の場合デフォルト値が設定される', () => {
      const client = createMockClient();
      const user = new User(client, {
        id: 12345,
        name: 'test-user',
        unixName: 'test-user',
      });

      expect(user.avatarUrl).toBe('https://www.wikidot.com/avatar.php?userid=12345');
    });
  });

  describe('DeletedUser', () => {
    test('デフォルト値が正しい', () => {
      const client = createMockClient();
      const user = new DeletedUser(client, 99999);

      expect(user.name).toBe('account deleted');
      expect(user.unixName).toBe('account_deleted');
      expect(user.avatarUrl).toBeNull();
      expect(user.ip).toBeNull();
    });

    test('userTypeが"deleted"である', () => {
      const client = createMockClient();
      const user = new DeletedUser(client, 99999);

      expect(user.userType).toBe('deleted');
    });

    test('isDeletedUser()がtrueを返す', () => {
      const client = createMockClient();
      const user = new DeletedUser(client, 99999);

      expect(user.isUser()).toBe(false);
      expect(user.isDeletedUser()).toBe(true);
      expect(user.isAnonymousUser()).toBe(false);
      expect(user.isGuestUser()).toBe(false);
      expect(user.isWikidotUser()).toBe(false);
    });

    test('toString()が正しい文字列を返す', () => {
      const client = createMockClient();
      const user = new DeletedUser(client, 99999);

      const result = user.toString();

      expect(result).toContain('DeletedUser(');
      expect(result).toContain('id=99999');
    });
  });

  describe('AnonymousUser', () => {
    test('デフォルト値が正しい', () => {
      const client = createMockClient();
      const user = new AnonymousUser(client, '192.168.1.1');

      expect(user.name).toBe('Anonymous');
      expect(user.unixName).toBe('anonymous');
      expect(user.id).toBe(0);
      expect(user.avatarUrl).toBeNull();
      expect(user.ip).toBe('192.168.1.1');
    });

    test('userTypeが"anonymous"である', () => {
      const client = createMockClient();
      const user = new AnonymousUser(client, '192.168.1.1');

      expect(user.userType).toBe('anonymous');
    });

    test('isAnonymousUser()がtrueを返す', () => {
      const client = createMockClient();
      const user = new AnonymousUser(client, '192.168.1.1');

      expect(user.isUser()).toBe(false);
      expect(user.isDeletedUser()).toBe(false);
      expect(user.isAnonymousUser()).toBe(true);
      expect(user.isGuestUser()).toBe(false);
      expect(user.isWikidotUser()).toBe(false);
    });

    test('toString()が正しい文字列を返す', () => {
      const client = createMockClient();
      const user = new AnonymousUser(client, '192.168.1.1');

      const result = user.toString();

      expect(result).toContain('AnonymousUser(');
      expect(result).toContain('ip=192.168.1.1');
    });
  });

  describe('GuestUser', () => {
    test('デフォルト値が正しい', () => {
      const client = createMockClient();
      const user = new GuestUser(client, 'Guest Name', 'http://gravatar.com/avatar/abc');

      expect(user.name).toBe('Guest Name');
      expect(user.id).toBe(0);
      expect(user.unixName).toBeNull();
      expect(user.avatarUrl).toBe('http://gravatar.com/avatar/abc');
      expect(user.ip).toBeNull();
    });

    test('userTypeが"guest"である', () => {
      const client = createMockClient();
      const user = new GuestUser(client, 'Guest Name', 'http://gravatar.com/avatar/abc');

      expect(user.userType).toBe('guest');
    });

    test('isGuestUser()がtrueを返す', () => {
      const client = createMockClient();
      const user = new GuestUser(client, 'Guest Name', 'http://gravatar.com/avatar/abc');

      expect(user.isUser()).toBe(false);
      expect(user.isDeletedUser()).toBe(false);
      expect(user.isAnonymousUser()).toBe(false);
      expect(user.isGuestUser()).toBe(true);
      expect(user.isWikidotUser()).toBe(false);
    });

    test('toString()が正しい文字列を返す', () => {
      const client = createMockClient();
      const user = new GuestUser(client, 'Guest Name', 'http://gravatar.com/avatar/abc');

      const result = user.toString();

      expect(result).toContain('GuestUser(');
      expect(result).toContain('name=Guest Name');
    });
  });

  describe('WikidotUser', () => {
    test('デフォルト値が正しい', () => {
      const client = createMockClient();
      const user = new WikidotUser(client);

      expect(user.name).toBe('Wikidot');
      expect(user.unixName).toBe('wikidot');
      expect(user.id).toBe(0);
      expect(user.avatarUrl).toBeNull();
      expect(user.ip).toBeNull();
    });

    test('userTypeが"wikidot"である', () => {
      const client = createMockClient();
      const user = new WikidotUser(client);

      expect(user.userType).toBe('wikidot');
    });

    test('isWikidotUser()がtrueを返す', () => {
      const client = createMockClient();
      const user = new WikidotUser(client);

      expect(user.isUser()).toBe(false);
      expect(user.isDeletedUser()).toBe(false);
      expect(user.isAnonymousUser()).toBe(false);
      expect(user.isGuestUser()).toBe(false);
      expect(user.isWikidotUser()).toBe(true);
    });

    test('toString()が正しい文字列を返す', () => {
      const client = createMockClient();
      const user = new WikidotUser(client);

      const result = user.toString();

      expect(result).toContain('WikidotUser(');
    });
  });
});
