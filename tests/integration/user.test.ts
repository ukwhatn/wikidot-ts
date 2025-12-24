/**
 * ユーザー検索の統合テスト
 */
import { describe, expect, test } from 'bun:test';
import { getClient } from './helpers/client';
import { shouldSkipIntegration } from './setup';

describe.skipIf(shouldSkipIntegration())('User Search Integration Tests', () => {
  test('1. ユーザー名でユーザー取得', async () => {
    const client = await getClient();
    const result = await client.user.get('ukwhatn');
    expect(result.isOk()).toBe(true);
    expect(result.value).not.toBeNull();
    expect(result.value!.name.toLowerCase()).toBe('ukwhatn');
  });

  test('2. 存在しないユーザー取得', async () => {
    const client = await getClient();
    const result = await client.user.get('nonexistent-user-12345678');
    expect(result.isOk()).toBe(true);
    expect(result.value).toBeNull();
  });

  test('3. ユーザープロパティ確認', async () => {
    const client = await getClient();
    const result = await client.user.get('ukwhatn');
    expect(result.isOk()).toBe(true);

    const user = result.value!;
    expect(user.id).toBeDefined();
    expect(user.name).toBeDefined();
    expect(user.unixName).toBeDefined();
  });

  test('4. 複数ユーザー一括取得', async () => {
    const client = await getClient();
    const result = await client.user.getMany(['ukwhatn']);
    expect(result.isOk()).toBe(true);
    expect(result.value!.length).toBeGreaterThanOrEqual(1);
  });
});
