/**
 * PrivateMessageモジュールのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import type { Client } from '../../../src/module/client';
import {
  PrivateMessage,
  PrivateMessageCollection,
  PrivateMessageInbox,
  PrivateMessageSentBox,
} from '../../../src/module/private-message/private-message';
import type { ClientRef } from '../../../src/module/types';
import { User } from '../../../src/module/user/user';

/**
 * モッククライアント作成
 */
function createMockClient(): ClientRef {
  return {
    requireLogin: () => ({ isErr: () => false }),
    isLoggedIn: () => true,
  };
}

/**
 * テスト用ユーザー作成
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
 * テスト用メッセージ作成
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

describe('PrivateMessageデータクラス', () => {
  describe('基本プロパティ', () => {
    test('toString()が正しい文字列を返す', () => {
      const message = createTestMessage();

      const result = message.toString();

      expect(result).toContain('PrivateMessage(');
      expect(result).toContain('id=1001');
      expect(result).toContain('subject=Test Subject');
    });

    test('idが正しく設定される', () => {
      const message = createTestMessage({ id: 9999 });

      expect(message.id).toBe(9999);
    });

    test('subjectが正しく設定される', () => {
      const message = createTestMessage({ subject: 'Custom Subject' });

      expect(message.subject).toBe('Custom Subject');
    });

    test('bodyが正しく設定される', () => {
      const message = createTestMessage({ body: 'Custom body text' });

      expect(message.body).toBe('Custom body text');
    });

    test('senderが正しく設定される', () => {
      const sender = createMockUser('TestSender');
      const message = createTestMessage({ sender });

      expect(message.sender.name).toBe('TestSender');
    });

    test('recipientが正しく設定される', () => {
      const recipient = createMockUser('TestRecipient');
      const message = createTestMessage({ recipient });

      expect(message.recipient.name).toBe('TestRecipient');
    });
  });
});

describe('PrivateMessageCollection', () => {
  test('空のコレクションを作成できる', () => {
    const client = createMockClient() as unknown as Client;
    const collection = new PrivateMessageCollection(client);

    expect(collection.length).toBe(0);
  });

  test('メッセージを追加できる', () => {
    const client = createMockClient() as unknown as Client;
    const collection = new PrivateMessageCollection(client);
    const message = createTestMessage();

    collection.push(message);

    expect(collection.length).toBe(1);
    expect(collection[0]).toBe(message);
  });

  test('複数メッセージで初期化できる', () => {
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
  test('Inboxを作成できる', () => {
    const client = createMockClient() as unknown as Client;
    const inbox = new PrivateMessageInbox(client);

    expect(inbox).toBeInstanceOf(PrivateMessageCollection);
    expect(inbox.length).toBe(0);
  });

  test('メッセージ付きで初期化できる', () => {
    const client = createMockClient() as unknown as Client;
    const messages = [createTestMessage({ id: 1 }), createTestMessage({ id: 2 })];
    const inbox = new PrivateMessageInbox(client, messages);

    expect(inbox.length).toBe(2);
  });
});

describe('PrivateMessageSentBox', () => {
  test('SentBoxを作成できる', () => {
    const client = createMockClient() as unknown as Client;
    const sentBox = new PrivateMessageSentBox(client);

    expect(sentBox).toBeInstanceOf(PrivateMessageCollection);
    expect(sentBox.length).toBe(0);
  });

  test('メッセージ付きで初期化できる', () => {
    const client = createMockClient() as unknown as Client;
    const messages = [createTestMessage({ id: 1 }), createTestMessage({ id: 2 })];
    const sentBox = new PrivateMessageSentBox(client, messages);

    expect(sentBox.length).toBe(2);
  });
});
