/**
 * DashboardSites module unit tests (client.site: create/list/invitations/resign)
 */
import { describe, expect, test } from 'bun:test';
import type { Client } from '../../../src/module/client';
import { DashboardSites } from '../../../src/module/dashboard-site/dashboard-site';
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

describe('DashboardSites.listHtml', () => {
  test('returns raw body', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'dashboard/sites/DSListModule'
        ? createOkResponse("<div class='data'>...</div>")
        : createOkResponse()
    );
    const client = createMockClient(mockAmc);

    const result = await DashboardSites.listHtml(client);

    expect(result.isOk() && result.value).toBe("<div class='data'>...</div>");
  });
});
