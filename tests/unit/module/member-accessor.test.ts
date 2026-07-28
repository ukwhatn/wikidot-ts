/**
 * MemberAccessor (Site.member) unit tests -- covers Task 2-1..2-6
 */
import { describe, expect, test } from 'bun:test';
import { errAsync, okAsync } from 'neverthrow';
import { UnexpectedError } from '../../../src/common/errors';
import type { AMCRequestBody, AMCResponse } from '../../../src/connector';
import type { Site } from '../../../src/module/site';
import { MemberAccessor } from '../../../src/module/site/accessors/member-accessor';
import { TEST_SITE_DATA } from '../../setup';

type SingleHandler = (body: AMCRequestBody) => ReturnType<Site['amcRequestSingle']>;
type MultiHandler = (bodies: AMCRequestBody[]) => ReturnType<Site['amcRequest']>;

function createMockSite(options: { single?: SingleHandler; multi?: MultiHandler }): {
  site: Site;
  singleCalls: AMCRequestBody[];
  multiCalls: AMCRequestBody[][];
} {
  const singleCalls: AMCRequestBody[] = [];
  const multiCalls: AMCRequestBody[][] = [];
  const site = {
    id: TEST_SITE_DATA.id,
    unixName: TEST_SITE_DATA.unixName,
    domain: TEST_SITE_DATA.domain,
    sslSupported: TEST_SITE_DATA.sslSupported,
    amcRequestSingle: (body: AMCRequestBody) => {
      singleCalls.push(body);
      if (!options.single) {
        throw new Error('amcRequestSingle not mocked');
      }
      return options.single(body);
    },
    amcRequest: (bodies: AMCRequestBody[]) => {
      multiCalls.push(bodies);
      if (!options.multi) {
        throw new Error('amcRequest not mocked');
      }
      return options.multi(bodies);
    },
  } as unknown as Site;
  return { site, singleCalls, multiCalls };
}

function queuedMulti(responseLists: AMCResponse[][]): MultiHandler {
  let index = 0;
  return () => {
    const responses = responseLists[index];
    index++;
    if (!responses) {
      return errAsync(new UnexpectedError('No more mock responses queued'));
    }
    return okAsync(responses);
  };
}

const okResponse: AMCResponse = { status: 'ok' };

describe('Task 2-1: admin-view member listing', () => {
  test('getMembersAdminView requests the admin members-list module with page 1', async () => {
    const { site, multiCalls } = createMockSite({
      multi: queuedMulti([[{ status: 'ok', body: '<table></table>' }]]),
    });
    const accessor = new MemberAccessor(site);

    const result = await accessor.getMembersAdminView();

    expect(result.isOk()).toBe(true);
    expect(multiCalls[0]?.[0]?.moduleName).toBe('managesite/members/ManageSiteMembersListModule');
    expect(multiCalls[0]?.[0]?.page).toBe(1);
  });

  test('parses printuser rows and follows pagination', async () => {
    const firstBody = `
      <table><tr><td><span class="printuser">
        <a onclick="WIKIDOT.page.listeners.userInfo(1)" href="#">User1</a>
      </span></td></tr></table>
      <div class="pager"><a href="#">1</a><a href="#">2</a><a href="#">next</a></div>
    `;
    const secondBody = `
      <table><tr><td><span class="printuser">
        <a onclick="WIKIDOT.page.listeners.userInfo(2)" href="#">User2</a>
      </span></td></tr></table>
    `;
    const { site, multiCalls } = createMockSite({
      multi: queuedMulti([
        [{ status: 'ok', body: firstBody }],
        [{ status: 'ok', body: secondBody }],
      ]),
    });
    const accessor = new MemberAccessor(site);

    const result = await accessor.getModeratorsAdminView();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.length).toBe(2);
    }
    expect(multiCalls.length).toBe(2);
  });

  test('getAdminsAdminView uses the admins module', async () => {
    const { site, multiCalls } = createMockSite({
      multi: queuedMulti([[{ status: 'ok', body: '<table></table>' }]]),
    });
    await new MemberAccessor(site).getAdminsAdminView();

    expect(multiCalls[0]?.[0]?.moduleName).toBe('managesite/members/ManageSiteAdminsModule');
  });
});

