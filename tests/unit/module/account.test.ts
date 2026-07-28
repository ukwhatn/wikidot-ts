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

/**
 * userinfo/UserChangesListModule row fixture, based on the 2026-07-29 markup
 * measurement recorded in the sibling wikidot.py repo's 70_account.md
 * ("一覧モジュールの行マークアップ")
 */
const USER_CHANGES_LIST_BODY = `
<div class="changes-list-item">
  <table><tbody><tr>
    <td class="site"><a href="http://foo.wikidot.com">Foo Site</a></td>
    <td class="title"><a href="/component:scp-173">SCP-173</a></td>
    <td class="flags"><span class="spantip">S</span></td>
    <td class="mod-date"><span class="odate time_1700000000">01 Jan 2024</span></td>
    <td class="revision-no">Rev. 5</td>
  </tr></tbody></table>
</div>
`;

/** userinfo/UserRecentPostsListModule row fixture, based on the 2026-07-29 markup measurement */
const USER_RECENT_POSTS_LIST_BODY = `
<div class="post">
  <div class="long">
    <div class="head">
      <div class="title"><a href="http://foo.wikidot.com/forum/t-123#post-456">Re: Something</a></div>
    </div>
  </div>
  <div class="info">
    <span class="printuser">
        <a href="http://www.wikidot.com/user:info/me" onclick="WIKIDOT.page.listeners.userInfo(99999); return false;">me</a>
    </span>
    <span class="odate time_1700000000">01 Jan 2024</span>
  </div>
  <div class="content">Post content here</div>
</div>
`;

describe('AccountRecentActivity', () => {
  test('getChanges fetches the hidden user id first (userinfo/UserChangesModule)', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'userinfo/UserChangesModule'
        ? createOkResponse('<input type="hidden" id="changes-user-id" value="42">')
        : body.moduleName === 'userinfo/UserChangesListModule'
          ? createOkResponse(USER_CHANGES_LIST_BODY)
          : createOkResponse()
    );
    const client = createMockClient(mockAmc);
    const recent = new AccountRecentActivity(client);

    const result = await recent.getChanges();

    const history = mockAmc.getRequestHistory();
    expect(history[0]?.moduleName).toBe('userinfo/UserChangesModule');
    expect(history[1]?.moduleName).toBe('userinfo/UserChangesListModule');
    expect(history[1]?.userId).toBe(42);
    expect(result.isOk() && result.value.length).toBe(1);
  });

  test('getChanges parses row fields', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'userinfo/UserChangesModule'
        ? createOkResponse('<input type="hidden" id="changes-user-id" value="42">')
        : body.moduleName === 'userinfo/UserChangesListModule'
          ? createOkResponse(USER_CHANGES_LIST_BODY)
          : createOkResponse()
    );
    const client = createMockClient(mockAmc);
    const recent = new AccountRecentActivity(client);

    const result = await recent.getChanges();
    if (!result.isOk()) throw new Error('expected ok');
    const change = result.value[0];

    expect(change?.siteTitle).toBe('Foo Site');
    expect(change?.siteUrl).toBe('http://foo.wikidot.com');
    expect(change?.pageFullname).toBe('component:scp-173');
    expect(change?.pageTitle).toBe('SCP-173');
    expect(change?.revisionNo).toBe(5);
    expect(change?.flags).toEqual(['S']);
  });

  test('getChanges caches the user id across calls', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'userinfo/UserChangesModule'
        ? createOkResponse('<input type="hidden" id="changes-user-id" value="42">')
        : body.moduleName === 'userinfo/UserChangesListModule'
          ? createOkResponse(USER_CHANGES_LIST_BODY)
          : createOkResponse()
    );
    const client = createMockClient(mockAmc);
    const recent = new AccountRecentActivity(client);

    await recent.getChanges();
    await recent.getChanges();

    const shellCalls = mockAmc
      .getRequestHistory()
      .filter((body) => body.moduleName === 'userinfo/UserChangesModule');
    expect(shellCalls.length).toBe(1);
  });

  test('getChanges rejects a "tags" option key', async () => {
    const mockAmc = new MockAMCClient();
    const client = createMockClient(mockAmc);
    const recent = new AccountRecentActivity(client);

    const result = await recent.getChanges({ tags: true } as never);

    expect(result.isErr()).toBe(true);
  });

  test('getPosts fetches the hidden user id first (userinfo/UserRecentPostsModule)', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'userinfo/UserRecentPostsModule'
        ? createOkResponse('<input type="hidden" id="recent-posts-user-id" value="42">')
        : body.moduleName === 'userinfo/UserRecentPostsListModule'
          ? createOkResponse(USER_RECENT_POSTS_LIST_BODY)
          : createOkResponse()
    );
    const client = createMockClient(mockAmc);
    const recent = new AccountRecentActivity(client);

    const result = await recent.getPosts();

    const history = mockAmc.getRequestHistory();
    expect(history[0]?.moduleName).toBe('userinfo/UserRecentPostsModule');
    expect(history[1]?.moduleName).toBe('userinfo/UserRecentPostsListModule');
    expect(history[1]?.userId).toBe(42);
    expect(result.isOk() && result.value.length).toBe(1);
  });

  test('getPosts parses row fields', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'userinfo/UserRecentPostsModule'
        ? createOkResponse('<input type="hidden" id="recent-posts-user-id" value="42">')
        : body.moduleName === 'userinfo/UserRecentPostsListModule'
          ? createOkResponse(USER_RECENT_POSTS_LIST_BODY)
          : createOkResponse()
    );
    const client = createMockClient(mockAmc);
    const recent = new AccountRecentActivity(client);

    const result = await recent.getPosts();
    if (!result.isOk()) throw new Error('expected ok');
    const post = result.value[0];

    expect(post?.title).toBe('Re: Something');
    expect(post?.url).toBe('http://foo.wikidot.com/forum/t-123#post-456');
    expect(post?.content).toBe('Post content here');
  });
});
