/**
 * QuickModule unit tests
 */
import { describe, expect, test } from 'bun:test';
import { QuickModule } from '../../../src/util/quick-module';

describe('QuickModule', () => {
  describe('memberLookup', () => {
    test('Function exists', () => {
      expect(QuickModule.memberLookup).toBeDefined();
      expect(typeof QuickModule.memberLookup).toBe('function');
    });

    test('Accepts site ID and query', () => {
      // Test method signature
      const result = QuickModule.memberLookup(123456, 'test');

      // Returns ResultAsync
      expect(result).toBeDefined();
      expect(typeof result.then).toBe('function');
    });
  });

  describe('userLookup', () => {
    test('Function exists', () => {
      expect(QuickModule.userLookup).toBeDefined();
      expect(typeof QuickModule.userLookup).toBe('function');
    });

    test('Accepts site ID and query', () => {
      const result = QuickModule.userLookup(123456, 'test');

      expect(result).toBeDefined();
      expect(typeof result.then).toBe('function');
    });
  });

  describe('pageLookup', () => {
    test('Function exists', () => {
      expect(QuickModule.pageLookup).toBeDefined();
      expect(typeof QuickModule.pageLookup).toBe('function');
    });

    test('Accepts site ID and query', () => {
      const result = QuickModule.pageLookup(123456, 'test');

      expect(result).toBeDefined();
      expect(typeof result.then).toBe('function');
    });
  });
});
