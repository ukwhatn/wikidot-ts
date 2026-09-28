/**
 * User user:info tab unit tests (getChanges/getPosts/getProfile/getMemberOf/getAdminOf/getModeratorOf)
 *
 * Fixtures under tests/fixtures/amc_responses/user_info/ are trimmed copies of
 * anonymous www.wikidot.com responses measured 2026-09-28.
 */
import { describe, expect, test } from 'bun:test';
import { AMCHttpError, NoElementError } from '../../../src/common/errors';
import type { AMCRequestBody, AMCResponse } from '../../../src/connector/amc-types';
import type { Client } from '../../../src/module/client';
import { User } from '../../../src/module/user/user';
import { amcFixtures } from '../../fixtures/loader';
import { createOkResponse, MockAMCClient } from '../../mocks/amc-client.mock';

const fixtures = amcFixtures.userInfo;

function asResponse(fixture: Record<string, unknown>): AMCResponse {
  return fixture as unknown as AMCResponse;
}

/** Anonymous client: requireLogin fails, so any login check would surface as an error */
function createAnonymousClient(mockAmc: MockAMCClient): Client {
  return {
    requireLogin: () => ({ isErr: () => true, error: new Error('not logged in') }),
    isLoggedIn: () => false,
    amcClient: mockAmc,
    me: null,
  } as unknown as Client;
}

function createUser(handler: (body: AMCRequestBody) => AMCResponse | Error): {
  user: User;
  mockAmc: MockAMCClient;
} {
  const mockAmc = new MockAMCClient();
  mockAmc.addResponseHandler(handler as never);
  const user = new User(createAnonymousClient(mockAmc), { id: 8823243, name: 'r-4981' });
  return { user, mockAmc };
}

describe('User.getChanges', () => {
  test('sends userId/perpage/page to userinfo/UserChangesListModule without login', async () => {
    const { user, mockAmc } = createUser(() => asResponse(fixtures.changesPage2Of2()));

    const result = await user.getChanges();

    expect(result.isOk()).toBe(true);
    const history = mockAmc.getRequestHistory();
    expect(history.length).toBe(1);
    expect(history[0]?.moduleName).toBe('userinfo/UserChangesListModule');
    expect(history[0]?.userId).toBe(8823243);
    expect(history[0]?.perpage).toBe(1000);
    expect(history[0]?.page).toBe(1);
    expect(history[0]?.options).toBeUndefined();
  });

  test('parses rows; pageFullname is the path of the full-URL href', async () => {
    const { user } = createUser(() => asResponse(fixtures.changesPage1Of2()));

    const result = await user.getChanges(undefined, 2);
    if (!result.isOk()) throw result.error;
    const [first, second] = result.value;

    expect(first?.siteTitle).toBe('SCP Foundation');
    expect(first?.siteUrl).toBe('https://scp-wiki.wikidot.com');
    expect(first?.pageFullname).toBe('scp-9418');
    expect(first?.pageTitle).toBe('SCP-9418');
    expect(first?.revisionNo).toBe(17);
    expect(first?.flags).toEqual(['S']);
    expect(first?.changedAt.getTime()).toBe(1790582636 * 1000);
    expect(second?.pageFullname).toBe('departments');
  });

  test('a "(new)" row has revisionNo 0', async () => {
    const { user } = createUser(() => asResponse(fixtures.changesPage2Of2()));

    const result = await user.getChanges();
    if (!result.isOk()) throw result.error;
    const created = result.value[1];

    expect(created?.revisionNo).toBe(0);
    expect(created?.flags).toEqual(['N']);
    expect(created?.pageFullname).toBe('arasame-144');
  });

  test('a row with neither a number nor "(new)" is an error', async () => {
    const body = `
<div class="changes-list-item"><table><tr>
  <td class="site"><a href="https://foo.wikidot.com">Foo</a></td>
  <td class="title"><a href="https://foo.wikidot.com/bar">Bar</a></td>
  <td class="flags"></td>
  <td class="mod-date"><span class="odate time_1700000000">x</span></td>
  <td class="revision-no">(?)</td>
</tr></table></div>`;
    const { user } = createUser(() => createOkResponse(body));

    const result = await user.getChanges();

    expect(result.isErr()).toBe(true);
  });

  test('follows the pager from page 1 of 2 and stops at page 2 of 2', async () => {
    const { user, mockAmc } = createUser((body) =>
      body.page === 1
        ? asResponse(fixtures.changesPage1Of2())
        : body.page === 2
          ? asResponse(fixtures.changesPage2Of2())
          : asResponse(fixtures.changesEmpty())
    );

    const result = await user.getChanges();
    if (!result.isOk()) throw result.error;

    expect(mockAmc.getRequestHistory().map((b) => b.page)).toEqual([1, 2]);
    expect(result.value.length).toBe(4);
  });

  test('does not request past the last page ("« previous", "1" pager)', async () => {
    const { user, mockAmc } = createUser(() => asResponse(fixtures.changesPage2Of2()));

    await user.getChanges();

    expect(mockAmc.getRequestHistory().length).toBe(1);
  });

  test('sends options as JSON and perpage = limit', async () => {
    const { user, mockAmc } = createUser(() => asResponse(fixtures.changesPage1Of2()));

    await user.getChanges({ new: true }, 1);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.perpage).toBe(1);
    expect(JSON.parse(String(body?.options))).toEqual({ new: true });
  });

  test('stops at limit', async () => {
    const { user, mockAmc } = createUser(() => asResponse(fixtures.changesPage1Of2()));

    const result = await user.getChanges(undefined, 1);

    expect(result.isOk() && result.value.length).toBe(1);
    expect(mockAmc.getRequestHistory().length).toBe(1);
  });

  test('returns an empty list when there are no rows', async () => {
    const { user } = createUser(() => asResponse(fixtures.changesEmpty()));

    const result = await user.getChanges();

    expect(result.isOk() && result.value).toEqual([]);
  });

  test('rejects an unknown option key without a request', async () => {
    const { user, mockAmc } = createUser(() => asResponse(fixtures.changesEmpty()));

    const result = await user.getChanges({ tags: true } as never);

    expect(result.isErr()).toBe(true);
    expect(mockAmc.getRequestHistory().length).toBe(0);
  });

  test('passes the AMC error through for a nonexistent user', async () => {
    const { user } = createUser(() => new AMCHttpError('AMC request failed', 500));

    const result = await user.getChanges();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBeInstanceOf(AMCHttpError);
  });
});