describe('Task 2-2: removeMember / changeMaster / moderator permissions', () => {
  test('remove without ban omits the key', async () => {
    const { site, singleCalls } = createMockSite({ single: () => okAsync(okResponse) });
    await new MemberAccessor(site).remove(42);

    expect(singleCalls[0]?.action).toBe('ManageSiteMembershipAction');
    expect(singleCalls[0]?.event).toBe('removeMember');
    expect(singleCalls[0]?.user_id).toBe(42);
    expect(singleCalls[0]?.ban).toBeUndefined();
  });

  test('remove with ban sends "yes"', async () => {
    const { site, singleCalls } = createMockSite({ single: () => okAsync(okResponse) });
    await new MemberAccessor(site).remove(42, { ban: true });

    expect(singleCalls[0]?.ban).toBe('yes');
  });

  test('changeMaster uses camelCase userId', async () => {
    const { site, singleCalls } = createMockSite({ single: () => okAsync(okResponse) });
    await new MemberAccessor(site).changeMaster(99);

    expect(singleCalls[0]?.event).toBe('changeMaster');
    expect(singleCalls[0]?.userId).toBe(99);
    expect(singleCalls[0]?.user_id).toBeUndefined();
  });

  test('getModeratorPermissionsForm returns the raw body', async () => {
    const { site, singleCalls } = createMockSite({
      single: () => okAsync({ status: 'ok', body: '<form>raw</form>' }),
    });
    const result = await new MemberAccessor(site).getModeratorPermissionsForm(7);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('<form>raw</form>');
    }
    expect(singleCalls[0]?.moduleName).toBe('managesite/ManageSiteModeratorPermissionsModule');
    expect(singleCalls[0]?.moderatorId).toBe(7);
  });

  test('saveModeratorPermissions passes fields verbatim', async () => {
    const { site, singleCalls } = createMockSite({ single: () => okAsync(okResponse) });
    await new MemberAccessor(site).saveModeratorPermissions({ foo: 'bar', baz: 1 });

    expect(singleCalls[0]?.event).toBe('saveModeratorPermissions');
    expect(singleCalls[0]?.foo).toBe('bar');
    expect(singleCalls[0]?.baz).toBe(1);
  });
});

describe('Task 2-4: invitations', () => {
  test('searchUsers looks up names by id string (userNames is a map, not a parallel array)', async () => {
    // Confirmed live 2026-07-29; see 40_admin-managesite.md
    const { site } = createMockSite({
      single: () =>
        okAsync({
          status: 'ok',
          userIds: [3396310, 9625925],
          userNames: { '3396310': 'ukwhatn', '9625925': 'ukwhatn Bot - test' },
        } as unknown as AMCResponse),
    });
    const result = await new MemberAccessor(site).searchUsers('a');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([
        { id: 3396310, name: 'ukwhatn' },
        { id: 9625925, name: 'ukwhatn Bot - test' },
      ]);
    }
  });

  test('searchUsers falls back to an empty string for a missing name', async () => {
    const { site } = createMockSite({
      single: () =>
        okAsync({ status: 'ok', userIds: [1], userNames: {} } as unknown as AMCResponse),
    });
    const result = await new MemberAccessor(site).searchUsers('a');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([{ id: 1, name: '' }]);
    }
  });

  test('sendEmailInvitations encodes addresses as a JSON array of arrays', async () => {
    const { site, singleCalls } = createMockSite({ single: () => okAsync(okResponse) });
    await new MemberAccessor(site).sendEmailInvitations([['a@example.com', 'A', true]], 'hi');

    expect(singleCalls[0]?.addresses).toBe('[["a@example.com","A",true]]');
    expect(singleCalls[0]?.message).toBe('hi');
  });

  test('deleteEmailInvitation sends invitationId', async () => {
    const { site, singleCalls } = createMockSite({ single: () => okAsync(okResponse) });
    await new MemberAccessor(site).deleteEmailInvitation(123);

    expect(singleCalls[0]?.event).toBe('deleteEmailInvitation');
    expect(singleCalls[0]?.invitationId).toBe(123);
  });

  test('setLetUsersInvite always sends a string boolean', async () => {
    const { site, singleCalls } = createMockSite({ single: () => okAsync(okResponse) });
    await new MemberAccessor(site).setLetUsersInvite(false);

    expect(singleCalls[0]?.enableLetUsersInvite).toBe('false');
  });

  test('inviteAdmin returns the userId from the response', async () => {
    const { site } = createMockSite({
      single: () =>
        okAsync({ status: 'ok', result: 'invited', userId: 55 } as unknown as AMCResponse),
    });
    const result = await new MemberAccessor(site).inviteAdmin(55);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(55);
    }
  });
});

