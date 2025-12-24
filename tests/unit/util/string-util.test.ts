/**
 * String utility unit tests
 */
import { describe, expect, test } from 'bun:test';
import { toUnix } from '../../../src/util/string-util';

describe('toUnix', () => {
  describe('Basic conversion', () => {
    test('Converts to lowercase', () => {
      expect(toUnix('ABC')).toBe('abc');
      expect(toUnix('HeLLo')).toBe('hello');
    });

    test('Converts spaces to hyphens', () => {
      expect(toUnix('hello world')).toBe('hello-world');
      expect(toUnix('hello  world')).toBe('hello-world');
    });

    test('Converts special characters to hyphens', () => {
      expect(toUnix('hello@world')).toBe('hello-world');
      expect(toUnix('hello#world')).toBe('hello-world');
    });

    test('Converts consecutive hyphens to single', () => {
      expect(toUnix('hello---world')).toBe('hello-world');
      expect(toUnix('hello--world')).toBe('hello-world');
    });

    test('Removes leading and trailing hyphens', () => {
      expect(toUnix('-hello-')).toBe('hello');
      expect(toUnix('---hello---')).toBe('hello');
    });
  });

  describe('Colon handling', () => {
    test('Colons are preserved', () => {
      expect(toUnix('category:page')).toBe('category:page');
    });

    test('Converts consecutive colons to single', () => {
      expect(toUnix('category::page')).toBe('category:page');
    });

    test('Removes leading and trailing colons', () => {
      expect(toUnix(':hello:')).toBe('hello');
    });

    test('Colon and hyphen combination', () => {
      expect(toUnix('category:-page')).toBe('category:page');
      expect(toUnix('category-:page')).toBe('category:page');
    });
  });

  describe('Underscore handling', () => {
    test('Leading underscore is preserved', () => {
      expect(toUnix('_default')).toBe('_default');
    });

    test('Underscore in middle converts to hyphen', () => {
      expect(toUnix('hello_world')).toBe('hello-world');
    });

    test('Underscore after colon is preserved', () => {
      expect(toUnix('cat:_private')).toBe('cat:_private');
    });

    test('Underscore and hyphen combination', () => {
      expect(toUnix('hello_-world')).toBe('hello-world');
      expect(toUnix('hello-_world')).toBe('hello-world');
    });
  });

  describe('Special character conversion', () => {
    test('Latin extended characters convert to ASCII', () => {
      expect(toUnix('café')).toBe('cafe');
      expect(toUnix('naïve')).toBe('naive');
      expect(toUnix('résumé')).toBe('resume');
    });

    test('German special characters are converted', () => {
      expect(toUnix('größe')).toBe('groesse');
      expect(toUnix('Über')).toBe('ueber');
    });

    test('Greek letters are converted', () => {
      expect(toUnix('αβγ')).toBe('avg');
      expect(toUnix('Ωμεγα')).toBe('omega');
    });

    test('Cyrillic letters are converted', () => {
      expect(toUnix('привет')).toBe('privet');
    });
  });

  describe('Page name examples', () => {
    test('SCP article names', () => {
      expect(toUnix('SCP-173')).toBe('scp-173');
      expect(toUnix('SCP-001')).toBe('scp-001');
    });

    test('Page name with Japanese (non-ASCII characters are removed)', () => {
      expect(toUnix('日本語ページ')).toBe('');
    });

    test('Page name with category', () => {
      expect(toUnix('fragment:scp-173-1')).toBe('fragment:scp-173-1');
    });
  });

  describe('Edge cases', () => {
    test('Empty string', () => {
      expect(toUnix('')).toBe('');
    });

    test('Numbers only', () => {
      expect(toUnix('12345')).toBe('12345');
    });

    test('Hyphens only', () => {
      expect(toUnix('---')).toBe('');
    });

    test('Colons only', () => {
      expect(toUnix(':::')).toBe('');
    });
  });
});
