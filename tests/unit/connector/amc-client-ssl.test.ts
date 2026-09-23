/**
 * AMCClient.checkSiteSSL unit tests
 *
 * Wikidot switched http://<site>.wikidot.com/ from a 301 redirect to a 308 redirect
 * around 2026-09-22. checkSiteSSL must treat any redirect status (301/302/303/307/308)
 * to an https Location as SSL-supported.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { NotFoundException } from '../../../src/common/errors';
import { AMCClient } from '../../../src/connector/amc-client';
import type { AMCConfig } from '../../../src/connector/amc-config';
import { createHttpMock, type HttpMock } from '../../mocks/http.mock';

const SITE_URL = 'http://scp-jp.wikidot.com';

const FAST_CONFIG: AMCConfig = {
  timeout: 5000,
  retryLimit: 2,
  retryInterval: 0,
  backoffFactor: 2,
  maxBackoff: 1000,
  semaphoreLimit: 5,
};

let httpMock: HttpMock | undefined;

afterEach(() => {
  httpMock?.restore();
  httpMock = undefined;
});

describe('checkSiteSSL', () => {
  test('301 redirect to https is treated as SSL-supported', async () => {
    httpMock = createHttpMock();
    httpMock.addMock(
      { url: SITE_URL },
      { status: 301, headers: { Location: 'https://scp-jp.wikidot.com/' } }
    );

    const client = new AMCClient(FAST_CONFIG);
    const result = await client.checkSiteSSL('scp-jp');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(true);
    }
  });

  test('308 redirect to https is treated as SSL-supported', async () => {
    httpMock = createHttpMock();
    httpMock.addMock(
      { url: SITE_URL },
      { status: 308, headers: { Location: 'https://scp-jp.wikidot.com/' } }
    );

    const client = new AMCClient(FAST_CONFIG);
    const result = await client.checkSiteSSL('scp-jp');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(true);
    }
  });

  test('308 redirect to http (not https) is not treated as SSL-supported', async () => {
    httpMock = createHttpMock();
    httpMock.addMock(
      { url: SITE_URL },
      { status: 308, headers: { Location: 'http://scp-jp.wikidot.com/' } }
    );

    const client = new AMCClient(FAST_CONFIG);
    const result = await client.checkSiteSSL('scp-jp');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(false);
    }
  });

  test('200 (no redirect) is not treated as SSL-supported', async () => {
    httpMock = createHttpMock();
    httpMock.addMock({ url: SITE_URL }, { status: 200, body: '<html></html>' });

    const client = new AMCClient(FAST_CONFIG);
    const result = await client.checkSiteSSL('scp-jp');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(false);
    }
  });

  test('404 raises NotFoundException (site does not exist)', async () => {
    httpMock = createHttpMock();
    httpMock.addMock({ url: SITE_URL }, { status: 404, body: 'Not Found' });

    const client = new AMCClient(FAST_CONFIG);
    const result = await client.checkSiteSSL('scp-jp');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(NotFoundException);
    }
  });
});
