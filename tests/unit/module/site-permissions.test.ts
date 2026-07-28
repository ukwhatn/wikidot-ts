/**
 * site-permissions module unit tests
 */
import { describe, expect, test } from 'bun:test';
import {
  ForumPermissions,
  PagePermissions,
  RatingSettings,
} from '../../../src/module/site/site-permissions';

describe('PagePermissions', () => {
  const RAW = 'v:armo;c:m;e:m;m:m;d:m;a:m;r:m;z:m;o:rm';

  test('decode extracts each field', () => {
    const perms = PagePermissions.decode(RAW);
    expect([...perms.view].sort()).toEqual(['anonymous', 'author', 'member', 'registered']);
    expect([...perms.create]).toEqual(['member']);
    expect([...perms.showOptions].sort()).toEqual(['member', 'registered']);
    expect(perms.unknown).toEqual([]);
  });

  test('round trip', () => {
    expect(PagePermissions.decode(RAW).encode()).toBe(RAW);
  });

  test('unknown perm letter is preserved through round trip', () => {
    const raw = 'v:armo;x:ar';
    const perms = PagePermissions.decode(raw);
    expect(perms.unknown).toEqual(['x:ar']);
    expect(perms.encode().endsWith('x:ar')).toBe(true);
  });

  test('unknown actor symbol in a known perm letter is preserved as a whole segment', () => {
    const perms = PagePermissions.decode('v:arq');
    expect(perms.unknown).toEqual(['v:arq']);
    expect(perms.view.size).toBe(0);
  });

  test('validate reports no violations for a consistent permission set', () => {
    expect(PagePermissions.decode(RAW).validate()).toEqual([]);
  });

  test('validate flags anonymous without registered/member', () => {
    const perms = new PagePermissions({ view: ['anonymous'] });
    const violations = perms.validate();
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('view');
  });

  test('validate flags registered without member', () => {
    const perms = new PagePermissions({ view: ['registered'] });
    expect(perms.validate().length).toBe(1);
  });

  test('empty string round trips to all-empty permissions', () => {
    const perms = PagePermissions.decode('');
    expect(perms.encode()).toBe('v:;c:;e:;m:;d:;a:;r:;z:;o:');
  });

  test('withUpdates replaces only the specified field', () => {
    const base = PagePermissions.decode(RAW);
    const updated = base.withUpdates({ view: ['anonymous'] });
    expect([...updated.view]).toEqual(['anonymous']);
    expect(updated.create).toEqual(base.create);
  });
});

describe('ForumPermissions', () => {
  const RAW = 't:m;p:armo;e:m';

  test('round trip', () => {
    expect(ForumPermissions.decode(RAW).encode()).toBe(RAW);
  });

  test('unknown "s" symbol is preserved through round trip', () => {
    const raw = 't:m;p:armo;e:m;s:ar';
    const perms = ForumPermissions.decode(raw);
    expect(perms.unknown).toEqual(['s:ar']);
    expect(perms.encode()).toBe(raw);
  });
});

describe('RatingSettings', () => {
  test('decode drvM', () => {
    const rating = RatingSettings.decode('drvM');
    expect(rating.enabled).toBe(false);
    expect(rating.voters).toBe('registered');
    expect(rating.anonymous).toBe(false);
    expect(rating.kind).toBe('plusMinus');
  });

  test('round trip', () => {
    for (const raw of ['drvM', 'eraP', 'dmaS']) {
      expect(RatingSettings.decode(raw).encode()).toBe(raw);
    }
  });

  test('invalid length throws', () => {
    expect(() => RatingSettings.decode('drv')).toThrow();
  });

  test('invalid character throws', () => {
    expect(() => RatingSettings.decode('xrvM')).toThrow();
  });
});