describe('User.getPosts', () => {
  test('sends page/userId (no perpage) and parses the new fields', async () => {
    const { user, mockAmc } = createUser(() => asResponse(fixtures.postsSingle()));

    const result = await user.getPosts();
    if (!result.isOk()) throw result.error;

    const [body] = mockAmc.getRequestHistory();
    expect(body?.moduleName).toBe('userinfo/UserRecentPostsListModule');
    expect(body?.userId).toBe(8823243);
    expect(body?.page).toBe(1);
    expect(body?.perpage).toBeUndefined();

    expect(result.value.length).toBe(1);
    const post = result.value[0];
    expect(post?.title).toBe('Coming up soon:');
    expect(post?.url).toBe('https://scp-wiki.wikidot.com/scp-9418/comments/show#post-9081419');
    expect(post?.createdAt.getTime()).toBe(1790512849 * 1000);
    expect(post?.content).toContain("Don't miss it!");
    expect(post?.postId).toBe(9081419);
    expect(post?.siteTitle).toBe('SCP Foundation');
    expect(post?.siteUrl).toBe('https://scp-wiki.wikidot.com');
    expect(post?.threadTitle).toBe('SCP-9418');
    expect(post?.threadUrl).toBe('https://scp-wiki.wikidot.com/scp-9418/comments/show');
  });

  test('follows a middle-page pager and stops on an empty page', async () => {
    const { user, mockAmc } = createUser((body) =>
      body.page === 3 ? asResponse(fixtures.postsOutOfRange()) : asResponse(fixtures.postsPage2())
    );

    const result = await user.getPosts();
    if (!result.isOk()) throw result.error;

    expect(mockAmc.getRequestHistory().map((b) => b.page)).toEqual([1, 2, 3]);
    expect(result.value.length).toBe(4);
    expect(result.value[0]?.postId).toBe(8597914);
    expect(result.value[0]?.threadTitle).toBe('スタッフ/コントリ人員更新のお知らせ');
    expect(result.value[0]?.threadUrl).toBe('https://scp-jp.wikidot.com/forum/t-14109916/');
    expect(result.value[0]?.siteTitle).toBe('SCP財団');
  });

  test('stops at limit across pages', async () => {
    const { user, mockAmc } = createUser(() => asResponse(fixtures.postsPage2()));

    const result = await user.getPosts(3);

    expect(result.isOk() && result.value.length).toBe(3);
    expect(mockAmc.getRequestHistory().length).toBe(2);
  });

  test('returns an empty list when there are no posts', async () => {
    const { user } = createUser(() => asResponse(fixtures.postsOutOfRange()));

    const result = await user.getPosts();

    expect(result.isOk() && result.value).toEqual([]);
  });

  test('site/thread fields are null when div.info has no labels', async () => {
    const body = `
<div class="post" id="post-1"><div class="long"><div class="head">
  <div class="title"><a href="https://foo.wikidot.com/forum/t-1#post-1">T</a></div>
  <div class="info"><span class="printuser"><a href="https://www.wikidot.com/user:info/x">x</a></span>
    <span class="odate time_1700000000">x</span></div>
</div><div class="content">c</div></div></div>`;
    const { user } = createUser(() => createOkResponse(body));

    const result = await user.getPosts();
    if (!result.isOk()) throw result.error;

    expect(result.value[0]?.postId).toBe(1);
    expect(result.value[0]?.siteTitle).toBeNull();
    expect(result.value[0]?.siteUrl).toBeNull();
    expect(result.value[0]?.threadTitle).toBeNull();
    expect(result.value[0]?.threadUrl).toBeNull();
  });
});

