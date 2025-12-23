/**
 * 共通型のユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import { UnexpectedError } from '../../../src/common/errors';
import { fromPromise, wdErr, wdErrAsync, wdOk, wdOkAsync } from '../../../src/common/types';

describe('WikidotResult', () => {
  describe('wdOk', () => {
    test('成功結果を作成できる', () => {
      const result = wdOk('success');

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
      expect(result.value).toBe('success');
    });

    test('様々な型の値を包める', () => {
      const numResult = wdOk(42);
      const objResult = wdOk({ key: 'value' });
      const arrResult = wdOk([1, 2, 3]);

      expect(numResult.value).toBe(42);
      expect(objResult.value).toEqual({ key: 'value' });
      expect(arrResult.value).toEqual([1, 2, 3]);
    });
  });

  describe('wdErr', () => {
    test('エラー結果を作成できる', () => {
      const error = new UnexpectedError('test error');
      const result = wdErr(error);

      expect(result.isOk()).toBe(false);
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe(error);
    });
  });
});

describe('WikidotResultAsync', () => {
  describe('wdOkAsync', () => {
    test('非同期成功結果を作成できる', async () => {
      const result = await wdOkAsync('async success');

      expect(result.isOk()).toBe(true);
      expect(result.value).toBe('async success');
    });
  });

  describe('wdErrAsync', () => {
    test('非同期エラー結果を作成できる', async () => {
      const error = new UnexpectedError('async error');
      const result = await wdErrAsync(error);

      expect(result.isErr()).toBe(true);
      expect(result.error).toBe(error);
    });
  });

  describe('fromPromise', () => {
    test('成功するPromiseをラップできる', async () => {
      const promise = Promise.resolve('resolved');
      const result = await fromPromise(promise, (e) => new UnexpectedError(String(e)));

      expect(result.isOk()).toBe(true);
      expect(result.value).toBe('resolved');
    });

    test('失敗するPromiseをラップできる', async () => {
      const promise = Promise.reject(new Error('rejected'));
      const result = await fromPromise(promise, (e) => new UnexpectedError(String(e)));

      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(UnexpectedError);
      expect(result.error.message).toContain('rejected');
    });

    test('エラーマッパーでカスタムエラーを返せる', async () => {
      const promise = Promise.reject(new Error('original'));
      const result = await fromPromise(promise, () => new UnexpectedError('custom error message'));

      expect(result.isErr()).toBe(true);
      expect(result.error.message).toBe('custom error message');
    });
  });
});

describe('Result チェーン', () => {
  test('mapで値を変換できる', async () => {
    const result = await wdOkAsync(10);
    const mapped = result.map((v) => v * 2);

    expect(mapped.isOk()).toBe(true);
    expect(mapped.value).toBe(20);
  });

  test('エラー時はmapをスキップする', async () => {
    const result = await wdErrAsync(new UnexpectedError('error'));
    const mapped = result.map((v: number) => v * 2);

    expect(mapped.isErr()).toBe(true);
    expect(mapped.error.message).toBe('error');
  });
});
