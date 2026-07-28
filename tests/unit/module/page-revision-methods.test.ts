/**
 * PageRevisionCollection / PageRevision P3 method unit tests
 * (getDiff, acquire with filtering, revert)
 */
import { describe, expect, test } from 'bun:test';
import { errAsync, okAsync } from 'neverthrow';
import { UnexpectedError } from '../../../src/common/errors';
import type { AMCRequestBody, AMCResponse } from '../../../src/connector';
import { Page, type PageData } from '../../../src/module/page/page';
import { PageRevision, PageRevisionCollection } from '../../../src/module/page/page-revision';
import type { Site } from '../../../src/module/site';
import { TEST_PAGE_DATA, TEST_SITE_DATA } from '../../setup';

type AmcRequestHandler = (bodies: AMCRequestBody[]) => ReturnType<Site['amcRequest']>;

function createMockSite(handler: AmcRequestHandler): { site: Site; calls: AMCRequestBody[][] } {
  const calls: AMCRequestBody[][] = [];
  const site = {
    id: TEST_SITE_DATA.id,
    unixName: TEST_SITE_DATA.unixName,
    domain: TEST_SITE_DATA.domain,
    sslSupported: TEST_SITE_DATA.sslSupported,
    client: {
      requireLogin: () => ({ isErr: () => false }),
    },
    amcRequest: (bodies: AMCRequestBody[]) => {
      calls.push(bodies);
      return handler(bodies);
    },
  } as unknown as Site;
  return { site, calls };
}

function queuedResponses(responses: AMCResponse[]): AmcRequestHandler {
  let callIndex = 0;
  return () => {
    const response = responses[callIndex];
    callIndex++;
    if (!response) {
      return errAsync(new UnexpectedError('No more mock responses queued'));
    }
    return okAsync([response]);
  };
}

function createTestPage(site: Site, id = 12345): Page {
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
  page.id = id;
  return page;
}

describe('PageRevisionCollection.getDiff', () => {
  test('returns the body and sends the expected params', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<div>diff</div>' }])
    );
    const page = createTestPage(site);

    const result = await PageRevisionCollection.getDiff(page, 1, 2);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe('<div>diff</div>');
    expect(calls[0]?.[0]?.moduleName).toBe('history/PageDiffModule');
    expect(calls[0]?.[0]?.from_revision_id).toBe(1);
    expect(calls[0]?.[0]?.to_revision_id).toBe(2);
    expect(calls[0]?.[0]?.show_type).toBe('inline');
  });
});

describe('PageRevisionCollection.acquire', () => {
  test('defaults options to {all: true}', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<table class="page-history"></table>' }])
    );
    const page = createTestPage(site);

    const result = await PageRevisionCollection.acquire(page);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.length).toBe(0);
    expect(JSON.parse(String(calls[0]?.[0]?.options))).toEqual({ all: true });
    expect(calls[0]?.[0]?.perpage).toBe(20);
    expect(calls[0]?.[0]?.page).toBe(1);
  });

  test('sends the requested filter options', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<table class="page-history"></table>' }])
    );
    const page = createTestPage(site);

    await PageRevisionCollection.acquire(page, {
      options: { tags: true, move: true },
      perpage: 50,
      pageNo: 2,
    });

    expect(JSON.parse(String(calls[0]?.[0]?.options))).toEqual({ tags: true, move: true });
    expect(calls[0]?.[0]?.perpage).toBe(50);
    expect(calls[0]?.[0]?.page).toBe(2);
  });

  test('parses revision rows', async () => {
    const printuserHtml =
      '<span class="printuser avatarhover">' +
      '<a href="http://www.wikidot.com/user:info/test-user" ' +
      'onclick="WIKIDOT.page.listeners.userInfo(12345); return false;">test-user</a>' +
      '</span>';
    const html =
      '<table class="page-history">' +
      '<tr id="revision-row-100">' +
      '<td>3.</td><td></td><td></td><td></td>' +
      `<td>${printuserHtml}</td>` +
      '<td><span class="odate time_1700000000">14 Nov 2023</span></td>' +
      '<td>edit comment</td>' +
      '</tr>' +
      '</table>';
    const { site } = createMockSite(queuedResponses([{ status: 'ok', body: html }]));
    const page = createTestPage(site);

    const result = await PageRevisionCollection.acquire(page);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.length).toBe(1);
      expect(result.value[0]?.id).toBe(100);
      expect(result.value[0]?.revNo).toBe(3);
      expect(result.value[0]?.comment).toBe('edit comment');
    }
  });
});

describe('PageRevision.revert', () => {
  test('sends the expected params without force', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createTestPage(site);
    const revision = new PageRevision({
      page,
      id: 500,
      revNo: 5,
      createdBy: null as unknown as PageRevision['createdBy'],
      createdAt: new Date(),
      comment: 'c',
    });

    const result = await revision.revert();

    expect(result.isOk()).toBe(true);
    expect(calls[0]?.[0]?.action).toBe('WikiPageAction');
    expect(calls[0]?.[0]?.event).toBe('revert');
    expect(calls[0]?.[0]?.pageId).toBe(page.id);
    expect(calls[0]?.[0]?.revisionId).toBe(500);
    expect(calls[0]?.[0]?.force).toBeUndefined();
  });

  test('sends force=yes when requested', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createTestPage(site);
    const revision = new PageRevision({
      page,
      id: 500,
      revNo: 5,
      createdBy: null as unknown as PageRevision['createdBy'],
      createdAt: new Date(),
      comment: 'c',
    });

    await revision.revert({ force: true });

    expect(calls[0]?.[0]?.force).toBe('yes');
  });

  test('does not swallow a locks response, returns it to the caller', async () => {
    const { site } = createMockSite(
      queuedResponses([{ status: 'ok', locks: true, body: '<div>locked</div>' }])
    );
    const page = createTestPage(site);
    const revision = new PageRevision({
      page,
      id: 500,
      revNo: 5,
      createdBy: null as unknown as PageRevision['createdBy'],
      createdAt: new Date(),
      comment: 'c',
    });

    const result = await revision.revert();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.locks).toBe(true);
      expect(result.value.body).toBe('<div>locked</div>');
    }
  });
});
