/**
 * AMCClient no_permission unit tests (end-to-end via HttpMock)
 *
 * Wikidot returns refusals as a normal 200 response with status: "no_permission"
 * and explains the reason in `message`. These verify the reason reaches ForbiddenError.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { ForbiddenError } from '../../../src/common/errors';
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

async function requestWith(body: Record<string, unknown>) {
  httpMock = createHttpMock();
  httpMock.addMock({ url: AMC_URL }, { status: 200, body });
  const client = new AMCClient(FAST_CONFIG);
  return client.request([{ moduleName: 'edit/PageEditModule', wiki_page: 'start' }], 'www');
}

describe('no_permission', () => {
  test('includes the message Wikidot returned', async () => {
    const result = await requestWith({
      status: 'no_permission',
      message: '  Sorry, you can not edit this page.  ',
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ForbiddenError);
      expect(result.error.message).toBe(
        'Your account has no permission to perform this action: moduleName: edit/PageEditModule (Sorry, you can not edit this page.)'
      );
    }
  });

  test('keeps the message unchanged when Wikidot returns no reason', async () => {
    for (const body of [{ status: 'no_permission' }, { status: 'no_permission', message: ' ' }]) {
      const result = await requestWith(body);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ForbiddenError);
        expect(result.error.message).toBe(
          'Your account has no permission to perform this action: moduleName: edit/PageEditModule'
        );
      }
      httpMock?.restore();
    }
  });

  test('keeps non-ASCII reasons as they are', async () => {
    const result = await requestWith({
      status: 'no_permission',
      message: 'このページは編集できません。',
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toEndWith('(このページは編集できません。)');
    }
  });
});
