/**
 * 文字列ユーティリティのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import { toUnix } from '../../../src/util/string-util';

describe('toUnix', () => {
  describe('基本的な変換', () => {
    test('小文字に変換される', () => {
      expect(toUnix('ABC')).toBe('abc');
      expect(toUnix('HeLLo')).toBe('hello');
    });

    test('空白がハイフンに変換される', () => {
      expect(toUnix('hello world')).toBe('hello-world');
      expect(toUnix('hello  world')).toBe('hello-world');
    });

    test('特殊文字がハイフンに変換される', () => {
      expect(toUnix('hello@world')).toBe('hello-world');
      expect(toUnix('hello#world')).toBe('hello-world');
    });

    test('連続するハイフンが単一に変換される', () => {
      expect(toUnix('hello---world')).toBe('hello-world');
      expect(toUnix('hello--world')).toBe('hello-world');
    });

    test('先頭と末尾のハイフンが削除される', () => {
      expect(toUnix('-hello-')).toBe('hello');
      expect(toUnix('---hello---')).toBe('hello');
    });
  });

  describe('コロンの処理', () => {
    test('コロンは保持される', () => {
      expect(toUnix('category:page')).toBe('category:page');
    });

    test('連続するコロンが単一に変換される', () => {
      expect(toUnix('category::page')).toBe('category:page');
    });

    test('先頭と末尾のコロンが削除される', () => {
      expect(toUnix(':hello:')).toBe('hello');
    });

    test('コロンとハイフンの組み合わせ', () => {
      expect(toUnix('category:-page')).toBe('category:page');
      expect(toUnix('category-:page')).toBe('category:page');
    });
  });

  describe('アンダースコアの処理', () => {
    test('先頭のアンダースコアは保持される', () => {
      expect(toUnix('_default')).toBe('_default');
    });

    test('途中のアンダースコアはハイフンに変換される', () => {
      expect(toUnix('hello_world')).toBe('hello-world');
    });

    test('コロン後のアンダースコアは保持される', () => {
      expect(toUnix('cat:_private')).toBe('cat:_private');
    });

    test('アンダースコアとハイフンの組み合わせ', () => {
      expect(toUnix('hello_-world')).toBe('hello-world');
      expect(toUnix('hello-_world')).toBe('hello-world');
    });
  });

  describe('特殊文字の変換', () => {
    test('ラテン拡張文字がASCIIに変換される', () => {
      expect(toUnix('café')).toBe('cafe');
      expect(toUnix('naïve')).toBe('naive');
      expect(toUnix('résumé')).toBe('resume');
    });

    test('ドイツ語の特殊文字が変換される', () => {
      expect(toUnix('größe')).toBe('groesse');
      expect(toUnix('Über')).toBe('ueber');
    });

    test('ギリシャ文字が変換される', () => {
      expect(toUnix('αβγ')).toBe('avg');
      expect(toUnix('Ωμεγα')).toBe('omega');
    });

    test('キリル文字が変換される', () => {
      expect(toUnix('привет')).toBe('privet');
    });
  });

  describe('ページ名の実例', () => {
    test('SCP記事名', () => {
      expect(toUnix('SCP-173')).toBe('scp-173');
      expect(toUnix('SCP-001')).toBe('scp-001');
    });

    test('日本語混じりのページ名（非ASCII文字は削除される）', () => {
      expect(toUnix('日本語ページ')).toBe('');
    });

    test('カテゴリ付きページ名', () => {
      expect(toUnix('fragment:scp-173-1')).toBe('fragment:scp-173-1');
    });
  });

  describe('エッジケース', () => {
    test('空文字列', () => {
      expect(toUnix('')).toBe('');
    });

    test('数字のみ', () => {
      expect(toUnix('12345')).toBe('12345');
    });

    test('ハイフンのみ', () => {
      expect(toUnix('---')).toBe('');
    });

    test('コロンのみ', () => {
      expect(toUnix(':::')).toBe('');
    });
  });
});