describe('User.getProfile', () => {
  test('sends user_id and parses the profile rows', async () => {
    const { user, mockAmc } = createUser(() => asResponse(fixtures.profile()));

    const result = await user.getProfile();
    if (!result.isOk()) throw result.error;
    const profile = result.value;

    const [body] = mockAmc.getRequestHistory();
    expect(body?.moduleName).toBe('userinfo/UserInfoProfileModule');
    expect(body?.user_id).toBe(8823243);
    expect(body?.userId).toBeUndefined();

    expect(profile.realName).toBe('或る祝杯');
    expect(profile.website).toBe('https://kleismic.com');
    expect(profile.memberSince?.getTime()).toBe(1696412553 * 1000);
    expect(profile.accountType).toBe('free');
    expect(profile.karmaLevel).toBe('high');
    expect(profile.fields).toEqual({
      'Real name': '或る祝杯',
      Website: 'kleismic.com',
      'Wikidot user since': '04 Oct 2023 09:42',
      'Account type': 'free',
      'Karma level': 'high (what is this?)',
    });
  });

  test('every named field is null when there are no rows', async () => {
    const { user } = createUser(() =>
      createOkResponse('<div class="profile-box"><dl class="dl-horizontal"></dl></div>')
    );

    const result = await user.getProfile();
    if (!result.isOk()) throw result.error;

    expect(result.value.fields).toEqual({});
    expect(result.value.realName).toBeNull();
    expect(result.value.website).toBeNull();
    expect(result.value.memberSince).toBeNull();
    expect(result.value.accountType).toBeNull();
    expect(result.value.karmaLevel).toBeNull();
  });

  test('fails with NoElementError when the profile box is missing', async () => {
    const { user } = createUser(() => createOkResponse('<div>unexpected</div>'));

    const result = await user.getProfile();

    expect(result.isErr() && result.error).toBeInstanceOf(NoElementError);
  });

  test('website falls back to the text when there is no link', async () => {
    const { user } = createUser(() =>
      createOkResponse(
        '<div class="profile-box"><dl><dt>Website:</dt> <dd> example.com </dd></dl></div>'
      )
    );

    const result = await user.getProfile();

    expect(result.isOk() && result.value.website).toBe('example.com');
  });

  test('passes the AMC error through for a nonexistent user', async () => {
    const { user } = createUser(() => new AMCHttpError('AMC request failed', 500));

    const result = await user.getProfile();

    expect(result.isErr() && result.error).toBeInstanceOf(AMCHttpError);
  });
});

describe('User.getMemberOf / getAdminOf / getModeratorOf', () => {
  test('getMemberOf parses every site', async () => {
    const { user, mockAmc } = createUser(() => asResponse(fixtures.memberOf()));

    const result = await user.getMemberOf();
    if (!result.isOk()) throw result.error;

    const [body] = mockAmc.getRequestHistory();
    expect(body?.moduleName).toBe('userinfo/UserInfoMemberOfModule');
    expect(body?.user_id).toBe(8823243);

    expect(result.value.map((s) => s.title)).toEqual([
      'Redacted Archive.',
      'SCP Foundation',
      '営利法人 因幡の白兎',
    ]);
    const [archive, foundation] = result.value;
    expect(archive?.url).toBe('https://redacted-archive.wikidot.com');
    expect(archive?.subtitle).toBe('Secured, Contained, Protected.');
    expect(archive?.description).toBeNull();
    expect(foundation?.subtitle).toBe('Secure, Contain, Protect');
    expect(foundation?.description).toStartWith('Welcome to the Foundation Database.');
  });

  test('getAdminOf sends user_id to userinfo/UserInfoAdminOfModule', async () => {
    const { user, mockAmc } = createUser(() => asResponse(fixtures.adminOf()));

    const result = await user.getAdminOf();
    if (!result.isOk()) throw result.error;

    expect(mockAmc.getRequestHistory()[0]?.moduleName).toBe('userinfo/UserInfoAdminOfModule');
    expect(result.value.length).toBe(1);
    expect(result.value[0]?.title).toBe('Redacted Archive.');
  });

  test('getModeratorOf returns an empty list when there is no dl', async () => {
    const { user, mockAmc } = createUser(() => asResponse(fixtures.moderatorOf()));

    const result = await user.getModeratorOf();

    expect(mockAmc.getRequestHistory()[0]?.moduleName).toBe('userinfo/UserInfoModeratorOfModule');
    expect(result.isOk() && result.value).toEqual([]);
  });

  test('subtitle is null when there is no small > em', async () => {
    const { user } = createUser(() =>
      createOkResponse(
        '<dl><dt><a href="https://foo.wikidot.com">Foo</a></dt><dd><small>desc</small></dd></dl>'
      )
    );

    const result = await user.getMemberOf();
    if (!result.isOk()) throw result.error;

    expect(result.value[0]?.subtitle).toBeNull();
    expect(result.value[0]?.description).toBe('desc');
  });
});
