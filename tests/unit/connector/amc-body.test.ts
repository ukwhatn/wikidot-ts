/**
 * AMC request body builder unit tests
 */
import { describe, expect, test } from 'bun:test';
import { checkbox, flag, jsonParam, omitFalsy } from '../../../src/connector/amc-body';

describe('omitFalsy', () => {
  test('drops keys whose value is false', () => {
    const result = omitFalsy({ enabled: false, name: 'foo' });

    expect(result).toEqual({ name: 'foo' });
    expect('enabled' in result).toBe(false);
  });

  test('drops keys whose value is null', () => {
    const result = omitFalsy({ parent: null, name: 'foo' });

    expect(result).toEqual({ name: 'foo' });
    expect('parent' in result).toBe(false);
  });

  test('drops keys whose value is undefined', () => {
    const result = omitFalsy({ comment: undefined, name: 'foo' });

    expect(result).toEqual({ name: 'foo' });
    expect('comment' in result).toBe(false);
  });

  test('keeps true, numbers, and non-empty strings as-is', () => {
    const result = omitFalsy({ enabled: true, count: 0, name: '' });

    expect(result).toEqual({ enabled: true, count: 0, name: '' });
  });

  test('does not mutate the input object', () => {
    const input = { enabled: false, name: 'foo' };
    omitFalsy(input);

    expect(input).toEqual({ enabled: false, name: 'foo' });
  });
});

describe('checkbox', () => {
  test('true encodes to "on" (formToArray checked behavior)', () => {
    expect(checkbox(true)).toBe('on');
  });

  test('false encodes to undefined (unchecked -> omitted key, not "false")', () => {
    expect(checkbox(false)).toBeUndefined();
  });

  test('null/undefined also encode to undefined', () => {
    expect(checkbox(null)).toBeUndefined();
    expect(checkbox(undefined)).toBeUndefined();
  });
});

describe('flag', () => {
  test('true encodes to "true" (hand-built request body behavior)', () => {
    expect(flag(true)).toBe('true');
  });

  test('false encodes to undefined (omitted, not "false")', () => {
    expect(flag(false)).toBeUndefined();
  });

  test('null/undefined also encode to undefined', () => {
    expect(flag(null)).toBeUndefined();
    expect(flag(undefined)).toBeUndefined();
  });
});

describe('jsonParam', () => {
  test('JSON-encodes an object', () => {
    expect(jsonParam({ a: 1, b: 'two' })).toBe('{"a":1,"b":"two"}');
  });

  test('JSON-encodes an array', () => {
    expect(jsonParam([1, 2, 3])).toBe('[1,2,3]');
  });
});
