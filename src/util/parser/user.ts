import type * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { logger } from '../../common/logger';
import type { ClientRef } from '../../module/types';
import type { AbstractUser } from '../../module/user';
import { AnonymousUser, DeletedUser, GuestUser, User, WikidotUser } from '../../module/user';

/**
 * Parse printuser element and return user object
 *
 * @param client - Wikidot client
 * @param elem - Element to parse (element with printuser class)
 * @returns Parsed user object
 */
export function parseUser(client: ClientRef, elem: cheerio.Cheerio<AnyNode>): AbstractUser {
  const classAttr = elem.attr('class') ?? '';
  const classes = classAttr.split(/\s+/);

  // Check for deleted user
  if (classes.includes('deleted')) {
    const dataId = elem.attr('data-id');
    const userId = dataId ? Number.parseInt(dataId, 10) : 0;
    return new DeletedUser(client, userId);
  }

  // If text is "(user deleted)"
  const text = elem.text().trim();
  if (text === '(user deleted)') {
    return new DeletedUser(client, 0);
  }

  // Check for anonymous user
  if (classes.includes('anonymous')) {
    const ipElem = elem.find('span.ip');
    if (ipElem.length > 0) {
      const ip = ipElem.text().replace(/[()]/g, '').trim();
      return new AnonymousUser(client, ip);
    }
    return new AnonymousUser(client, '');
  }

  // Check for guest user (has Gravatar avatar)
  const imgElem = elem.find('img');
  if (imgElem.length > 0) {
    const src = imgElem.attr('src') ?? '';
    if (src.includes('gravatar.com')) {
      const guestName = text.split(' ')[0] ?? 'Guest';
      return new GuestUser(client, guestName, src);
    }
  }

  // Check for Wikidot system user
  if (text === 'Wikidot') {
    return new WikidotUser(client);
  }

  // Regular user
  const links = elem.find('a');
  if (links.length === 0) {
    // Treat as DeletedUser if no link
    return new DeletedUser(client, 0);
  }

  // Last link is the user link
  const userLink = links.last();
  const userName = userLink.text().trim();
  const href = userLink.attr('href') ?? '';
  const onclick = userLink.attr('onclick') ?? '';

  // Extract unix_name from href
  const unixName = href.replace(/^.*\/user:info\//, '').replace(/\/$/, '');

  // Extract user_id from onclick
  // Pattern: "WIKIDOT.page.listeners.userInfo(123456); return false;"
  const userIdMatch = onclick.match(/userInfo\((\d+)\)/);
  const userId = userIdMatch?.[1] ? Number.parseInt(userIdMatch[1], 10) : 0;

  // Generate avatar URL
  const avatarUrl = userId > 0 ? `http://www.wikidot.com/avatar.php?userid=${userId}` : undefined;

  return new User(client, {
    id: userId,
    name: userName,
    unixName,
    avatarUrl,
  });
}

/**
 * Parse date from odate element
 *
 * @param elem - Element to parse (odate element)
 * @returns Parsed Date, or null on parse failure
 */
export function parseOdate(elem: cheerio.Cheerio<AnyNode>): Date | null {
  const classAttr = elem.attr('class') ?? '';

  // Extract Unix timestamp from class
  // Pattern: "odate time_1234567890 format_..." format
  const timeMatch = classAttr.match(/time_(\d+)/);
  if (timeMatch?.[1]) {
    const unixTime = Number.parseInt(timeMatch[1], 10);
    return new Date(unixTime * 1000);
  }

  // Fallback: parse from text
  const text = elem.text().trim();
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }

  // Return null and log warning if parsing fails
  logger.warn(`Failed to parse odate element: class="${classAttr}", text="${text}"`);
  return null;
}
