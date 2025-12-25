/**
 * User search integration tests
 */
import { describe, expect, test } from 'bun:test';
import { getClient } from './helpers/client';
import { shouldSkipIntegration } from './setup';

describe.skipIf(shouldSkipIntegration())('User Search Integration Tests', () => {
  test('1. Get user by username', async () => {
    const client = await getClient();
    const result = await client.user.get('ukwhatn');
    expect(result.isOk()).toBe(true);
    expect(result.value).not.toBeNull();
    expect(result.value!.name.toLowerCase()).toBe('ukwhatn');
  });

  test('2. Get non-existent user', async () => {
    const client = await getClient();
    const result = await client.user.get('nonexistent-user-12345678');
    expect(result.isOk()).toBe(true);
    expect(result.value).toBeNull();
  });

  test('3. Verify user properties', async () => {
    const client = await getClient();
    const result = await client.user.get('ukwhatn');
    expect(result.isOk()).toBe(true);

    const user = result.value!;
    expect(user.id).toBeDefined();
    expect(user.name).toBeDefined();
    expect(user.unixName).toBeDefined();
  });

  test('4. Get multiple users at once', async () => {
    const client = await getClient();
    const result = await client.user.getMany(['ukwhatn']);
    expect(result.isOk()).toBe(true);
    expect(result.value!.length).toBeGreaterThanOrEqual(1);
  });
});
