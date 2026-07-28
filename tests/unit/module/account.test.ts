/**
 * Account module unit tests (client.account: settings/profile/recent)
 */
import { describe, expect, test } from 'bun:test';
import {
  AccountProfile,
  AccountRecentActivity,
  AccountSettings,
} from '../../../src/module/account/account';
import type { Client } from '../../../src/module/client';
import { createOkResponse, MockAMCClient } from '../../mocks/amc-client.mock';

function createMockClient(
  mockAmc: MockAMCClient,
  me: { id: number } | null = { id: 99999 }
): Client {
  return {
    requireLogin: () => ({ isErr: () => false }),
    isLoggedIn: () => true,
    amcClient: mockAmc,
    me,
  } as unknown as Client;
}

describe('AccountSettings', () => {
  test('setReceiveMessages sends action/event/from', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);
    const settings = new AccountSettings(client);

    const result = await settings.setReceiveMessages('mf');

    expect(result.isOk()).toBe(true);
    const [body] = mockAmc.getRequestHistory();
    expect(body?.action).toBe('DashboardSettingsAction');
    expect(body?.event).toBe('saveReceiveMessages');
    expect(body?.from).toBe('mf');
  });

  test('blockUser sends userId', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);
    const settings = new AccountSettings(client);

    await settings.blockUser({ id: 123 } as never);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('blockUser');
    expect(body?.userId).toBe(123);
  });

  test('changePassword sends new password twice', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);
    const settings = new AccountSettings(client);

    await settings.changePassword('old-pw', 'new-pw');

    const [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('changePassword');
    expect(body?.old_password).toBe('old-pw');
    expect(body?.new_password1).toBe('new-pw');
    expect(body?.new_password2).toBe('new-pw');
  });

  test('setReceiveDigest(true) sends "yes"', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);
    const settings = new AccountSettings(client);

    await settings.setReceiveDigest(true);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.receive).toBe('yes');
  });

  test('setReceiveDigest(false) omits the key', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);
    const settings = new AccountSettings(client);

    await settings.setReceiveDigest(false);

    const [body] = mockAmc.getRequestHistory();
    expect(body && 'receive' in body).toBe(false);
  });

  test('setReceiveInvitations(true) sends "true" (flag format, not "yes")', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);
    const settings = new AccountSettings(client);

    await settings.setReceiveInvitations(true);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.receive).toBe('true');
  });

  test('setToolbars omits the unset side', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);
    const settings = new AccountSettings(client);

    await settings.setToolbars(true, false);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.toolbarTop).toBe('on');
    expect(body && 'toolbarBottom' in body).toBe(false);
  });

  test('setToolbars uses DashboardSettingsAction, not ManageSiteAction', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);
    const settings = new AccountSettings(client);

    await settings.setToolbars(true, true);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.action).toBe('DashboardSettingsAction');
    expect(body?.event).toBe('saveToolbarsPref');
  });

  test('generateApiKey(readOnly=true) sends type "r" and returns newKey', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.event === 'generateApiKey'
        ? { ...createOkResponse(), newKey: 'abc123' }
        : createOkResponse()
    );
    const client = createMockClient(mockAmc);
    const settings = new AccountSettings(client);

    const result = await settings.generateApiKey(true);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.type).toBe('r');
    expect(result.isOk() && result.value).toBe('abc123');
  });

  test('generateApiKey(readOnly=false) sends type other than "r"', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);
    const settings = new AccountSettings(client);

    await settings.generateApiKey(false);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.type).not.toBe('r');
  });

  test('getMessagesHtml fetches the DS-prefixed re-render module', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'dashboard/settings/DSMessagesModule'
        ? createOkResponse('<div>settings</div>')
        : createOkResponse()
    );
    const client = createMockClient(mockAmc);
    const settings = new AccountSettings(client);

    const result = await settings.getMessagesHtml();

    expect(result.isOk() && result.value).toBe('<div>settings</div>');
  });
});

describe('AccountProfile', () => {
  test('changeScreenName sends screenName', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);
    const profile = new AccountProfile(client);

    await profile.changeScreenName('new-name');

    const [body] = mockAmc.getRequestHistory();
    expect(body?.action).toBe('DashboardProfileAction');
    expect(body?.event).toBe('changeScreenName');
    expect(body?.screenName).toBe('new-name');
  });

  test('saveAbout omits unset fields', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);
    const profile = new AccountProfile(client);

    await profile.saveAbout({ realName: 'Test User' });

    const [body] = mockAmc.getRequestHistory();
    expect(body?.real_name).toBe('Test User');
    expect(body && 'gender' in body).toBe(false);
  });

  test('previewForumSignature returns rendered html', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'dashboard/settings/DSForumSignaturePreviewModule'
        ? createOkResponse('<p>preview</p>')
        : createOkResponse()
    );
    const client = createMockClient(mockAmc);
    const profile = new AccountProfile(client);

    const result = await profile.previewForumSignature('sig');

    expect(result.isOk() && result.value).toBe('<p>preview</p>');
  });

  test('saveProfileVisibility passes raw fields through', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);
    const profile = new AccountProfile(client);

    await profile.saveProfileVisibility({ some_field: 'value' });

    const [body] = mockAmc.getRequestHistory();
    expect(body?.some_field).toBe('value');
  });

  test('uploadAvatarFromUri returns status/im48/im16', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.event === 'uploadAvatarUri'
        ? { ...createOkResponse(), im48: 'u48', im16: 'u16' }
        : createOkResponse()
    );
    const client = createMockClient(mockAmc);
    const profile = new AccountProfile(client);

    const result = await profile.uploadAvatarFromUri('http://example.com/a.png');

    const [body] = mockAmc.getRequestHistory();
    expect(body?.uri).toBe('http://example.com/a.png');
    expect(result.isOk() && result.value.im48).toBe('u48');
  });
});

describe('AccountRecentActivity', () => {
  test('getChangesHtml uses own user id', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'userinfo/UserChangesListModule'
        ? createOkResponse('<div>changes</div>')
        : createOkResponse()
    );
    const client = createMockClient(mockAmc, { id: 99999 });
    const recent = new AccountRecentActivity(client);

    const result = await recent.getChangesHtml();

    const [body] = mockAmc.getRequestHistory();
    expect(body?.userId).toBe(99999);
    expect(result.isOk() && result.value).toBe('<div>changes</div>');
  });

  test('getChangesHtml rejects a "tags" option key', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);
    const recent = new AccountRecentActivity(client);

    const result = await recent.getChangesHtml(1, 20, { tags: true } as never);

    expect(result.isErr()).toBe(true);
  });

  test('getPostsHtml uses own user id', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'userinfo/UserRecentPostsListModule'
        ? createOkResponse('<div>posts</div>')
        : createOkResponse()
    );
    const client = createMockClient(mockAmc, { id: 99999 });
    const recent = new AccountRecentActivity(client);

    const result = await recent.getPostsHtml();

    const [body] = mockAmc.getRequestHistory();
    expect(body?.userId).toBe(99999);
    expect(result.isOk() && result.value).toBe('<div>posts</div>');
  });
});
