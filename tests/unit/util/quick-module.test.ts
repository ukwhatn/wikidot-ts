/**
 * QuickModuleのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import { QuickModule } from '../../../src/util/quick-module';

describe('QuickModule', () => {
  describe('memberLookup', () => {
    test('関数が存在する', () => {
      expect(QuickModule.memberLookup).toBeDefined();
      expect(typeof QuickModule.memberLookup).toBe('function');
    });

    test('サイトIDとクエリを受け取る', () => {
      // メソッドのシグネチャをテスト
      const result = QuickModule.memberLookup(123456, 'test');

      // ResultAsyncを返す
      expect(result).toBeDefined();
      expect(typeof result.then).toBe('function');
    });
  });

  describe('userLookup', () => {
    test('関数が存在する', () => {
      expect(QuickModule.userLookup).toBeDefined();
      expect(typeof QuickModule.userLookup).toBe('function');
    });

    test('サイトIDとクエリを受け取る', () => {
      const result = QuickModule.userLookup(123456, 'test');

      expect(result).toBeDefined();
      expect(typeof result.then).toBe('function');
    });
  });

  describe('pageLookup', () => {
    test('関数が存在する', () => {
      expect(QuickModule.pageLookup).toBeDefined();
      expect(typeof QuickModule.pageLookup).toBe('function');
    });

    test('サイトIDとクエリを受け取る', () => {
      const result = QuickModule.pageLookup(123456, 'test');

      expect(result).toBeDefined();
      expect(typeof result.then).toBe('function');
    });
  });
});
