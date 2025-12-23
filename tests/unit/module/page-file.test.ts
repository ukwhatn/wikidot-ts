/**
 * PageFileモジュールのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import type { Page } from '../../../src/module/page/page';
import { PageFile, PageFileCollection } from '../../../src/module/page/page-file';
import type { SiteRef } from '../../../src/module/types';
import { MockAMCClient } from '../../mocks/amc-client.mock';
import { TEST_SITE_DATA } from '../../setup';

/**
 * テスト用サイト作成
 */
function createMockSite(): SiteRef {
  const _amcClient = new MockAMCClient();
  return {
    id: TEST_SITE_DATA.id,
    unixName: TEST_SITE_DATA.unixName,
    domain: TEST_SITE_DATA.domain,
    sslSupported: TEST_SITE_DATA.sslSupported,
    client: {
      requireLogin: () => ({ isErr: () => false }),
      isLoggedIn: () => false,
    },
    amcRequest: () => {
      throw new Error('Not implemented');
    },
    amcRequestSingle: () => {
      throw new Error('Not implemented');
    },
  };
}

/**
 * テスト用ページモック作成
 */
function createMockPage(): Page {
  return {
    fullname: 'test-page',
    name: 'test-page',
    title: 'Test Page',
    site: createMockSite(),
  } as unknown as Page;
}

/**
 * テスト用ファイル作成
 */
function createTestFile(
  options: {
    id?: number;
    name?: string;
    url?: string;
    size?: number;
    mimeType?: string;
    page?: Page;
  } = {}
): PageFile {
  const page = options.page ?? createMockPage();
  return new PageFile({
    page,
    id: options.id ?? 50001,
    name: options.name ?? 'test-file.png',
    url: options.url ?? 'https://example.com/files/test-file.png',
    size: options.size ?? 1024,
    mimeType: options.mimeType ?? 'image/png',
  });
}

describe('PageFileデータクラス', () => {
  describe('基本プロパティ', () => {
    test('toString()が正しい文字列を返す', () => {
      const file = createTestFile();

      const result = file.toString();

      expect(result).toContain('PageFile(');
      expect(result).toContain('id=50001');
      expect(result).toContain('name=test-file.png');
    });

    test('idが正しく設定される', () => {
      const file = createTestFile({ id: 99999 });

      expect(file.id).toBe(99999);
    });

    test('nameが正しく設定される', () => {
      const file = createTestFile({ name: 'document.pdf' });

      expect(file.name).toBe('document.pdf');
    });

    test('urlが正しく設定される', () => {
      const file = createTestFile({ url: 'https://example.com/files/doc.pdf' });

      expect(file.url).toBe('https://example.com/files/doc.pdf');
    });

    test('sizeが正しく設定される', () => {
      const file = createTestFile({ size: 5000 });

      expect(file.size).toBe(5000);
    });

    test('mimeTypeが正しく設定される', () => {
      const file = createTestFile({ mimeType: 'application/pdf' });

      expect(file.mimeType).toBe('application/pdf');
    });
  });
});

describe('PageFileCollection', () => {
  test('空のコレクションを作成できる', () => {
    const page = createMockPage();
    const collection = new PageFileCollection(page);

    expect(collection.length).toBe(0);
  });

  test('ファイルを追加できる', () => {
    const page = createMockPage();
    const collection = new PageFileCollection(page);
    const file = createTestFile({ page });

    collection.push(file);

    expect(collection.length).toBe(1);
    expect(collection[0]).toBe(file);
  });

  test('複数ファイルで初期化できる', () => {
    const page = createMockPage();
    const files = [
      createTestFile({ name: 'file1.png', page }),
      createTestFile({ name: 'file2.pdf', page }),
      createTestFile({ name: 'file3.txt', page }),
    ];
    const collection = new PageFileCollection(page, files);

    expect(collection.length).toBe(3);
  });

  test('名前でファイルを検索できる', () => {
    const page = createMockPage();
    const files = [
      createTestFile({ name: 'image.png', page }),
      createTestFile({ name: 'document.pdf', page }),
    ];
    const collection = new PageFileCollection(page, files);

    const found = collection.findByName('document.pdf');

    expect(found).toBeDefined();
    expect(found?.name).toBe('document.pdf');
  });

  test('MIMEタイプでファイルをフィルタできる', () => {
    const page = createMockPage();
    const files = [
      createTestFile({ name: 'image1.png', mimeType: 'image/png', page }),
      createTestFile({ name: 'image2.jpg', mimeType: 'image/jpeg', page }),
      createTestFile({ name: 'doc.pdf', mimeType: 'application/pdf', page }),
    ];
    const collection = new PageFileCollection(page, files);

    const images = collection.filter((f) => f.mimeType.startsWith('image/'));

    expect(images.length).toBe(2);
  });
});
