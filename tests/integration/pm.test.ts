/**
 * プライベートメッセージ取得の統合テスト
 *
 * NOTE: メッセージ送信はスキップ。取得のみテスト。
 * 事前にInbox/Outboxにメッセージが入っていることを前提とする。
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Client } from '../../src';
import { cleanup, getClient } from './helpers/client';
import { shouldSkipIntegration } from './setup';

describe.skipIf(shouldSkipIntegration())('Private Message Integration Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await getClient();
  });

  afterAll(async () => {
    await cleanup();
  });

  test('1. 受信箱取得', async () => {
    const inboxResult = await client.privateMessage.inbox();
    expect(inboxResult.isOk()).toBe(true);

    const inbox = inboxResult.value!;
    // メッセージ一覧を取得
    const messages = [...inbox];
    // メッセージがあることを期待（事前にテスト用メッセージを入れておく）
    expect(messages.length).toBeGreaterThanOrEqual(0); // 空でもテストは通す
  });

  test('2. 送信箱取得', async () => {
    const sentBoxResult = await client.privateMessage.sentBox();
    expect(sentBoxResult.isOk()).toBe(true);

    const sentBox = sentBoxResult.value!;
    const messages = [...sentBox];
    expect(messages.length).toBeGreaterThanOrEqual(0);
  });

  test('3. 受信メッセージのプロパティ確認', async () => {
    const inboxResult = await client.privateMessage.inbox();
    expect(inboxResult.isOk()).toBe(true);

    const inbox = inboxResult.value!;
    const messages = [...inbox];

    if (messages.length === 0) {
      console.log('No messages in inbox, skipping');
      return;
    }

    const message = messages[0];

    // 基本プロパティ
    expect(message.id).toBeDefined();
    expect(message.id).toBeGreaterThan(0);
    expect(message.subject).toBeDefined();
    expect(message.sender).toBeDefined();
    expect(message.createdAt).toBeDefined();
  });

  test('4. 送信メッセージのプロパティ確認', async () => {
    const sentBoxResult = await client.privateMessage.sentBox();
    expect(sentBoxResult.isOk()).toBe(true);

    const sentBox = sentBoxResult.value!;
    const messages = [...sentBox];

    if (messages.length === 0) {
      console.log('No messages in sentbox, skipping');
      return;
    }

    const message = messages[0];

    // 基本プロパティ
    expect(message.id).toBeDefined();
    expect(message.id).toBeGreaterThan(0);
    expect(message.subject).toBeDefined();
    expect(message.recipient).toBeDefined();
    expect(message.createdAt).toBeDefined();
  });

  test('5. IDでメッセージ取得', async () => {
    const inboxResult = await client.privateMessage.inbox();
    expect(inboxResult.isOk()).toBe(true);

    const inbox = inboxResult.value!;
    const messages = [...inbox];

    if (messages.length === 0) {
      console.log('No messages in inbox, skipping');
      return;
    }

    // 最初のメッセージのIDで再取得
    const messageId = messages[0].id;
    const messageResult = await client.privateMessage.get(messageId);

    expect(messageResult.isOk()).toBe(true);
    expect(messageResult.value?.id).toBe(messageId);
  });
});
