/**
 * Page module P3 method unit tests (rename extensions, attribute
 * operations, template source, openEditor)
 */
import { describe, expect, test } from 'bun:test';
import { errAsync, okAsync } from 'neverthrow';
import { TargetError, UnexpectedError } from '../../../src/common/errors';
import type { AMCRequestBody, AMCResponse } from '../../../src/connector';
import { Page, type PageData } from '../../../src/module/page/page';
import { PageEditSession } from '../../../src/module/page/page-edit-session';
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

describe('Page.openEditor', () => {
  test('returns an unopened PageEditSession bound to this page', () => {
    const { site } = createMockSite(queuedResponses([]));
    const page = createTestPage(site);

    const session = page.openEditor();

    expect(session).toBeInstanceOf(PageEditSession);
    expect(session.isOpen).toBe(false);
    expect(session.fullname).toBe(page.fullname);
    expect(session.pageId).toBe(page.id);
  });
});

describe('Page.getTemplateSource', () => {
  test('returns the body', async () => {
    const { site } = createMockSite(queuedResponses([{ status: 'ok', body: 'template source' }]));
    const page = createTestPage(site);

    const result = await page.getTemplateSource();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe('template source');
  });
});

describe('Page meta tags with allPages', () => {
  test('setMeta omits allPages by default', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createTestPage(site);

    await page.setMeta('og:title', 'Title');

    expect(calls[0]?.[0]?.allPages).toBeUndefined();
  });

  test('setMeta sends allPages=true when requested', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createTestPage(site);

    await page.setMeta('og:title', 'Title', { allPages: true });

    expect(calls[0]?.[0]?.allPages).toBe('true');
  });

  test('deleteMeta sends allPages=true when requested', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createTestPage(site);

    await page.deleteMeta('og:title', { allPages: true });

    expect(calls[0]?.[0]?.allPages).toBe('true');
  });
});

describe('Page block', () => {
  test('getBlockForm returns the body', async () => {
    const { site } = createMockSite(queuedResponses([{ status: 'ok', body: '<form></form>' }]));
    const page = createTestPage(site);

    const result = await page.getBlockForm();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe('<form></form>');
  });

  test('setBlock(true) sends block=true', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createTestPage(site);

    await page.setBlock(true);

    expect(calls[0]?.[0]?.block).toBe('true');
  });

  test('setBlock(false) omits the block key', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createTestPage(site);

    await page.setBlock(false);

    expect(calls[0]?.[0]?.block).toBeUndefined();
  });
});

describe('Page backlinks and watch', () => {
  test('getBacklinks returns the body', async () => {
    const { site } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<div>backlinks</div>' }])
    );
    const page = createTestPage(site);

    const result = await page.getBacklinks();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe('<div>backlinks</div>');
  });

  test('watch sends WatchAction/watchPage', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createTestPage(site);

    await page.watch();

    expect(calls[0]?.[0]?.action).toBe('WatchAction');
    expect(calls[0]?.[0]?.event).toBe('watchPage');
  });

  test('getWatchers returns the body', async () => {
    const { site } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<div>watchers</div>' }])
    );
    const page = createTestPage(site);

    const result = await page.getWatchers();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe('<div>watchers</div>');
  });
});

describe('Page tags and parent forms', () => {
  test('getTagsForm returns the body', async () => {
    const { site } = createMockSite(queuedResponses([{ status: 'ok', body: '<form></form>' }]));
    const page = createTestPage(site);

    const result = await page.getTagsForm();

    expect(result.isOk()).toBe(true);
  });

  test('updateTagsByButton sends the tags string', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createTestPage(site);

    await page.updateTagsByButton('scp euclid');

    expect(calls[0]?.[0]?.event).toBe('updateTagsByButton');
    expect(calls[0]?.[0]?.tags).toBe('scp euclid');
  });

  test('getParentForm returns the body', async () => {
    const { site } = createMockSite(queuedResponses([{ status: 'ok', body: '<form></form>' }]));
    const page = createTestPage(site);

    const result = await page.getParentForm();

    expect(result.isOk()).toBe(true);
  });
});

describe('Page.rename extensions', () => {
  test('getRenameBacklinks returns the body', async () => {
    const { site } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<div>backlinks</div>' }])
    );
    const page = createTestPage(site);

    const result = await page.getRenameBacklinks();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe('<div>backlinks</div>');
  });

  test('sends fixdeps as a comma-joined string', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createTestPage(site);

    await page.rename('new-name', { fixdeps: [1, 2, 3] });

    expect(calls[0]?.[0]?.fixdeps).toBe('1,2,3');
  });

  test('sends force=yes when requested', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createTestPage(site);

    await page.rename('new-name', { force: true });

    expect(calls[0]?.[0]?.force).toBe('yes');
  });

  test('returns TargetError when locks is present, without mutating fullname', async () => {
    const { site } = createMockSite(
      queuedResponses([{ status: 'ok', locks: true, body: '<div>locked</div>' }])
    );
    const page = createTestPage(site);
    const originalFullname = page.fullname;

    const result = await page.rename('new-name');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(TargetError);
    }
    expect(page.fullname).toBe(originalFullname);
  });

  test('returns TargetError when leftDeps is present', async () => {
    const { site } = createMockSite(
      queuedResponses([{ status: 'ok', leftDeps: true, newName: 'new-name' }])
    );
    const page = createTestPage(site);

    const result = await page.rename('new-name');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(TargetError);
    }
  });

  test('updates fullname/category/name on success', async () => {
    const { site } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createTestPage(site);

    const result = await page.rename('component:new-name');

    expect(result.isOk()).toBe(true);
    expect(page.fullname).toBe('component:new-name');
    expect(page.category).toBe('component');
    expect(page.name).toBe('new-name');
  });
});
