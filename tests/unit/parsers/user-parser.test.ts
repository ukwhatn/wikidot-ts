/**
 * ユーザーパーサーのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import * as cheerio from 'cheerio';
import type { Client } from '../../../src/module/client';
import { AnonymousUser, DeletedUser, GuestUser, User, WikidotUser } from '../../../src/module/user';
import { parseUser } from '../../../src/util/parser';

/**
 * モッククライアントを作成
 */
function createMockClient(): Client {
  return {
    isLoggedIn: () => false,
    requireLogin: () => ({ isErr: () => true, error: new Error('Not logged in') }),
  } as unknown as Client;
}

describe('parseUser', () => {
  const client = createMockClient();

  describe('通常ユーザー', () => {
    test('通常ユーザーをパースできる', () => {
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

    test('ユーザーIDをonclickから抽出できる', () => {
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

  describe('削除済みユーザー', () => {
    test('削除済みユーザーをパースできる', () => {
      const html = `
        <span class="printuser deleted" data-id="123456">(account deleted)</span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(DeletedUser);
      expect((result as DeletedUser).id).toBe(123456);
    });

    test('IDなし削除済みユーザーをパースできる', () => {
      const html = `
        <span class="printuser deleted">(account deleted)</span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(DeletedUser);
      expect((result as DeletedUser).id).toBe(0);
    });

    test('テキストが (user deleted) の場合はDeletedUserを返す', () => {
      const html = `
        <span class="printuser">(user deleted)</span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(DeletedUser);
    });
  });

  describe('匿名ユーザー', () => {
    test('匿名ユーザーをパースできる', () => {
      const html = `
        <span class="printuser anonymous">Anonymous <span class="ip">(192.168.1.1)</span></span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(AnonymousUser);
      expect((result as AnonymousUser).ip).toBe('192.168.1.1');
    });

    test('IPなし匿名ユーザーをパースできる', () => {
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

  describe('ゲストユーザー', () => {
    test('ゲストユーザーをパースできる', () => {
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

  describe('Wikidotユーザー', () => {
    test('Wikidotシステムユーザーをパースできる', () => {
      const html = `
        <span class="printuser">Wikidot</span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(WikidotUser);
    });
  });

  describe('エッジケース', () => {
    test('リンクがない場合はDeletedUserを返す', () => {
      const html = `
        <span class="printuser">Some Unknown User</span>
      `;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(DeletedUser);
    });

    test('空の要素はDeletedUserを返す', () => {
      const html = `<span class="printuser"></span>`;
      const $ = cheerio.load(html);
      const elem = $('span.printuser');

      const result = parseUser(client, elem);

      expect(result).toBeInstanceOf(DeletedUser);
    });
  });
});