describe('Task 2-5: user / IP blocks', () => {
  test('getBlockedUsers parses printuser rows', async () => {
    const { site } = createMockSite({
      single: () =>
        okAsync({
          status: 'ok',
          body: `
            <table><tr>
              <td><span class="printuser">
                <a onclick="WIKIDOT.page.listeners.userInfo(1)" href="#">U1</a>
              </span></td>
              <td>spam</td>
            </tr></table>
          `,
        }),
    });
    const result = await new MemberAccessor(site).getBlockedUsers();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.length).toBe(1);
      expect(result.value[0]?.reason).toBe('spam');
    }
  });

  test('getBlockedIps extracts blockId from the onclick handler', async () => {
    const { site } = createMockSite({
      single: () =>
        okAsync({
          status: 'ok',
          body: `
            <table><tr>
              <td>1.2.3.4</td>
              <td><a onclick="WIKIDOT.modules.ManageSiteIpBlocksModule.listeners.deleteBlock(event, 999, 'x')">unblock</a></td>
              <td>abuse</td>
            </tr></table>
          `,
        }),
    });
    const result = await new MemberAccessor(site).getBlockedIps();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.length).toBe(1);
      expect(result.value[0]?.blockId).toBe(999);
      expect(result.value[0]?.ip).toBe('1.2.3.4');
      expect(result.value[0]?.reason).toBe('abuse');
    }
  });

  test('unblockUser sends userId (not blockId)', async () => {
    const { site, singleCalls } = createMockSite({ single: () => okAsync(okResponse) });
    await new MemberAccessor(site).unblockUser(1);

    expect(singleCalls[0]?.event).toBe('deleteBlock');
    expect(singleCalls[0]?.userId).toBe(1);
  });

  test('unblockIp sends blockId (not userId)', async () => {
    const { site, singleCalls } = createMockSite({ single: () => okAsync(okResponse) });
    await new MemberAccessor(site).unblockIp(999);

    expect(singleCalls[0]?.event).toBe('deleteIpBlock');
    expect(singleCalls[0]?.blockId).toBe(999);
    expect(singleCalls[0]?.userId).toBeUndefined();
  });
});

describe('Task 2-6: abuse flags / members watching / block link', () => {
  test('clearAnonymousFlags without proxy omits the key', async () => {
    const { site, singleCalls } = createMockSite({ single: () => okAsync(okResponse) });
    await new MemberAccessor(site).clearAnonymousFlags('1.2.3.4');

    expect(singleCalls[0]?.address).toBe('1.2.3.4');
    expect(singleCalls[0]?.proxy).toBeUndefined();
  });

  test('clearAnonymousFlags with proxy sends "yes"', async () => {
    const { site, singleCalls } = createMockSite({ single: () => okAsync(okResponse) });
    await new MemberAccessor(site).clearAnonymousFlags('1.2.3.4', true);

    expect(singleCalls[0]?.proxy).toBe('yes');
  });

  test('setMembersWatching sends selected_categories as an array', async () => {
    const { site, singleCalls } = createMockSite({ single: () => okAsync(okResponse) });
    await new MemberAccessor(site).setMembersWatching({ selectedCategories: [1, 2] });

    expect(singleCalls[0]?.selected_categories).toEqual([1, 2]);
    expect(singleCalls[0]?.watch_all).toBeUndefined();
  });

  test('setBlockLink sends karmaLevel and blockLink flag', async () => {
    const { site, singleCalls } = createMockSite({ single: () => okAsync(okResponse) });
    await new MemberAccessor(site).setBlockLink(3, true);

    expect(singleCalls[0]?.action).toBe('ManageSiteAction');
    expect(singleCalls[0]?.event).toBe('saveBlockLink');
    expect(singleCalls[0]?.karmaLevel).toBe(3);
    expect(singleCalls[0]?.blockLink).toBe('true');
  });
});
