/**
 * AMCClient.uploadFile unit tests (Task 3-5b)
 *
 * UNVERIFIED AGAINST A LIVE WIKIDOT INSTANCE -- see uploadFile's docstring.
 * These tests only verify request construction and response parsing
 * against a mocked HTTP layer.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { AMCClient } from '../../../src/connector/amc-client';
import type { AMCConfig } from '../../../src/connector/amc-config';
import { createHttpMock, type HttpMock } from '../../mocks/http.mock';

const UPLOAD_URL = 'https://test-site.wikidot.com/default--flow/files__UploadTarget';

const TEST_CONFIG: AMCConfig = {
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

describe('AMCClient.uploadFile', () => {
  test('parses status/message/filename from the HTML fragment response', async () => {
    httpMock = createHttpMock();
    httpMock.addMock(
      { url: UPLOAD_URL },
      {
        status: 200,
        body: '<div id="status">ok</div><div id="message">File uploaded.</div><div id="filename">a.txt</div>',
      }
    );

    const client = new AMCClient(TEST_CONFIG);
    const result = await client.uploadFile({
      pageId: 1,
      filename: 'a.txt',
      content: new Uint8Array([1, 2, 3]),
      siteName: 'test-site',
      siteSslSupported: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ status: 'ok', message: 'File uploaded.', filename: 'a.txt' });
    }
  });

  test('sends multipart fields matching the documented wire format', async () => {
    httpMock = createHttpMock();
    httpMock.addMock({ url: UPLOAD_URL }, { status: 200, body: '<div id="status">ok</div>' });

    const client = new AMCClient(TEST_CONFIG);
    await client.uploadFile({
      pageId: 42,
      filename: 'a.txt',
      content: new Uint8Array([1, 2, 3]),
      siteName: 'test-site',
      siteSslSupported: true,
      multikey: 'mk-1',
    });

    const request = httpMock.getRequestHistory()[0];
    const bodyText = String(request?.options?.body);
    expect(bodyText).toContain('name="action"');
    expect(bodyText).toContain('FileAction');
    expect(bodyText).toContain('name="event"');
    expect(bodyText).toContain('uploadFile');
    expect(bodyText).toContain('name="page_id"');
    expect(bodyText).toContain('42');
    expect(bodyText).toContain('name="source"');
    expect(bodyText).toContain('multiflash');
    expect(bodyText).toContain('name="multikey"');
    expect(bodyText).toContain('mk-1');
    expect(bodyText).toContain('name="userfile"; filename="a.txt"');
  });

  test('omits multikey when not provided', async () => {
    httpMock = createHttpMock();
    httpMock.addMock({ url: UPLOAD_URL }, { status: 200, body: '<div id="status">ok</div>' });

    const client = new AMCClient(TEST_CONFIG);
    await client.uploadFile({
      pageId: 1,
      filename: 'a.txt',
      content: new Uint8Array([1]),
      siteName: 'test-site',
      siteSslSupported: true,
    });

    const request = httpMock.getRequestHistory()[0];
    const bodyText = String(request?.options?.body);
    expect(bodyText).not.toContain('name="multikey"');
  });

  test('missing optional fields are absent from the parsed result', async () => {
    httpMock = createHttpMock();
    httpMock.addMock({ url: UPLOAD_URL }, { status: 200, body: '<div id="status">fail</div>' });

    const client = new AMCClient(TEST_CONFIG);
    const result = await client.uploadFile({
      pageId: 1,
      filename: 'a.txt',
      content: new Uint8Array([1]),
      siteName: 'test-site',
      siteSslSupported: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.status).toBe('fail');
      expect(result.value.message).toBeUndefined();
      expect(result.value.filename).toBeUndefined();
    }
  });
});
