/**
 * AMCClientのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import { AMCClient, maskSensitiveData } from '../../../src/connector/amc-client';
import { TEST_AMC_CONFIG } from '../../setup';

describe('AMCClient', () => {
  describe('コンストラクタ', () => {
    test('デフォルト設定で作成できる', () => {
      const client = new AMCClient();

      expect(client.domain).toBe('wikidot.com');
      expect(client.header).toBeDefined();
    });

    test('カスタム設定で作成できる', () => {
      const client = new AMCClient(TEST_AMC_CONFIG, 'custom.wikidot.com');

      expect(client.domain).toBe('custom.wikidot.com');
      expect(client.config.timeout).toBe(TEST_AMC_CONFIG.timeout);
      expect(client.config.retryLimit).toBe(TEST_AMC_CONFIG.retryLimit);
    });
  });

  describe('設定', () => {
    test('configが正しく設定される', () => {
      const client = new AMCClient(TEST_AMC_CONFIG);

      expect(client.config.timeout).toBe(5000);
      expect(client.config.retryLimit).toBe(2);
      expect(client.config.retryInterval).toBe(0);
      expect(client.config.backoffFactor).toBe(2);
      expect(client.config.maxBackoff).toBe(1000);
      expect(client.config.semaphoreLimit).toBe(5);
    });
  });

  describe('ヘッダー', () => {
    test('headerが初期化される', () => {
      const client = new AMCClient();

      expect(client.header).toBeDefined();
      expect(typeof client.header.getHeaders).toBe('function');
    });
  });
});

describe('maskSensitiveData', () => {
  test('passwordがマスクされる', () => {
    const body = {
      moduleName: 'test',
      password: 'secret123',
    };

    const result = maskSensitiveData(body);

    expect(result.password).toBe('***MASKED***');
    expect(result.moduleName).toBe('test');
  });

  test('loginがマスクされる', () => {
    const body = {
      moduleName: 'test',
      login: 'username',
    };

    const result = maskSensitiveData(body);

    expect(result.login).toBe('***MASKED***');
  });

  test('WIKIDOT_SESSION_IDがマスクされる', () => {
    const body = {
      moduleName: 'test',
      WIKIDOT_SESSION_ID: 'session123',
    };

    const result = maskSensitiveData(body);

    expect(result.WIKIDOT_SESSION_ID).toBe('***MASKED***');
  });

  test('wikidot_token7がマスクされる', () => {
    const body = {
      moduleName: 'test',
      wikidot_token7: 'token123',
    };

    const result = maskSensitiveData(body);

    expect(result.wikidot_token7).toBe('***MASKED***');
  });

  test('非機密データはマスクされない', () => {
    const body = {
      moduleName: 'test',
      page_id: 12345,
      action: 'someAction',
    };

    const result = maskSensitiveData(body);

    expect(result.moduleName).toBe('test');
    expect(result.page_id).toBe(12345);
    expect(result.action).toBe('someAction');
  });

  test('複数の機密データが同時にマスクされる', () => {
    const body = {
      moduleName: 'test',
      password: 'secret',
      login: 'user',
      wikidot_token7: 'token',
    };

    const result = maskSensitiveData(body);

    expect(result.password).toBe('***MASKED***');
    expect(result.login).toBe('***MASKED***');
    expect(result.wikidot_token7).toBe('***MASKED***');
    expect(result.moduleName).toBe('test');
  });
});
