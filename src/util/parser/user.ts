import type * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { logger } from '../../common/logger';
import type { ClientRef } from '../../module/types';
import type { AbstractUser } from '../../module/user';
import { AnonymousUser, DeletedUser, GuestUser, User, WikidotUser } from '../../module/user';

/**
 * printuser要素をパースし、ユーザーオブジェクトを返す
 *
 * @param client - Wikidotクライアント
 * @param elem - パース対象の要素（printuserクラスがついた要素）
 * @returns パースされて得られたユーザーオブジェクト
 */
export function parseUser(client: ClientRef, elem: cheerio.Cheerio<AnyNode>): AbstractUser {
  const classAttr = elem.attr('class') ?? '';
  const classes = classAttr.split(/\s+/);

  // 削除済みユーザー判定
  if (classes.includes('deleted')) {
    const dataId = elem.attr('data-id');
    const userId = dataId ? Number.parseInt(dataId, 10) : 0;
    return new DeletedUser(client, userId);
  }

  // テキストが "(user deleted)" の場合
  const text = elem.text().trim();
  if (text === '(user deleted)') {
    return new DeletedUser(client, 0);
  }

  // 匿名ユーザー判定
  if (classes.includes('anonymous')) {
    const ipElem = elem.find('span.ip');
    if (ipElem.length > 0) {
      const ip = ipElem.text().replace(/[()]/g, '').trim();
      return new AnonymousUser(client, ip);
    }
    return new AnonymousUser(client, '');
  }

  // ゲストユーザー判定（Gravatarアバターを持つ）
  const imgElem = elem.find('img');
  if (imgElem.length > 0) {
    const src = imgElem.attr('src') ?? '';
    if (src.includes('gravatar.com')) {
      const guestName = text.split(' ')[0] ?? 'Guest';
      return new GuestUser(client, guestName, src);
    }
  }

  // Wikidotシステムユーザー判定
  if (text === 'Wikidot') {
    return new WikidotUser(client);
  }

  // 通常ユーザー
  const links = elem.find('a');
  if (links.length === 0) {
    // リンクがない場合はDeletedUserとして扱う
    return new DeletedUser(client, 0);
  }

  // 最後のリンクがユーザーリンク
  const userLink = links.last();
  const userName = userLink.text().trim();
  const href = userLink.attr('href') ?? '';
  const onclick = userLink.attr('onclick') ?? '';

  // unix_nameをhrefから抽出
  const unixName = href.replace(/^.*\/user:info\//, '').replace(/\/$/, '');

  // user_idをonclickから抽出
  // パターン: "WIKIDOT.page.listeners.userInfo(123456); return false;"
  const userIdMatch = onclick.match(/userInfo\((\d+)\)/);
  const userId = userIdMatch?.[1] ? Number.parseInt(userIdMatch[1], 10) : 0;

  // アバターURLを生成
  const avatarUrl = userId > 0 ? `http://www.wikidot.com/avatar.php?userid=${userId}` : undefined;

  return new User(client, {
    id: userId,
    name: userName,
    unixName,
    avatarUrl,
  });
}

/**
 * odate要素から日時をパースする
 *
 * @param elem - パース対象の要素（odate要素）
 * @returns パースされたDate、パース失敗時はnull
 */
export function parseOdate(elem: cheerio.Cheerio<AnyNode>): Date | null {
  const classAttr = elem.attr('class') ?? '';

  // クラスから Unix タイムスタンプを抽出
  // パターン: "odate time_1234567890 format_..." のような形式
  const timeMatch = classAttr.match(/time_(\d+)/);
  if (timeMatch?.[1]) {
    const unixTime = Number.parseInt(timeMatch[1], 10);
    return new Date(unixTime * 1000);
  }

  // フォールバック: テキストからパース
  const text = elem.text().trim();
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }

  // パースできない場合はnullを返却し、警告をログ出力
  logger.warn(`Failed to parse odate element: class="${classAttr}", text="${text}"`);
  return null;
}
