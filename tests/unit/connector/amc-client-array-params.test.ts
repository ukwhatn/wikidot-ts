/**
 * AMCClient array parameter encoding unit tests (T0-4, end-to-end via HttpMock)
 *
 * The Wikidot frontend serializes array body values with jQuery.param's bracket
 * notation (key[]=v1&key[]=v2). AMCClient must match this on the wire.
 */
import { afterEach, describe, expect, test } from 'bun:test';
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

describe('array parameter bracket encoding (T0-4)', () => {
  test('encodes array body values as key[]=v1&key[]=v2', async () => {
    httpMock = createHttpMock();
    httpMock.addMock({ url: AMC_URL }, { status: 200, body: { status: 'ok', body: '' } });

    const client = new AMCClient(FAST_CONFIG);
    await client.request(
      [
        {
          moduleName: 'Empty',
          action: 'DashboardMessageAction',
          event: 'setAsReaded',
          selected: [1, 2, 3],
        },
      ],
      'www'
    );

    const [sentRequest] = httpMock.getRequestHistory();
    const sentBody = String(sentRequest?.options?.body ?? '');
    const parsed = new URLSearchParams(sentBody);

    expect(parsed.getAll('selected[]')).toEqual(['1', '2', '3']);
    expect(parsed.has('selected')).toBe(false);
  });

  test('leaves scalar values unaffected', async () => {
    httpMock = createHttpMock();
    httpMock.addMock({ url: AMC_URL }, { status: 200, body: { status: 'ok', body: '' } });

    const client = new AMCClient(FAST_CONFIG);
    await client.request([{ moduleName: 'viewsource/ViewSourceModule', page_id: 12345 }], 'www');

    const [sentRequest] = httpMock.getRequestHistory();
    const sentBody = String(sentRequest?.options?.body ?? '');
    const parsed = new URLSearchParams(sentBody);

    expect(parsed.get('page_id')).toBe('12345');
  });
});
