/**
 * PrivateMessage module unit tests
 */
import { describe, expect, test } from 'bun:test';
import type { Client } from '../../../src/module/client';
import {
  addContact,
  addContactViaProfile,
  getApplicationDetailHtml,
  getApplicationsHtml,
  getContactsHtml,
  getContactsListHtml,
  getInvitationDetailHtml,
  getInvitationsHtml,
  PrivateMessage,
  PrivateMessageCollection,
  PrivateMessageInbox,
  PrivateMessageSentBox,
  removeContact,
} from '../../../src/module/private-message/private-message';
import type { ClientRef } from '../../../src/module/types';
import { User } from '../../../src/module/user/user';
import { createOkResponse, MockAMCClient } from '../../mocks/amc-client.mock';

/**
 * Create mock client
 */
function createMockClient(): ClientRef {
  return {
    requireLogin: () => ({ isErr: () => false }),
    isLoggedIn: () => true,
  };
}

/**
 * Create a full mock Client backed by a MockAMCClient, for the request-sending
 * (P5) methods that go through client.amcClient directly
 */
function createFullMockClient(mockAmc: MockAMCClient): Client {
  return {
    requireLogin: () => ({ isErr: () => false }),
    isLoggedIn: () => true,
    amcClient: mockAmc,
  } as unknown as Client;
}

/**
 * Create test user
 */
function createMockUser(name: string): User {
  const client = createMockClient();
  return new User(client, {
    id: 12345,
    name,
    unixName: name.toLowerCase().replace(/\s/g, '-'),
  });
}

/**
 * Create test message
 */
function createTestMessage(
  options: { id?: number; subject?: string; body?: string; sender?: User; recipient?: User } = {}
): PrivateMessage {
  const client = createMockClient() as unknown as Client;
  const sender = options.sender ?? createMockUser('Sender');
  const recipient = options.recipient ?? createMockUser('Recipient');

  return new PrivateMessage({
    client,
    id: options.id ?? 1001,
    subject: options.subject ?? 'Test Subject',
    body: options.body ?? 'Test body content',
    sender,
    recipient,
    createdAt: new Date(),
  });
}

describe('PrivateMessage data class', () => {
  describe('Basic properties', () => {
    test('toString() returns correct string', () => {
      const message = createTestMessage();

      const result = message.toString();

      expect(result).toContain('PrivateMessage(');
      expect(result).toContain('id=1001');
      expect(result).toContain('subject=Test Subject');
    });

    test('id is correctly set', () => {
      const message = createTestMessage({ id: 9999 });

      expect(message.id).toBe(9999);
    });

    test('subject is correctly set', () => {
      const message = createTestMessage({ subject: 'Custom Subject' });

      expect(message.subject).toBe('Custom Subject');
    });

    test('body is correctly set', () => {
      const message = createTestMessage({ body: 'Custom body text' });

      expect(message.body).toBe('Custom body text');
    });

    test('sender is correctly set', () => {
      const sender = createMockUser('TestSender');
      const message = createTestMessage({ sender });

      expect(message.sender.name).toBe('TestSender');
    });

    test('recipient is correctly set', () => {
      const recipient = createMockUser('TestRecipient');
      const message = createTestMessage({ recipient });

      expect(message.recipient.name).toBe('TestRecipient');
    });
  });
});

describe('PrivateMessageCollection', () => {
  test('Can create empty collection', () => {
    const client = createMockClient() as unknown as Client;
    const collection = new PrivateMessageCollection(client);

    expect(collection.length).toBe(0);
  });

  test('Can add message', () => {
    const client = createMockClient() as unknown as Client;
    const collection = new PrivateMessageCollection(client);
    const message = createTestMessage();

    collection.push(message);

    expect(collection.length).toBe(1);
    expect(collection[0]).toBe(message);
  });

  test('Can initialize with multiple messages', () => {
    const client = createMockClient() as unknown as Client;
    const messages = [
      createTestMessage({ id: 1 }),
      createTestMessage({ id: 2 }),
      createTestMessage({ id: 3 }),
    ];
    const collection = new PrivateMessageCollection(client, messages);

    expect(collection.length).toBe(3);
  });
});

