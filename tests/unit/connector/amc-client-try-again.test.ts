/**
 * AMCClient try_again backoff unit tests (T0-2, end-to-end via HttpMock)
 *
 * Verifies AMCClient honors the server-supplied time_to_wait (seconds) instead of
 * always falling back to its own exponential backoff, and caps it at config.maxBackoff.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { WikidotStatusError } from '../../../src/common/errors';
import { AMCClient } from '../../../src/connector/amc-client';
import type { AMCConfig } from '../../../src/connector/amc-config';
import { createHttpMock, type HttpMock } from '../../mocks/http.mock';

const AMC_URL = 'https://www.wikidot.com/ajax-module-connector.php';

/** Fast config: near-zero delays so retry tests don't slow down the suite. */
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

describe('try_again backoff (T0-2)', () => {
  test('honors the server-supplied time_to_wait instead of exponential backoff', async () => {
    // retryInterval is deliberately large: if time_to_wait were ignored, this test
    // would take >=3s. time_to_wait says 50ms, so a fast completion proves it was honored.
    const config: AMCConfig = { ...FAST_CONFIG, retryInterval: 3000, maxBackoff: 10000 };
    httpMock = createHttpMock();
    httpMock.addSequentialMock({ url: AMC_URL }, [
      { status: 200, body: { status: 'try_again', time_to_wait: 0.05 } },
      { status: 200, body: { status: 'ok', body: '' } },
    ]);

    const client = new AMCClient(config);
    const start = Date.now();
    const result = await client.request([{ moduleName: 'some/Module' }], 'www');
    const elapsed = Date.now() - start;

    expect(result.isOk()).toBe(true);
    expect(elapsed).toBeLessThan(1000);
    expect(httpMock.getRequestHistory().length).toBe(2);
  });

  test('caps an oversized time_to_wait at config.maxBackoff', async () => {
    const config: AMCConfig = { ...FAST_CONFIG, retryInterval: 0, maxBackoff: 100 };
    httpMock = createHttpMock();
    httpMock.addSequentialMock({ url: AMC_URL }, [
      // A hostile/misbehaving time_to_wait of ~1h; must be capped, not honored verbatim.
      { status: 200, body: { status: 'try_again', time_to_wait: 3600 } },
      { status: 200, body: { status: 'ok', body: '' } },
    ]);

    const client = new AMCClient(config);
    const start = Date.now();
    const result = await client.request([{ moduleName: 'some/Module' }], 'www');
    const elapsed = Date.now() - start;

    expect(result.isOk()).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  test('falls back to exponential backoff when time_to_wait is absent (unchanged behavior)', async () => {
    httpMock = createHttpMock();
    httpMock.addSequentialMock({ url: AMC_URL }, [
      { status: 200, body: { status: 'try_again' } },
      { status: 200, body: { status: 'ok', body: '' } },
    ]);

    const client = new AMCClient(FAST_CONFIG);
    const result = await client.request([{ moduleName: 'some/Module' }], 'www');

    expect(result.isOk()).toBe(true);
    expect(httpMock.getRequestHistory().length).toBe(2);
  });

  test('exhausting retries on try_again returns WikidotStatusError with the raw response', async () => {
    httpMock = createHttpMock();
    httpMock.addMock({ url: AMC_URL }, { status: 200, body: { status: 'try_again' } });

    const client = new AMCClient(FAST_CONFIG);
    const result = await client.request([{ moduleName: 'some/Module' }], 'www');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(WikidotStatusError);
    }
  });
});
