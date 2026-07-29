/**
 * AMCClient form_errors payload unit tests (T0-1, end-to-end via HttpMock)
 *
 * Wikidot returns validation failures as a normal 200 response with
 * status: "form_errors"/"form_error", but the payload key differs by module
 * (formErrors / errors / message). These verify AMCClient surfaces all three
 * shapes through FormErrorsError.errors uniformly.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { FormErrorsError } from '../../../src/common/errors';
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

describe('form_errors payload (T0-1, end-to-end)', () => {
  test('surfaces formErrors via FormErrorsError.errors', async () => {
    httpMock = createHttpMock();
    httpMock.addMock(
      { url: AMC_URL },
      {
        status: 200,
        body: {
          status: 'form_errors',
          formErrors: { name: 'Please provide the site title' },
          message: 'Form errors',
        },
      }
    );

    const client = new AMCClient(FAST_CONFIG);
    const result = await client.request(
      [{ action: 'ManageSiteAction', event: 'saveGeneral', moduleName: 'Empty' }],
      'www'
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(FormErrorsError);
      expect((result.error as FormErrorsError).errors).toEqual({
        name: 'Please provide the site title',
      });
    }
  });

  test('surfaces errors via FormErrorsError.errors (WikiPageAction/savePage shape)', async () => {
    httpMock = createHttpMock();
    httpMock.addMock(
      { url: AMC_URL },
      { status: 200, body: { status: 'form_errors', errors: { title: 'Title is required' } } }
    );

    const client = new AMCClient(FAST_CONFIG);
    const result = await client.request(
      [{ action: 'WikiPageAction', event: 'savePage', moduleName: 'Empty' }],
      'www'
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr() && result.error instanceof FormErrorsError) {
      expect(result.error.errors).toEqual({ title: 'Title is required' });
    }
  });

  test('surfaces message via FormErrorsError.errors for singular form_error status', async () => {
    httpMock = createHttpMock();
    httpMock.addMock(
      { url: AMC_URL },
      { status: 200, body: { status: 'form_error', message: 'Tags could not be saved' } }
    );

    const client = new AMCClient(FAST_CONFIG);
    const result = await client.request(
      [{ action: 'WikiPageAction', event: 'saveTags', moduleName: 'Empty' }],
      'www'
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr() && result.error instanceof FormErrorsError) {
      expect(result.error.errors).toEqual({ _message: 'Tags could not be saved' });
    }
  });
});
