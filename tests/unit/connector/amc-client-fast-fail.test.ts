/**
 * AMCClient unknown action/event fast-failure unit tests (T0-3, end-to-end via HttpMock)
 *
 * Wikidot returns HTTP 500 with a 0-byte body (not even JSON) when `action` is set but
 * the event doesn't exist server-side (e.g. a typo). Retrying that is pointless, so
 * AMCClient should fail fast instead of burning the full retry budget. Ordinary 500s
 * (with a body, or with no `action` at all) must keep retrying as before.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { AMCHttpError } from '../../../src/common/errors';
import { AMCClient } from '../../../src/connector/amc-client';
import type { AMCConfig } from '../../../src/connector/amc-config';
import { createHttpMock, type HttpMock } from '../../mocks/http.mock';

const AMC_URL = 'https://www.wikidot.com/ajax-module-connector.php';

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

describe('unknown action/event fast failure (T0-3)', () => {
  test('does not retry on HTTP 500 + empty body when the request has an action', async () => {
    httpMock = createHttpMock();
    httpMock.addMock(
      { url: AMC_URL },
      { status: 500, body: '', headers: { 'content-length': '0' } }
    );

    const client = new AMCClient(FAST_CONFIG);
    const result = await client.request(
      [{ action: 'ManageSiteAction', event: 'noSuchEvent', moduleName: 'Empty' }],
      'www'
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(AMCHttpError);
    }
    // Fails fast: exactly one request, no retries burned on a non-transient failure.
    expect(httpMock.getRequestHistory().length).toBe(1);
  });

  test('still retries HTTP 500 + empty body when the request has no action (render-only)', async () => {
    httpMock = createHttpMock();
    httpMock.addMock(
      { url: AMC_URL },
      { status: 500, body: '', headers: { 'content-length': '0' } }
    );

    const client = new AMCClient(FAST_CONFIG);
    const result = await client.request(
      [{ moduleName: 'managesite/ManageSiteGeneralModule' }],
      'www'
    );

    expect(result.isErr()).toBe(true);
    // Retries exhausted normally (not fast-failed): retryLimit attempts were made.
    expect(httpMock.getRequestHistory().length).toBe(FAST_CONFIG.retryLimit);
  });

  test('still retries HTTP 500 with a non-empty body even when the request has an action', async () => {
    httpMock = createHttpMock();
    httpMock.addMock({ url: AMC_URL }, { status: 500, body: 'Internal Server Error' });

    const client = new AMCClient(FAST_CONFIG);
    const result = await client.request(
      [{ action: 'ManageSiteAction', event: 'saveGeneral', moduleName: 'Empty' }],
      'www'
    );

    expect(result.isErr()).toBe(true);
    // Wikidot spikes return 500 with a body sometimes; this must not be fast-failed.
    expect(httpMock.getRequestHistory().length).toBe(FAST_CONFIG.retryLimit);
  });
});
