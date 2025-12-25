/**
 * Common types unit tests
 */
import { describe, expect, test } from 'bun:test';
import { UnexpectedError } from '../../../src/common/errors';
import { fromPromise, wdErr, wdErrAsync, wdOk, wdOkAsync } from '../../../src/common/types';

describe('WikidotResult', () => {
  describe('wdOk', () => {
    test('Can create success result', () => {
      const result = wdOk('success');

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
      expect(result.value).toBe('success');
    });

    test('Can wrap various value types', () => {
      const numResult = wdOk(42);
      const objResult = wdOk({ key: 'value' });
      const arrResult = wdOk([1, 2, 3]);

      expect(numResult.value).toBe(42);
      expect(objResult.value).toEqual({ key: 'value' });
      expect(arrResult.value).toEqual([1, 2, 3]);
    });
  });

  describe('wdErr', () => {
    test('Can create error result', () => {
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
    test('Can create async success result', async () => {
      const result = await wdOkAsync('async success');

      expect(result.isOk()).toBe(true);
      expect(result.value).toBe('async success');
    });
  });

  describe('wdErrAsync', () => {
    test('Can create async error result', async () => {
      const error = new UnexpectedError('async error');
      const result = await wdErrAsync(error);

      expect(result.isErr()).toBe(true);
      expect(result.error).toBe(error);
    });
  });

  describe('fromPromise', () => {
    test('Can wrap resolving promise', async () => {
      const promise = Promise.resolve('resolved');
      const result = await fromPromise(promise, (e) => new UnexpectedError(String(e)));

      expect(result.isOk()).toBe(true);
      expect(result.value).toBe('resolved');
    });

    test('Can wrap rejecting promise', async () => {
      const promise = Promise.reject(new Error('rejected'));
      const result = await fromPromise(promise, (e) => new UnexpectedError(String(e)));

      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(UnexpectedError);
      expect(result.error.message).toContain('rejected');
    });

    test('Can return custom error via error mapper', async () => {
      const promise = Promise.reject(new Error('original'));
      const result = await fromPromise(promise, () => new UnexpectedError('custom error message'));

      expect(result.isErr()).toBe(true);
      expect(result.error.message).toBe('custom error message');
    });
  });
});

describe('Result chaining', () => {
  test('Can transform value with map', async () => {
    const result = await wdOkAsync(10);
    const mapped = result.map((v) => v * 2);

    expect(mapped.isOk()).toBe(true);
    expect(mapped.value).toBe(20);
  });

  test('Skips map on error', async () => {
    const result = await wdErrAsync(new UnexpectedError('error'));
    const mapped = result.map((v: number) => v * 2);

    expect(mapped.isErr()).toBe(true);
    expect(mapped.error.message).toBe('error');
  });
});
