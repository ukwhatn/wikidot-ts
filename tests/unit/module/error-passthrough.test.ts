/**
 * Page / forum operations return the WikidotError raised by the AMC layer
 * unchanged, so callers can read e.g. WikidotStatusError.statusCode ('need_captcha')
 */
import { describe, expect, test } from 'bun:test';
import { errAsync } from 'neverthrow';
import { WikidotStatusError } from '../../../src/common/errors';
import type { AMCRequestBody } from '../../../src/connector';
import { ForumPost } from '../../../src/module/forum/forum-post';
import { ForumThread } from '../../../src/module/forum/forum-thread';
import { Page, type PageData } from '../../../src/module/page/page';
import type { Site } from '../../../src/module/site';
import { TEST_PAGE_DATA, TEST_SITE_DATA } from '../../setup';

const captchaError = () =>
  new WikidotStatusError('AMC responded with error status: "need_captcha"', 'need_captcha');

function createMockSite(
  handler: (bodies: AMCRequestBody[]) => ReturnType<Site['amcRequest']>
): Site {
  return {
    id: TEST_SITE_DATA.id,
    unixName: TEST_SITE_DATA.unixName,
    domain: TEST_SITE_DATA.domain,
    sslSupported: TEST_SITE_DATA.sslSupported,
    client: {
      requireLogin: () => ({ isErr: () => false }),
      isLoggedIn: () => true,
    },
    amcRequest: handler,
    amcRequestWithRetry: handler,
  } as unknown as Site;
}

function createTestPage(site: Site): Page {
  const page = new Page({
    site,
    fullname: TEST_PAGE_DATA.fullname,
    name: TEST_PAGE_DATA.name,
    category: TEST_PAGE_DATA.category,
    title: TEST_PAGE_DATA.title,
    childrenCount: TEST_PAGE_DATA.childrenCount,
    commentsCount: TEST_PAGE_DATA.commentsCount,
    size: TEST_PAGE_DATA.size,
    rating: TEST_PAGE_DATA.rating,
    votesCount: TEST_PAGE_DATA.votesCount,
    ratingPercent: TEST_PAGE_DATA.ratingPercent,
    revisionsCount: TEST_PAGE_DATA.revisionsCount,
    parentFullname: TEST_PAGE_DATA.parentFullname,
    tags: [...TEST_PAGE_DATA.tags],
    createdBy: null,
    createdAt: new Date(),
    updatedBy: null,
    updatedAt: new Date(),
    commentedBy: null,
    commentedAt: null,
  } satisfies PageData);
  page.id = 12345;
  return page;
}

function createTestThread(site: Site): ForumThread {
  return new ForumThread({
    site,
    id: 777,
    title: 't',
    description: '',
    postCount: 1,
    createdBy: null,
    createdAt: new Date(),
  });
}

async function expectPassedThrough(
  run: (site: Site) => PromiseLike<{ isErr(): boolean; error?: unknown }>
): Promise<void> {
  const error = captchaError();
  const result = (await run(createMockSite(() => errAsync(error)))) as {
    isErr(): boolean;
    error: unknown;
  };
  expect(result.isErr()).toBe(true);
  expect(result.error).toBe(error);
}

describe('page operations pass Wikidot errors through', () => {
  test('destroy', () => expectPassedThrough((site) => createTestPage(site).destroy()));
  test('commitTags', () => expectPassedThrough((site) => createTestPage(site).commitTags()));
  test('rename', () => expectPassedThrough((site) => createTestPage(site).rename('deleted:x')));
  test('edit', () =>
    expectPassedThrough((site) => createTestPage(site).edit({ source: 'body', title: 't' })));
  test('setMeta', () => expectPassedThrough((site) => createTestPage(site).setMeta('title', 'x')));
  test('getRevisions', () => expectPassedThrough((site) => createTestPage(site).getRevisions()));
  test('getVotes', () => expectPassedThrough((site) => createTestPage(site).getVotes()));
  test('getDiscussion', () => expectPassedThrough((site) => createTestPage(site).getDiscussion()));
});

describe('forum operations pass Wikidot errors through', () => {
  test('ForumThread.reply', () =>
    expectPassedThrough((site) => createTestThread(site).reply('body')));
  test('ForumThread.createForPage', () =>
    expectPassedThrough((site) => ForumThread.createForPage(site, 12345)));
  test('ForumPost.edit', () =>
    expectPassedThrough((site) =>
      new ForumPost({
        thread: createTestThread(site),
        id: 888,
        title: '',
        text: '',
        element: { type: 'tag', name: 'div' } as unknown as ConstructorParameters<
          typeof ForumPost
        >[0]['element'],
        createdBy: null as unknown as ConstructorParameters<typeof ForumPost>[0]['createdBy'],
        createdAt: new Date(),
        editedBy: null,
        editedAt: null,
        parentId: null,
      }).edit('body')
    ));
});
