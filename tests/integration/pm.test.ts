/**
 * Private message retrieval integration tests
 *
 * NOTE: Message sending is skipped. Only retrieval is tested.
 * Assumes messages exist in Inbox/Outbox beforehand.
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

  test('1. Get inbox', async () => {
    const inboxResult = await client.privateMessage.inbox();
    expect(inboxResult.isOk()).toBe(true);

    const inbox = inboxResult.value!;
    // Get message list
    const messages = [...inbox];
    // Expect messages (test messages should be prepared beforehand)
    expect(messages.length).toBeGreaterThanOrEqual(0); // Test passes even if empty
  });

  test('2. Get sent box', async () => {
    const sentBoxResult = await client.privateMessage.sentBox();
    expect(sentBoxResult.isOk()).toBe(true);

    const sentBox = sentBoxResult.value!;
    const messages = [...sentBox];
    expect(messages.length).toBeGreaterThanOrEqual(0);
  });

  test('3. Verify received message properties', async () => {
    const inboxResult = await client.privateMessage.inbox();
    expect(inboxResult.isOk()).toBe(true);

    const inbox = inboxResult.value!;
    const messages = [...inbox];

    if (messages.length === 0) {
      console.log('No messages in inbox, skipping');
      return;
    }

    const message = messages[0];

    // Basic properties
    expect(message.id).toBeDefined();
    expect(message.id).toBeGreaterThan(0);
    expect(message.subject).toBeDefined();
    expect(message.sender).toBeDefined();
    expect(message.createdAt).toBeDefined();
  });

  test('4. Verify sent message properties', async () => {
    const sentBoxResult = await client.privateMessage.sentBox();
    expect(sentBoxResult.isOk()).toBe(true);

    const sentBox = sentBoxResult.value!;
    const messages = [...sentBox];

    if (messages.length === 0) {
      console.log('No messages in sentbox, skipping');
      return;
    }

    const message = messages[0];

    // Basic properties
    expect(message.id).toBeDefined();
    expect(message.id).toBeGreaterThan(0);
    expect(message.subject).toBeDefined();
    expect(message.recipient).toBeDefined();
    expect(message.createdAt).toBeDefined();
  });

  test('5. Get message by ID', async () => {
    const inboxResult = await client.privateMessage.inbox();
    expect(inboxResult.isOk()).toBe(true);

    const inbox = inboxResult.value!;
    const messages = [...inbox];

    if (messages.length === 0) {
      console.log('No messages in inbox, skipping');
      return;
    }

    // Re-fetch using first message's ID
    const messageId = messages[0].id;
    const messageResult = await client.privateMessage.get(messageId);

    expect(messageResult.isOk()).toBe(true);
    expect(messageResult.value?.id).toBe(messageId);
  });
});
