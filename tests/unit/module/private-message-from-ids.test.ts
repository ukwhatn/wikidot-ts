/**
 * PrivateMessageCollection.fromIds partial-success contract tests
 *
 * Release-condition tests for the resilience fix: a failure on one message
 * (parser or transport) must not fail the whole fetch. Failed IDs are
 * reported on the returned collection instead.
 */
import { describe, expect, test } from 'bun:test';
import { AMCHttpError, ForbiddenError, ResponseDataError } from '../../../src/common/errors';
import type { Client } from '../../../src/module/client';
import {
  PrivateMessage,
  PrivateMessageCollection,
  PrivateMessageInbox,
} from '../../../src/module/private-message/private-message';
import { createOkResponse, MockAMCClient } from '../../mocks/amc-client.mock';

const VIEW_MODULE = 'dashboard/messages/DMViewMessageModule';
const INBOX_MODULE = 'dashboard/messages/DMInboxModule';

function createFullMockClient(mockAmc: MockAMCClient): Client {
  return {
    requireLogin: () => ({ isErr: () => false }),
    isLoggedIn: () => true,
    amcClient: mockAmc,
  } as unknown as Client;
}

/**
 * Build a parseable DMViewMessageModule response body
 */
function messageHtml(
  options: { senderName?: string; senderId?: number; subject?: string } = {}
): string {
  const senderName = options.senderName ?? 'alice';
  const senderId = options.senderId ?? 111;
  const subject = options.subject ?? 'Subject';
  return `
    <div class="pmessage">
      <div class="header">
        <span class="printuser"><a href="http://www.wikidot.com/user:info/${senderName}" onclick="WIKIDOT.page.listeners.userInfo(${senderId}); return false;">${senderName}</a></span>
        <span class="printuser"><a href="http://www.wikidot.com/user:info/staff" onclick="WIKIDOT.page.listeners.userInfo(999); return false;">staff</a></span>
        <span class="subject">${subject}</span>
        <span class="odate time_1700000000">01 Jan 2024</span>
      </div>
      <div class="body">Body text</div>
    </div>`;
}

/** DMViewMessageModule body that fails printuser parsing (fewer than 2 elements) */
const UNPARSEABLE_HTML = '<div class="pmessage"><div class="header"></div></div>';

describe('PrivateMessageCollection.fromIds partial success', () => {
  test('parser failure on one message is skipped and reported, others are returned', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) => {
      if (body.moduleName !== VIEW_MODULE) return createOkResponse();
      if (body.item === 2) return createOkResponse(UNPARSEABLE_HTML);
      return createOkResponse(messageHtml({ subject: `msg-${body.item}` }));
    });
    const client = createFullMockClient(mockAmc);

    const result = await PrivateMessageCollection.fromIds(client, [1, 2, 3]);

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) throw new Error('expected ok');
    expect(result.value.length).toBe(2);
    expect(result.value[0]?.id).toBe(1);
    expect(result.value[1]?.id).toBe(3);
    expect(result.value.failures.length).toBe(1);
    expect(result.value.failures[0]?.id).toBe(2);
    expect(result.value.failures[0]?.error).toBeInstanceOf(ForbiddenError);
  });

  test('transport failure on one message is skipped and reported, others are returned', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) => {
      if (body.moduleName !== VIEW_MODULE) return createOkResponse();
      if (body.item === 20) return new AMCHttpError('AMC request failed', 500);
      return createOkResponse(messageHtml());
    });
    const client = createFullMockClient(mockAmc);

    const result = await PrivateMessageCollection.fromIds(client, [10, 20, 30]);

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) throw new Error('expected ok');
    expect(result.value.length).toBe(2);
    expect(result.value[0]?.id).toBe(10);
    expect(result.value[1]?.id).toBe(30);
    expect(result.value.failures.length).toBe(1);
    expect(result.value.failures[0]?.id).toBe(20);
    expect(result.value.failures[0]?.error).toBeInstanceOf(AMCHttpError);
  });

  test('all messages failing returns Ok with an empty collection and all failures', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) => {
      if (body.moduleName !== VIEW_MODULE) return createOkResponse();
      if (body.item === 1) return new AMCHttpError('AMC request failed', 500);
      return createOkResponse(UNPARSEABLE_HTML);
    });
    const client = createFullMockClient(mockAmc);

    const result = await PrivateMessageCollection.fromIds(client, [1, 2]);

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) throw new Error('expected ok');
    expect(result.value.length).toBe(0);
    expect(result.value.failures.map((f) => f.id)).toEqual([1, 2]);
  });

  test('successful messages preserve the input ID order', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === VIEW_MODULE ? createOkResponse(messageHtml()) : createOkResponse()
    );
    const client = createFullMockClient(mockAmc);

    const result = await PrivateMessageCollection.fromIds(client, [30, 10, 20]);

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) throw new Error('expected ok');
    expect(result.value.map((m) => m.id)).toEqual([30, 10, 20]);
    expect(result.value.failures).toEqual([]);
  });

  test('response without body is reported as a ResponseDataError failure', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === VIEW_MODULE
        ? { status: 'ok', CURRENT_TIMESTAMP: Date.now() }
        : createOkResponse()
    );
    const client = createFullMockClient(mockAmc);

    const result = await PrivateMessageCollection.fromIds(client, [1]);

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) throw new Error('expected ok');
    expect(result.value.length).toBe(0);
    expect(result.value.failures[0]?.error).toBeInstanceOf(ResponseDataError);
  });

  test('fromId surfaces the recorded failure as an error', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === VIEW_MODULE ? createOkResponse(UNPARSEABLE_HTML) : createOkResponse()
    );
    const client = createFullMockClient(mockAmc);

    const result = await PrivateMessage.fromId(client, 42);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) throw new Error('expected err');
    expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  test('inbox() propagates per-message failures from fromIds', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) => {
      if (body.moduleName === INBOX_MODULE) {
        return createOkResponse(`
          <table>
            <tr class="message" data-href="#/inbox/1"><td>a</td></tr>
            <tr class="message" data-href="#/inbox/2"><td>b</td></tr>
          </table>`);
      }
      if (body.moduleName === VIEW_MODULE) {
        if (body.item === 2) return createOkResponse(UNPARSEABLE_HTML);
        return createOkResponse(messageHtml());
      }
      return createOkResponse();
    });
    const client = createFullMockClient(mockAmc);

    const result = await PrivateMessageInbox.acquire(client);

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) throw new Error('expected ok');
    expect(result.value).toBeInstanceOf(PrivateMessageInbox);
    expect(result.value.length).toBe(1);
    expect(result.value[0]?.id).toBe(1);
    expect(result.value.failures.length).toBe(1);
    expect(result.value.failures[0]?.id).toBe(2);
  });
});
