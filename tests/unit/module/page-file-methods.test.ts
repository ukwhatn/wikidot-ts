/**
 * PageFile / PageFileCollection P3 method unit tests
 * (rename/move/delete, checkExists, form fetchers, upload delegation)
 */
import { describe, expect, test } from 'bun:test';
import { errAsync, okAsync } from 'neverthrow';
import { UnexpectedError } from '../../../src/common/errors';
import type { AMCRequestBody, AMCResponse } from '../../../src/connector';
import type { Page } from '../../../src/module/page/page';
import { PageFile, PageFileCollection } from '../../../src/module/page/page-file';
import type { Site } from '../../../src/module/site';
import { TEST_SITE_DATA } from '../../setup';

type AmcRequestHandler = (bodies: AMCRequestBody[]) => ReturnType<Site['amcRequest']>;

function createMockSite(handler: AmcRequestHandler): { site: Site; calls: AMCRequestBody[][] } {
  const calls: AMCRequestBody[][] = [];
  const site = {
    id: TEST_SITE_DATA.id,
    unixName: TEST_SITE_DATA.unixName,
    domain: TEST_SITE_DATA.domain,
    sslSupported: TEST_SITE_DATA.sslSupported,
    client: {
      requireLogin: () => ({ isErr: () => false }),
      amcClient: {
        uploadFile: () => okAsync({ status: 'ok', filename: 'a.txt' }),
      },
    },
    amcRequest: (bodies: AMCRequestBody[]) => {
      calls.push(bodies);
      return handler(bodies);
    },
  } as unknown as Site;
  return { site, calls };
}

function queuedResponses(responses: AMCResponse[]): AmcRequestHandler {
  let callIndex = 0;
  return () => {
    const response = responses[callIndex];
    callIndex++;
    if (!response) {
      return errAsync(new UnexpectedError('No more mock responses queued'));
    }
    return okAsync([response]);
  };
}

function createMockPage(site: Site): Page {
  return {
    fullname: 'test-page',
    name: 'test-page',
    title: 'Test Page',
    id: 1,
    site,
  } as unknown as Page;
}

describe('PageFile forms', () => {
  test('getRenameForm returns the body', async () => {
    const { site } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<form>rename</form>' }])
    );
    const page = createMockPage(site);
    const file = new PageFile({ page, id: 1, name: 'a.txt', url: '', mimeType: '', size: 0 });

    const result = await file.getRenameForm();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe('<form>rename</form>');
  });

  test('getMoveForm returns the body', async () => {
    const { site } = createMockSite(queuedResponses([{ status: 'ok', body: '<form>move</form>' }]));
    const page = createMockPage(site);
    const file = new PageFile({ page, id: 1, name: 'a.txt', url: '', mimeType: '', size: 0 });

    const result = await file.getMoveForm();

    expect(result.isOk()).toBe(true);
  });

  test('getInfo returns the body', async () => {
    const { site } = createMockSite(queuedResponses([{ status: 'ok', body: '<div>info</div>' }]));
    const page = createMockPage(site);
    const file = new PageFile({ page, id: 1, name: 'a.txt', url: '', mimeType: '', size: 0 });

    const result = await file.getInfo();

    expect(result.isOk()).toBe(true);
  });
});

describe('PageFile.rename / move / delete', () => {
  test('rename updates name and sends renameFile', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createMockPage(site);
    const file = new PageFile({ page, id: 1, name: 'old.txt', url: '', mimeType: '', size: 0 });

    const result = await file.rename('new.txt');

    expect(result.isOk()).toBe(true);
    expect(file.name).toBe('new.txt');
    expect(calls[0]?.[0]?.event).toBe('renameFile');
    expect(calls[0]?.[0]?.new_name).toBe('new.txt');
    expect(calls[0]?.[0]?.force).toBeUndefined();
  });

  test('rename sends force=true when requested', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createMockPage(site);
    const file = new PageFile({ page, id: 1, name: 'old.txt', url: '', mimeType: '', size: 0 });

    await file.rename('new.txt', { force: true });

    expect(calls[0]?.[0]?.force).toBe('true');
  });

  test('move sends moveFile with destination', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createMockPage(site);
    const file = new PageFile({ page, id: 1, name: 'a.txt', url: '', mimeType: '', size: 0 });

    const result = await file.move('other-page');

    expect(result.isOk()).toBe(true);
    expect(calls[0]?.[0]?.event).toBe('moveFile');
    expect(calls[0]?.[0]?.destination_page_name).toBe('other-page');
  });

  test('delete requires confirm', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createMockPage(site);
    const file = new PageFile({ page, id: 1, name: 'a.txt', url: '', mimeType: '', size: 0 });

    const result = await file.delete();

    expect(result.isErr()).toBe(true);
    expect(calls.length).toBe(0);
  });

  test('delete with confirm sends deleteFile', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createMockPage(site);
    const file = new PageFile({ page, id: 1, name: 'a.txt', url: '', mimeType: '', size: 0 });

    const result = await file.delete({ confirm: true });

    expect(result.isOk()).toBe(true);
    expect(calls[0]?.[0]?.action).toBe('FileAction');
    expect(calls[0]?.[0]?.event).toBe('deleteFile');
    expect(calls[0]?.[0]?.file_id).toBe(1);
  });
});

describe('PageFileCollection static actions', () => {
  test('checkExists returns true', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok', exists: true }]));
    const page = createMockPage(site);

    const result = await PageFileCollection.checkExists(page, 'a.txt');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe(true);
    expect(calls[0]?.[0]?.event).toBe('checkFileExists');
    expect(calls[0]?.[0]?.filename).toBe('a.txt');
  });

  test('getUploadForm returns the body', async () => {
    const { site } = createMockSite(queuedResponses([{ status: 'ok', body: '<form></form>' }]));
    const page = createMockPage(site);

    const result = await PageFileCollection.getUploadForm(page);

    expect(result.isOk()).toBe(true);
  });

  test('getManager returns the body', async () => {
    const { site } = createMockSite(
      queuedResponses([{ status: 'ok', body: '<div>manager</div>' }])
    );
    const page = createMockPage(site);

    const result = await PageFileCollection.getManager(page);

    expect(result.isOk()).toBe(true);
  });

  test('multiUploadComplete sends fnames as a JSON array', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const page = createMockPage(site);

    const result = await PageFileCollection.multiUploadComplete(page, 'mk-1', ['a.txt', 'b.txt']);

    expect(result.isOk()).toBe(true);
    expect(calls[0]?.[0]?.event).toBe('multiUploadComplete');
    expect(calls[0]?.[0]?.multikey).toBe('mk-1');
    expect(JSON.parse(String(calls[0]?.[0]?.fnames))).toEqual(['a.txt', 'b.txt']);
  });

  test('upload delegates to amcClient.uploadFile', async () => {
    const { site } = createMockSite(queuedResponses([]));
    const page = createMockPage(site);

    const result = await PageFileCollection.upload(page, 'a.txt', new Uint8Array([1, 2, 3]));

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual({ status: 'ok', filename: 'a.txt' });
  });
});