describe('PrivateMessageInbox', () => {
  test('Can create Inbox', () => {
    const client = createMockClient() as unknown as Client;
    const inbox = new PrivateMessageInbox(client);

    expect(inbox).toBeInstanceOf(PrivateMessageCollection);
    expect(inbox.length).toBe(0);
  });

  test('Can initialize with messages', () => {
    const client = createMockClient() as unknown as Client;
    const messages = [createTestMessage({ id: 1 }), createTestMessage({ id: 2 })];
    const inbox = new PrivateMessageInbox(client, messages);

    expect(inbox.length).toBe(2);
  });
});

describe('PrivateMessageSentBox', () => {
  test('Can create SentBox', () => {
    const client = createMockClient() as unknown as Client;
    const sentBox = new PrivateMessageSentBox(client);

    expect(sentBox).toBeInstanceOf(PrivateMessageCollection);
    expect(sentBox.length).toBe(0);
  });

  test('Can initialize with messages', () => {
    const client = createMockClient() as unknown as Client;
    const messages = [createTestMessage({ id: 1 }), createTestMessage({ id: 2 })];
    const sentBox = new PrivateMessageSentBox(client, messages);

    expect(sentBox.length).toBe(2);
  });
});

describe('PrivateMessageCollection bulk operations (P5)', () => {
  test('markAsRead uses selected[] (setAsReaded event)', async () => {
    const mockAmc = new MockAMCClient();
    const client = createFullMockClient(mockAmc);

    const result = await PrivateMessageCollection.markAsRead(client, [1, 2, 3]);

    expect(result.isOk()).toBe(true);
    const [body] = mockAmc.getRequestHistory();
    expect(body?.action).toBe('DashboardMessageAction');
    expect(body?.event).toBe('setAsReaded');
    expect(body?.selected).toEqual([1, 2, 3]);
  });

  test('markAsUnread uses selected[] (setAsUnreaded event)', async () => {
    const mockAmc = new MockAMCClient();
    const client = createFullMockClient(mockAmc);

    await PrivateMessageCollection.markAsUnread(client, [1, 2]);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('setAsUnreaded');
    expect(body?.selected).toEqual([1, 2]);
  });

  test('removeMessages uses messages[] (not selected[])', async () => {
    const mockAmc = new MockAMCClient();
    const client = createFullMockClient(mockAmc);

    await PrivateMessageCollection.removeMessages(client, [4, 5]);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('removeMessages');
    expect(body?.messages).toEqual([4, 5]);
  });
});

describe('PrivateMessage request methods (P5)', () => {
  test('saveDraft without recipient omits to_user_id', async () => {
    const mockAmc = new MockAMCClient();
    const client = createFullMockClient(mockAmc);

    await PrivateMessage.saveDraft(client, 'subj', 'body');

    const [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('saveDraft');
    expect(body && 'to_user_id' in body).toBe(false);
  });

  test('saveDraft with recipient includes to_user_id', async () => {
    const mockAmc = new MockAMCClient();
    const client = createFullMockClient(mockAmc);

    await PrivateMessage.saveDraft(client, 'subj', 'body', { id: 321 } as never);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.to_user_id).toBe(321);
  });

  test('checkCanSend sends DashboardMessageAction/checkCan', async () => {
    const mockAmc = new MockAMCClient();
    const client = createFullMockClient(mockAmc);

    const result = await PrivateMessage.checkCanSend(client, { id: 99 } as never);

    expect(result.isOk()).toBe(true);
    const [body] = mockAmc.getRequestHistory();
    expect(body?.action).toBe('DashboardMessageAction');
    expect(body?.event).toBe('checkCan');
    expect(body?.userId).toBe(99);
  });

  test('preview fetches DMPreviewModule and returns rendered html', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'dashboard/messages/DMPreviewModule'
        ? createOkResponse('<p>preview</p>')
        : createOkResponse()
    );
    const client = createFullMockClient(mockAmc);

    const result = await PrivateMessage.preview(client, 'subj', 'body');

    expect(result.isOk() && result.value).toBe('<p>preview</p>');
  });

  test('fetchReplyFormHtml sends replyMessageId', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'dashboard/messages/DMNewMessageModule'
        ? createOkResponse('<form></form>')
        : createOkResponse()
    );
    const client = createFullMockClient(mockAmc);

    const result = await PrivateMessage.fetchReplyFormHtml(client, 555);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.replyMessageId).toBe(555);
    expect(result.isOk() && result.value).toBe('<form></form>');
  });

  test('instance markAsRead/markAsUnread/delete delegate to the collection methods', async () => {
    const mockAmc = new MockAMCClient();
    const client = createFullMockClient(mockAmc);
    const message = new PrivateMessage({
      client,
      id: 777,
      subject: 's',
      body: 'b',
      sender: {} as never,
      recipient: {} as never,
      createdAt: new Date(),
    });

    await message.markAsRead();
    let [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('setAsReaded');
    expect(body?.selected).toEqual([777]);

    mockAmc.clearRequestHistory();
    await message.markAsUnread();
    [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('setAsUnreaded');

    mockAmc.clearRequestHistory();
    await message.delete();
    [body] = mockAmc.getRequestHistory();
    expect(body?.event).toBe('removeMessages');
    expect(body?.messages).toEqual([777]);
  });
});

