/**
 * SearchPagesQueryのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import { DEFAULT_MODULE_BODY, DEFAULT_PER_PAGE, SearchPagesQuery } from '../../../src/module/page';

describe('SearchPagesQuery', () => {
  describe('コンストラクタ', () => {
    test('デフォルト値で初期化できる', () => {
      const query = new SearchPagesQuery({});

      expect(query.category).toBe('*');
      expect(query.pagetype).toBe('*');
      expect(query.order).toBe('created_at desc');
      expect(query.perPage).toBe(DEFAULT_PER_PAGE);
      expect(query.offset).toBe(0);
    });

    test('カテゴリを指定できる', () => {
      const query = new SearchPagesQuery({ category: '_default' });

      expect(query.category).toBe('_default');
    });

    test('タグを指定できる（文字列）', () => {
      const query = new SearchPagesQuery({ tags: 'scp' });

      expect(query.tags).toBe('scp');
    });

    test('タグを指定できる（配列）', () => {
      const query = new SearchPagesQuery({ tags: ['scp', 'safe'] });

      expect(query.tags).toEqual(['scp', 'safe']);
    });

    test('作成者を指定できる', () => {
      const query = new SearchPagesQuery({ createdBy: 'test-user' });

      expect(query.createdBy).toBe('test-user');
    });

    test('レーティングを指定できる', () => {
      const query = new SearchPagesQuery({ rating: '>10' });

      expect(query.rating).toBe('>10');
    });

    test('親ページを指定できる', () => {
      const query = new SearchPagesQuery({ parent: 'scp-001' });

      expect(query.parent).toBe('scp-001');
    });

    test('ソート順を指定できる', () => {
      const query = new SearchPagesQuery({ order: 'rating desc' });

      expect(query.order).toBe('rating desc');
    });

    test('オフセットを指定できる', () => {
      const query = new SearchPagesQuery({ offset: 100 });

      expect(query.offset).toBe(100);
    });

    test('リミットを指定できる', () => {
      const query = new SearchPagesQuery({ limit: 50 });

      expect(query.limit).toBe(50);
    });

    test('1ページあたりの件数を指定できる', () => {
      const query = new SearchPagesQuery({ perPage: 100 });

      expect(query.perPage).toBe(100);
    });
  });

  describe('asDict', () => {
    test('デフォルトクエリの辞書を生成できる', () => {
      const query = new SearchPagesQuery({});
      const dict = query.asDict();

      expect(dict.order).toBe('created_at desc');
      expect(dict.offset).toBe(0);
      expect(dict.perPage).toBe(DEFAULT_PER_PAGE);
    });

    test('タグ（文字列）を含む辞書を生成できる', () => {
      const query = new SearchPagesQuery({ tags: 'scp' });
      const dict = query.asDict();

      expect(dict.tags).toBe('scp');
    });

    test('タグ（配列）を含む辞書を生成できる', () => {
      const query = new SearchPagesQuery({ tags: ['scp', 'safe'] });
      const dict = query.asDict();

      expect(dict.tags).toBe('scp safe');
    });

    test('複数のタグをAND検索用に変換できる', () => {
      const query = new SearchPagesQuery({ tags: ['+scp', '+safe', '-euclid'] });
      const dict = query.asDict();

      expect(dict.tags).toBe('+scp +safe -euclid');
    });

    test('親ページを含む辞書を生成できる', () => {
      const query = new SearchPagesQuery({ parent: 'scp-001' });
      const dict = query.asDict();

      expect(dict.parent).toBe('scp-001');
    });

    test('レーティングを含む辞書を生成できる', () => {
      const query = new SearchPagesQuery({ rating: '>10' });
      const dict = query.asDict();

      expect(dict.rating).toBe('>10');
    });

    test('オフセットを含む辞書を生成できる', () => {
      const query = new SearchPagesQuery({ offset: 100 });
      const dict = query.asDict();

      expect(dict.offset).toBe(100);
    });

    test('リミットを含む辞書を生成できる', () => {
      const query = new SearchPagesQuery({ limit: 50 });
      const dict = query.asDict();

      expect(dict.limit).toBe(50);
    });
  });

  describe('エッジケース', () => {
    test('空のタグ配列はスペースで結合される', () => {
      const query = new SearchPagesQuery({ tags: [] });
      const dict = query.asDict();

      // 空配列は空文字列になる
      expect(dict.tags).toBe('');
    });

    test('undefinedのパラメータは含まれない', () => {
      const query = new SearchPagesQuery({});
      const dict = query.asDict();

      expect(dict.parent).toBeUndefined();
      expect(dict.rating).toBeUndefined();
      expect(dict.created_by).toBeUndefined();
    });
  });
});

describe('定数', () => {
  test('DEFAULT_PER_PAGEが正しい値', () => {
    expect(DEFAULT_PER_PAGE).toBe(250);
  });

  test('DEFAULT_MODULE_BODYが正しいフォーマット', () => {
    expect(DEFAULT_MODULE_BODY).toContain('fullname');
    expect(DEFAULT_MODULE_BODY).toContain('name');
    expect(DEFAULT_MODULE_BODY).toContain('category');
    expect(DEFAULT_MODULE_BODY).toContain('rating');
    expect(DEFAULT_MODULE_BODY).toContain('created_by_linked');
  });
});
