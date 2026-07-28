/**
 * DashboardSites module unit tests (client.site: create/list/invitations/resign)
 */
import { describe, expect, test } from 'bun:test';
import type { Client } from '../../../src/module/client';
import { DashboardSite, DashboardSites } from '../../../src/module/dashboard-site/dashboard-site';
import { createOkResponse, MockAMCClient } from '../../mocks/amc-client.mock';

function createMockClient(mockAmc: MockAMCClient): Client {
  return {
    requireLogin: () => ({ isErr: () => false }),
    isLoggedIn: () => true,
    amcClient: mockAmc,
  } as unknown as Client;
}

describe('DashboardSites.create', () => {
  test('returns siteUnixName on success', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.event === 'createSite'
        ? { ...createOkResponse(), siteUnixName: 'my-new-site' }
        : createOkResponse()
    );
    const client = createMockClient(mockAmc);

    const result = await DashboardSites.create(client, {
      name: 'My Site',
      unixname: 'my-new-site',
    });

    const [body] = mockAmc.getRequestHistory();
    expect(body?.action).toBe('NewSiteAction');
    expect(body?.event).toBe('createSite');
    expect(body?.name).toBe('My Site');
    expect(body?.unixname).toBe('my-new-site');
    expect(body?.tos).toBe('on');
    expect(result.isOk() && result.value).toBe('my-new-site');
  });

  test('tos=false omits the key', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);

    await DashboardSites.create(client, { name: 'X', unixname: 'x', tos: false });

    const [body] = mockAmc.getRequestHistory();
    expect(body && 'tos' in body).toBe(false);
  });
});

describe('DashboardSites invitations/applications', () => {
  test('acceptInvitation sends invitation_id', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);

    await DashboardSites.acceptInvitation(client, 42);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.action).toBe('DashboardSitesAction');
    expect(body?.event).toBe('acceptInvitation');
    expect(body?.invitation_id).toBe(42);
  });

  test('throwAwayInvitation sends invitation_id', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);

    await DashboardSites.throwAwayInvitation(client, 42);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('throwAwayInvitation');
  });

  test('removeApplication sends site_id', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);

    await DashboardSites.removeApplication(client, 7);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('removeApplication');
    expect(body?.site_id).toBe(7);
  });
});

describe('DashboardSites resign/restore', () => {
  test('restoreSite sends site_id and site_name', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);

    await DashboardSites.restoreSite(client, 10, 'my-deleted-site');

    const [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('restoreSite');
    expect(body?.site_id).toBe(10);
    expect(body?.site_name).toBe('my-deleted-site');
  });

  test('resignAsAdmin sends adminResign', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);

    await DashboardSites.resignAsAdmin(client, 10);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('adminResign');
  });

  test('resignAsModerator sends moderatorResign', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);

    await DashboardSites.resignAsModerator(client, 10);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('moderatorResign');
  });

  test('signOffAsMember sends memberSignOff', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);

    await DashboardSites.signOffAsMember(client, 10);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('memberSignOff');
  });

  test('setStorageLimit passes raw fields through', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);

    await DashboardSites.setStorageLimit(client, 10, { limit: '500' });

    const [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('setStorageLimit');
    expect(body?.site_id).toBe(10);
    expect(body?.limit).toBe('500');
  });
});

/**
 * DSListModule row fixture, based on the 2026-07-29 markup measurement recorded
 * in the sibling wikidot.py repo's 70_account.md ("一覧モジュールの行マークアップ")
 */
const DS_LIST_MODULE_BODY = `
<div class="site">
  <a class="thumbnail-site" href="http://foo.wikidot.com">
    <img class="thumbnail-site" src="http://foo.wikidot.com/local--files/favicon/foo.png" />
  </a>
  <div class="name"><a href="http://foo.wikidot.com">Foo Site</a></div>
  <div class="url">http://foo.wikidot.com</div>
  <a class="btn" href="/account/sites#/manage/123456">Manage</a>
  <div class="data">
    <span class="activity">12</span>
    <span class="site-id">123456</span>
    <span class="unix-name">foo</span>
    <span class="tagline">A test site</span>
    <span class="occupation">admin</span>
  </div>
</div>
<div class="site">
  <div class="name"><a href="http://bar.wikidot.com">Bar Site</a></div>
  <div class="url">http://bar.wikidot.com</div>
  <div class="data">
    <span class="activity">0</span>
    <span class="site-id">654321</span>
    <span class="unix-name">bar</span>
    <span class="tagline"></span>
    <span class="occupation">member</span>
    <span class="deleted"></span>
  </div>
</div>
`;

describe('DashboardSite.acquireAll / DashboardSites.listSites', () => {
  test('parses all rows', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'dashboard/sites/DSListModule'
        ? createOkResponse(DS_LIST_MODULE_BODY)
        : createOkResponse()
    );
    const client = createMockClient(mockAmc);

    const result = await DashboardSites.listSites(client);

    expect(result.isOk()).toBe(true);
    expect(result.isOk() && result.value.length).toBe(2);
  });

  test('parses active site fields', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'dashboard/sites/DSListModule'
        ? createOkResponse(DS_LIST_MODULE_BODY)
        : createOkResponse()
    );
    const client = createMockClient(mockAmc);

    const result = await DashboardSites.listSites(client);
    if (!result.isOk()) throw new Error('expected ok');
    const site = result.value[0];

    expect(site).toBeInstanceOf(DashboardSite);
    expect(site?.siteId).toBe(123456);
    expect(site?.title).toBe('Foo Site');
    expect(site?.url).toBe('http://foo.wikidot.com');
    expect(site?.unixName).toBe('foo');
    expect(site?.tagline).toBe('A test site');
    expect(site?.role).toBe('admin');
    expect(site?.deleted).toBe(false);
  });

  test('parses deleted site fields', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'dashboard/sites/DSListModule'
        ? createOkResponse(DS_LIST_MODULE_BODY)
        : createOkResponse()
    );
    const client = createMockClient(mockAmc);

    const result = await DashboardSites.listSites(client);
    if (!result.isOk()) throw new Error('expected ok');
    const site = result.value[1];

    expect(site?.siteId).toBe(654321);
    expect(site?.role).toBe('member');
    expect(site?.deleted).toBe(true);
  });

  test('row actions delegate to DashboardSites', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'dashboard/sites/DSListModule'
        ? createOkResponse(DS_LIST_MODULE_BODY)
        : createOkResponse()
    );
    const client = createMockClient(mockAmc);

    const result = await DashboardSites.listSites(client);
    if (!result.isOk()) throw new Error('expected ok');
    const site = result.value[0];
    mockAmc.clearRequestHistory();

    await site?.resignAsAdmin();

    const [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('adminResign');
    expect(body?.site_id).toBe(123456);
  });
});