describe('Invitations/applications/contacts module functions (P5)', () => {
  test('getInvitationsHtml fetches DMInvitationsModule', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'dashboard/messages/DMInvitationsModule'
        ? createOkResponse('<div>invitations</div>')
        : createOkResponse()
    );
    const client = createFullMockClient(mockAmc);

    const result = await getInvitationsHtml(client);

    expect(result.isOk() && result.value).toBe('<div>invitations</div>');
  });

  test('getInvitationDetailHtml sends item', async () => {
    const mockAmc = new MockAMCClient();
    const client = createFullMockClient(mockAmc);

    await getInvitationDetailHtml(client, 9);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.moduleName).toBe('dashboard/messages/DMViewInvitationModule');
    expect(body?.item).toBe(9);
  });

  test('getApplicationsHtml fetches DMApplicationsModule', async () => {
    const mockAmc = new MockAMCClient();
    const client = createFullMockClient(mockAmc);

    await getApplicationsHtml(client);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.moduleName).toBe('dashboard/messages/DMApplicationsModule');
  });

  test('getApplicationDetailHtml sends item', async () => {
    const mockAmc = new MockAMCClient();
    const client = createFullMockClient(mockAmc);

    await getApplicationDetailHtml(client, 3);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.moduleName).toBe('dashboard/messages/DMViewApplicationModule');
    expect(body?.item).toBe(3);
  });

  test('getContactsHtml fetches DMContactsModule', async () => {
    const mockAmc = new MockAMCClient();
    const client = createFullMockClient(mockAmc);

    await getContactsHtml(client);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.moduleName).toBe('dashboard/messages/DMContactsModule');
  });

  test('getContactsListHtml fetches DMContactsListModule', async () => {
    const mockAmc = new MockAMCClient();
    const client = createFullMockClient(mockAmc);

    await getContactsListHtml(client);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.moduleName).toBe('dashboard/messages/DMContactsListModule');
  });

  test('addContact sends ContactsAction/addContact', async () => {
    const mockAmc = new MockAMCClient();
    const client = createFullMockClient(mockAmc);

    await addContact(client, { id: 55 } as never);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.action).toBe('ContactsAction');
    expect(body?.event).toBe('addContact');
    expect(body?.userId).toBe(55);
  });

  test('removeContact sends ContactsAction/removeContact', async () => {
    const mockAmc = new MockAMCClient();
    const client = createFullMockClient(mockAmc);

    await removeContact(client, { id: 55 } as never);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.action).toBe('ContactsAction');
    expect(body?.event).toBe('removeContact');
  });

  test('addContactViaProfile fetches userinfo/UserAddToContactsModule', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === 'userinfo/UserAddToContactsModule'
        ? createOkResponse('<div>added</div>')
        : createOkResponse()
    );
    const client = createFullMockClient(mockAmc);

    const result = await addContactViaProfile(client, { id: 55 } as never);

    const [body] = mockAmc.getRequestHistory();
    expect(body?.userId).toBe(55);
    expect(result.isOk() && result.value).toBe('<div>added</div>');
  });
});
