/**
 * AMCClient unit tests
 */
import { describe, expect, test } from 'bun:test';
import { AMCClient, maskSensitiveData } from '../../../src/connector/amc-client';
import { TEST_AMC_CONFIG } from '../../setup';

describe('AMCClient', () => {
  describe('Constructor', () => {
    test('Can create with default settings', () => {
      const client = new AMCClient();

      expect(client.domain).toBe('wikidot.com');
      expect(client.header).toBeDefined();
    });

    test('Can create with custom settings', () => {
      const client = new AMCClient(TEST_AMC_CONFIG, 'custom.wikidot.com');

      expect(client.domain).toBe('custom.wikidot.com');
      expect(client.config.timeout).toBe(TEST_AMC_CONFIG.timeout);
      expect(client.config.retryLimit).toBe(TEST_AMC_CONFIG.retryLimit);
    });
  });

  describe('Configuration', () => {
    test('Config is set correctly', () => {
      const client = new AMCClient(TEST_AMC_CONFIG);

      expect(client.config.timeout).toBe(5000);
      expect(client.config.retryLimit).toBe(2);
      expect(client.config.retryInterval).toBe(0);
      expect(client.config.backoffFactor).toBe(2);
      expect(client.config.maxBackoff).toBe(1000);
      expect(client.config.semaphoreLimit).toBe(5);
    });
  });

  describe('Header', () => {
    test('Header is initialized', () => {
      const client = new AMCClient();

      expect(client.header).toBeDefined();
      expect(typeof client.header.getHeaders).toBe('function');
    });
  });
});

describe('maskSensitiveData', () => {
  test('Password is masked', () => {
    const body = {
      moduleName: 'test',
      password: 'secret123',
    };

    const result = maskSensitiveData(body);

    expect(result.password).toBe('***MASKED***');
    expect(result.moduleName).toBe('test');
  });

  test('Login is masked', () => {
    const body = {
      moduleName: 'test',
      login: 'username',
    };

    const result = maskSensitiveData(body);

    expect(result.login).toBe('***MASKED***');
  });

  test('WIKIDOT_SESSION_ID is masked', () => {
    const body = {
      moduleName: 'test',
      WIKIDOT_SESSION_ID: 'session123',
    };

    const result = maskSensitiveData(body);

    expect(result.WIKIDOT_SESSION_ID).toBe('***MASKED***');
  });

  test('wikidot_token7 is masked', () => {
    const body = {
      moduleName: 'test',
      wikidot_token7: 'token123',
    };

    const result = maskSensitiveData(body);

    expect(result.wikidot_token7).toBe('***MASKED***');
  });

  test('Non-sensitive data is not masked', () => {
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

  test('Multiple sensitive data are masked at once', () => {
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
