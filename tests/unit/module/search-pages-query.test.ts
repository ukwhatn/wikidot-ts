/**
 * SearchPagesQuery unit tests
 */
import { describe, expect, test } from 'bun:test';
import { DEFAULT_MODULE_BODY, DEFAULT_PER_PAGE, SearchPagesQuery } from '../../../src/module/page';

describe('SearchPagesQuery', () => {
  describe('Constructor', () => {
    test('Can initialize with default values', () => {
      const query = new SearchPagesQuery({});

      expect(query.category).toBe('*');
      expect(query.pagetype).toBe('*');
      expect(query.order).toBe('created_at desc');
      expect(query.perPage).toBe(DEFAULT_PER_PAGE);
      expect(query.offset).toBe(0);
    });

    test('Can specify category', () => {
      const query = new SearchPagesQuery({ category: '_default' });

      expect(query.category).toBe('_default');
    });

    test('Can specify tags (string)', () => {
      const query = new SearchPagesQuery({ tags: 'scp' });

      expect(query.tags).toBe('scp');
    });

    test('Can specify tags (array)', () => {
      const query = new SearchPagesQuery({ tags: ['scp', 'safe'] });

      expect(query.tags).toEqual(['scp', 'safe']);
    });

    test('Can specify createdBy', () => {
      const query = new SearchPagesQuery({ createdBy: 'test-user' });

      expect(query.createdBy).toBe('test-user');
    });

    test('Can specify rating', () => {
      const query = new SearchPagesQuery({ rating: '>10' });

      expect(query.rating).toBe('>10');
    });

    test('Can specify parent', () => {
      const query = new SearchPagesQuery({ parent: 'scp-001' });

      expect(query.parent).toBe('scp-001');
    });

    test('Can specify order', () => {
      const query = new SearchPagesQuery({ order: 'rating desc' });

      expect(query.order).toBe('rating desc');
    });

    test('Can specify offset', () => {
      const query = new SearchPagesQuery({ offset: 100 });

      expect(query.offset).toBe(100);
    });

    test('Can specify limit', () => {
      const query = new SearchPagesQuery({ limit: 50 });

      expect(query.limit).toBe(50);
    });

    test('Can specify perPage', () => {
      const query = new SearchPagesQuery({ perPage: 100 });

      expect(query.perPage).toBe(100);
    });
  });

  describe('asDict', () => {
    test('Can generate dictionary from default query', () => {
      const query = new SearchPagesQuery({});
      const dict = query.asDict();

      expect(dict.order).toBe('created_at desc');
      expect(dict.offset).toBe(0);
      expect(dict.perPage).toBe(DEFAULT_PER_PAGE);
    });

    test('Can generate dictionary with tags (string)', () => {
      const query = new SearchPagesQuery({ tags: 'scp' });
      const dict = query.asDict();

      expect(dict.tags).toBe('scp');
    });

    test('Can generate dictionary with tags (array)', () => {
      const query = new SearchPagesQuery({ tags: ['scp', 'safe'] });
      const dict = query.asDict();

      expect(dict.tags).toBe('scp safe');
    });

    test('Can convert multiple tags for AND search', () => {
      const query = new SearchPagesQuery({ tags: ['+scp', '+safe', '-euclid'] });
      const dict = query.asDict();

      expect(dict.tags).toBe('+scp +safe -euclid');
    });

    test('Can generate dictionary with parent', () => {
      const query = new SearchPagesQuery({ parent: 'scp-001' });
      const dict = query.asDict();

      expect(dict.parent).toBe('scp-001');
    });

    test('Can generate dictionary with rating', () => {
      const query = new SearchPagesQuery({ rating: '>10' });
      const dict = query.asDict();

      expect(dict.rating).toBe('>10');
    });

    test('Can generate dictionary with offset', () => {
      const query = new SearchPagesQuery({ offset: 100 });
      const dict = query.asDict();

      expect(dict.offset).toBe(100);
    });

    test('Can generate dictionary with limit', () => {
      const query = new SearchPagesQuery({ limit: 50 });
      const dict = query.asDict();

      expect(dict.limit).toBe(50);
    });
  });

  describe('Edge cases', () => {
    test('Empty tag array is joined with space', () => {
      const query = new SearchPagesQuery({ tags: [] });
      const dict = query.asDict();

      // Empty array becomes empty string
      expect(dict.tags).toBe('');
    });

    test('Undefined parameters are not included', () => {
      const query = new SearchPagesQuery({});
      const dict = query.asDict();

      expect(dict.parent).toBeUndefined();
      expect(dict.rating).toBeUndefined();
      expect(dict.created_by).toBeUndefined();
    });
  });
});

describe('Constants', () => {
  test('DEFAULT_PER_PAGE has correct value', () => {
    expect(DEFAULT_PER_PAGE).toBe(250);
  });

  test('DEFAULT_MODULE_BODY has correct format', () => {
    expect(DEFAULT_MODULE_BODY).toContain('fullname');
    expect(DEFAULT_MODULE_BODY).toContain('name');
    expect(DEFAULT_MODULE_BODY).toContain('category');
    expect(DEFAULT_MODULE_BODY).toContain('rating');
    expect(DEFAULT_MODULE_BODY).toContain('created_by_linked');
  });
});
