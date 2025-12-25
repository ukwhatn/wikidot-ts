/**
 * User parser unit tests
 */
import { describe, expect, test } from 'bun:test';
import * as cheerio from 'cheerio';
import type { Client } from '../../../src/module/client';
import { AnonymousUser, DeletedUser, GuestUser, User, WikidotUser } from '../../../src/module/user';
import { parseUser } from '../../../src/util/parser';

/**
 * Create mock client
 */
function createMockClient(): Client {
  return {
    isLoggedIn: () => false,
    requireLogin: () => ({ isErr: () => true, error: new Error('Not logged in') }),
  } as unknown as Client;
}

describe('parseUser', () => {
  const client = createMockClient();

  describe('Regular user', () => {
    test('Can parse regular user', () => {
      const html = `
        <span class="printuser avatarhover">
          <a href="http://www.wikidot.com/user:info/test-user" onclick="WIKIDOT.page.listeners.userInfo(123456); return false;">
            <img class="small" src="http://www.wikidot.com/avatar.php?userid=123456&amp;size=small" alt="test-user" />
          </a>
          <a href="http://www.wikidot.com/user:info/test-user" onclick="WIKIDOT.page.listeners.userInfo(123456); return false;">test-user</a>
        </span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(User);
      const user = result as User;
      expect(user.name).toBe('test-user');
      expect(user.id).toBe(123456);
      expect(user.unixName).toBe('test-user');
    });

    test('Can extract user ID from onclick', () => {
      const html = `
        <span class="printuser">
          <a href="http://www.wikidot.com/user:info/another-user" onclick="WIKIDOT.page.listeners.userInfo(789012); return false;">another-user</a>
        </span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(User);
      expect((result as User).id).toBe(789012);
    });
  });

  describe('Deleted user', () => {
    test('Can parse deleted user', () => {
      const html = `
        <span class="printuser deleted" data-id="123456">(account deleted)</span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(DeletedUser);
      expect((result as DeletedUser).id).toBe(123456);
    });

    test('Can parse deleted user without ID', () => {
      const html = `
        <span class="printuser deleted">(account deleted)</span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(DeletedUser);
      expect((result as DeletedUser).id).toBe(0);
    });

    test('Returns DeletedUser when text is (user deleted)', () => {
      const html = `
        <span class="printuser">(user deleted)</span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(DeletedUser);
    });
  });

  describe('Anonymous user', () => {
    test('Can parse anonymous user', () => {
      const html = `
        <span class="printuser anonymous">Anonymous <span class="ip">(192.168.1.1)</span></span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(AnonymousUser);
      expect((result as AnonymousUser).ip).toBe('192.168.1.1');
    });

    test('Can parse anonymous user without IP', () => {
      const html = `
        <span class="printuser anonymous">Anonymous</span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(AnonymousUser);
      expect((result as AnonymousUser).ip).toBe('');
    });
  });

  describe('Guest user', () => {
    test('Can parse guest user', () => {
      const html = `
        <span class="printuser">
          <img class="small" src="http://www.gravatar.com/avatar/abc123?s=16&amp;d=mm" />
          Guest Writer
        </span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(GuestUser);
      expect((result as GuestUser).name).toBe('Guest');
    });
  });

  describe('Wikidot user', () => {
    test('Can parse Wikidot system user', () => {
      const html = `
        <span class="printuser">Wikidot</span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(WikidotUser);
    });
  });

  describe('Edge cases', () => {
    test('Returns DeletedUser when no link exists', () => {
      const html = `
        <span class="printuser">Some Unknown User</span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(DeletedUser);
    });

    test('Returns DeletedUser for empty element', () => {
      const html = `<span class="printuser"></span>`;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(DeletedUser);
    });
  });
});
