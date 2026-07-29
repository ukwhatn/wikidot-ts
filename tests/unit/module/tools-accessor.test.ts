/**
 * ToolsAccessor (Site.tools) unit tests
 */
import { describe, expect, test } from 'bun:test';
import { errAsync, okAsync } from 'neverthrow';
import { UnexpectedError } from '../../../src/common/errors';
import type { AMCRequestBody, AMCResponse } from '../../../src/connector';
import { ToolsAccessor } from '../../../src/module/site/accessors/tools-accessor';
import { Site } from '../../../src/module/site/site';
import { TEST_SITE_DATA } from '../../setup';

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

describe('ToolsAccessor simple views', () => {
  test('getOverview returns the body', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<div>overview</div>' }])
    );
    const tools = new ToolsAccessor(site);

    const result = await tools.getOverview();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe('<div>overview</div>');
    expect(calls[0]?.[0]?.moduleName).toBe('sitetools/SiteToolsModule');
  });

  test('getOrphanedPages returns the body', async () => {
    const { site } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<div>orphaned</div>' }])
    );
    const tools = new ToolsAccessor(site);

    const result = await tools.getOrphanedPages();

    expect(result.isOk()).toBe(true);
  });

  test('getDrafts sends location=sitetools', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<div>drafts</div>' }])
    );
    const tools = new ToolsAccessor(site);

    await tools.getDrafts();

    expect(calls[0]?.[0]?.location).toBe('sitetools');
  });

  test('getCategories returns the body', async () => {
    const { site } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<div>categories</div>' }])
    );
    const tools = new ToolsAccessor(site);

    const result = await tools.getCategories();

    expect(result.isOk()).toBe(true);
  });
});

describe('ToolsAccessor.getWantedPages', () => {
  test('omits page/embed by default', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<div>wanted</div>' }])
    );
    const tools = new ToolsAccessor(site);

    await tools.getWantedPages();

    expect(calls[0]?.[0]?.p).toBeUndefined();
    expect(calls[0]?.[0]?.embed).toBeUndefined();
  });

  test('sends page and embed when specified', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<div>wanted</div>' }])
    );
    const tools = new ToolsAccessor(site);

    await tools.getWantedPages({ page: 2, embed: true });

    expect(calls[0]?.[0]?.p).toBe(2);
    expect(calls[0]?.[0]?.embed).toBe('true');
  });
});

describe('ToolsAccessor.expandCategory', () => {
  test('sends category_id', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<div>pages</div>' }])
    );
    const tools = new ToolsAccessor(site);

    const result = await tools.expandCategory(5);

    expect(result.isOk()).toBe(true);
    expect(calls[0]?.[0]?.category_id).toBe(5);
    expect(calls[0]?.[0]?.includeHidden).toBeUndefined();
  });

  test('sends includeHidden when requested', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<div>pages</div>' }])
    );
    const tools = new ToolsAccessor(site);

    await tools.expandCategory(5, { includeHidden: true });

    expect(calls[0]?.[0]?.includeHidden).toBe('true');
  });
});

describe('ToolsAccessor.getRecentChanges', () => {
  test('defaults options to {all: true} and omits category/page filters', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<div></div>' }])
    );
    const tools = new ToolsAccessor(site);

    const result = await tools.getRecentChanges();

    expect(result.isOk()).toBe(true);
    expect(JSON.parse(String(calls[0]?.[0]?.options))).toEqual({ all: true });
    expect(calls[0]?.[0]?.categoryId).toBeUndefined();
    expect(calls[0]?.[0]?.pageId).toBeUndefined();
  });

  test('sends categoryId and pageId filters', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<div></div>' }])
    );
    const tools = new ToolsAccessor(site);

    await tools.getRecentChanges({ categoryId: 3, pageId: 99 });

    expect(calls[0]?.[0]?.categoryId).toBe(3);
    expect(calls[0]?.[0]?.pageId).toBe(99);
  });

  test('parses changes-list-item rows', async () => {
    const printuserHtml =
      '<span class="printuser avatarhover">' +
      '<a href="http://www.wikidot.com/user:info/test-user" ' +
      'onclick="WIKIDOT.page.listeners.userInfo(12345); return false;">test-user</a>' +
      '</span>';
    const html =
      '<div class="changes-list-item">' +
      '<td class="title"><a href="/component:scp-173">SCP-173</a></td>' +
      '<td class="revision-no">3</td>' +
      `<td class="mod-by">${printuserHtml}</td>` +
      '<td class="mod-date"><span class="odate time_1700000000">14 Nov 2023</span></td>' +
      '<td class="comments">edit note</td>' +
      '<td class="flags"><span>S</span></td>' +
      '</div>';
    const { site } = createMockSite(queuedResponses([{ status: 'ok', body: html }]));
    const tools = new ToolsAccessor(site);

    const result = await tools.getRecentChanges();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.length).toBe(1);
      expect(result.value[0]?.pageFullname).toBe('component:scp-173');
      expect(result.value[0]?.pageTitle).toBe('SCP-173');
      expect(result.value[0]?.revisionNo).toBe(3);
      expect(result.value[0]?.comment).toBe('edit note');
      expect(result.value[0]?.flags).toEqual(['S']);
    }
  });
});

describe('Site.tools accessor', () => {
  test('is lazily instantiated and cached', () => {
    const { site } = createMockSite(queuedResponses([]));
    const realSite = new Site(site.client, {
      id: TEST_SITE_DATA.id,
      title: 'Test Site',
      unixName: TEST_SITE_DATA.unixName,
      domain: TEST_SITE_DATA.domain,
      sslSupported: TEST_SITE_DATA.sslSupported,
    });

    const first = realSite.tools;
    const second = realSite.tools;

    expect(first).toBeInstanceOf(ToolsAccessor);
    expect(first).toBe(second);
  });
});
