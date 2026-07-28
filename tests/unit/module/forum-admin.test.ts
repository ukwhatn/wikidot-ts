/**
 * forum-admin.ts unit tests
 */
import { describe, expect, test } from 'bun:test';
import { errAsync, okAsync } from 'neverthrow';
import { ResponseDataError, UnexpectedError } from '../../../src/common/errors';
import type { AMCRequestBody, AMCResponse } from '../../../src/connector';
import {
  activateForum,
  ForumCategoryPermissionOverride,
  ForumLayout,
  ForumLayoutCategory,
  ForumLayoutGroup,
  saveForumPermissions,
  setForumDefaultNesting,
} from '../../../src/module/site/forum-admin';
import type { Site } from '../../../src/module/site/site';
import { ForumPermissions } from '../../../src/module/site/site-permissions';
import { TEST_SITE_DATA } from '../../setup';

type Handler = (body: AMCRequestBody) => ReturnType<Site['amcRequestSingle']>;

function createMockSite(handler: Handler): { site: Site; calls: AMCRequestBody[] } {
  const calls: AMCRequestBody[] = [];
  const site = {
    id: TEST_SITE_DATA.id,
    unixName: TEST_SITE_DATA.unixName,
    domain: TEST_SITE_DATA.domain,
    sslSupported: TEST_SITE_DATA.sslSupported,
    amcRequestSingle: (body: AMCRequestBody) => {
      calls.push(body);
      return handler(body);
    },
  } as unknown as Site;
  return { site, calls };
}

const okResponse: AMCResponse = { status: 'ok' };

function queued(responses: AMCResponse[]): Handler {
  let index = 0;
  return () => {
    const response = responses[index];
    index++;
    if (!response) return errAsync(new UnexpectedError('No more mock responses queued'));
    return okAsync(response);
  };
}

describe('activateForum', () => {
  test('sends activateForum with no extra params', async () => {
    const { site, calls } = createMockSite(queued([okResponse]));
    const result = await activateForum(site);
    expect(result.isOk()).toBe(true);
    expect(calls[0]).toEqual({
      action: 'ManageSiteForumAction',
      event: 'activateForum',
      moduleName: 'Empty',
    });
  });
});

describe('setForumDefaultNesting', () => {
  test.each([0, 5, 10])('accepts %d', async (level) => {
    const { site, calls } = createMockSite(queued([okResponse]));
    await setForumDefaultNesting(site, level);
    expect(calls[0]?.event).toBe('saveForumDefaultNesting');
    expect(calls[0]?.max_nest_level).toBe(level);
  });

  test.each([-1, 11])('rejects %d', (level) => {
    const { site } = createMockSite(queued([okResponse]));
    expect(() => setForumDefaultNesting(site, level)).toThrow(/0 and 10/);
  });
});

describe('ForumLayoutGroup / ForumLayoutCategory round trip', () => {
  test('group preserves unknown fields', () => {
    const group = ForumLayoutGroup.fromRaw({
      group_id: 42,
      name: 'General',
      description: 'desc',
      visible: true,
    });
    expect(group.name).toBe('General');
    const raw = group.toRaw();
    expect(raw.group_id).toBe(42);
    expect(raw.name).toBe('General');
  });

  test('locally created group has no extra raw fields', () => {
    const group = new ForumLayoutGroup({ name: 'New Group' });
    expect(group.toRaw()).toEqual({ name: 'New Group', description: '', visible: true });
  });

  test('category preserves unknown fields and numberThreads', () => {
    const category = ForumLayoutCategory.fromRaw({
      category_id: 7001,
      name: 'Discussion',
      description: 'desc',
      max_nest_level: 3,
      number_threads: 12,
    });
    expect(category.categoryId).toBe(7001);
    expect(category.numberThreads).toBe(12);
    const raw = category.toRaw();
    expect(raw.category_id).toBe(7001);
    expect(raw.max_nest_level).toBe(3);
  });

  test('new category has no categoryId', () => {
    const category = new ForumLayoutCategory({ name: 'New Category' });
    expect(category.toRaw().category_id).toBeUndefined();
  });
});

function layoutResponse(): AMCResponse {
  return {
    status: 'ok',
    groups: [{ group_id: 1, name: 'Group A', description: '', visible: true }],
    categories: [
      [
        {
          category_id: 7001,
          name: 'Cat A1',
          description: '',
          max_nest_level: null,
          number_threads: 5,
        },
      ],
    ],
    defaultNesting: 3,
  } as unknown as AMCResponse;
}

describe('ForumLayout.fetch', () => {
  test('parses groups, categories, and defaultNesting', async () => {
    const { site, calls } = createMockSite(queued([layoutResponse()]));
    const result = await ForumLayout.fetch(site);
    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.groups.length).toBe(1);
    expect(result.value.groups[0]?.name).toBe('Group A');
    expect(result.value.categories[0]?.[0]?.categoryId).toBe(7001);
    expect(result.value.defaultNesting).toBe(3);
    expect(calls[0]).toEqual({ moduleName: 'managesite/ManageSiteGetForumLayoutModule' });
  });

  test('errors when groups/categories are missing', async () => {
    const { site } = createMockSite(queued([{ status: 'ok' }]));
    const result = await ForumLayout.fetch(site);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBeInstanceOf(ResponseDataError);
  });
});

async function fetchLayout(): Promise<{
  layout: ForumLayout;
  site: Site;
  calls: AMCRequestBody[];
}> {
  const { site, calls } = createMockSite(queued([layoutResponse(), okResponse]));
  const result = await ForumLayout.fetch(site);
  if (!result.isOk()) throw new Error('fetch failed in test setup');
  return { layout: result.value, site, calls };
}

describe('ForumLayout mutation', () => {
  test('addGroup keeps categories array index in sync', async () => {
    const { layout } = await fetchLayout();
    const newGroup = layout.addGroup('Group B');
    expect(layout.groups.at(-1)).toBe(newGroup);
    expect(layout.categories.at(-1)).toEqual([]);
  });

  test('addCategory appends to the correct group', async () => {
    const { layout } = await fetchLayout();
    const groupB = layout.addGroup('Group B');
    const newCategory = layout.addCategory(groupB, 'Cat B1');
    expect(layout.categories[0]).not.toContain(newCategory);
    expect(layout.categories[1]).toEqual([newCategory]);
  });

  test('addCategory on a foreign group throws', async () => {
    const { layout } = await fetchLayout();
    const foreignGroup = new ForumLayoutGroup({ name: 'Foreign' });
    expect(() => layout.addCategory(foreignGroup, 'Cat')).toThrow();
  });

  test('removeGroup requires confirm', async () => {
    const { layout } = await fetchLayout();
    expect(() => layout.removeGroup(layout.groups[0] as ForumLayoutGroup, false)).toThrow(
      /confirm/
    );
  });

  test('removeGroup moves group and categories to deleted lists, sent on save', async () => {
    const { layout, calls } = await fetchLayout();
    const group = layout.groups[0] as ForumLayoutGroup;

    layout.removeGroup(group, true);
    expect(layout.groups.length).toBe(0);
    expect(layout.categories.length).toBe(0);

    const saveResult = await layout.save();
    expect(saveResult.isOk()).toBe(true);
    const saveBody = calls[1];
    expect(saveBody?.event).toBe('saveForumLayout');
    expect(saveBody?.deleted_categories).toBe('[7001]');
  });

  test('removeCategory requires confirm', async () => {
    const { layout } = await fetchLayout();
    const group = layout.groups[0] as ForumLayoutGroup;
    const category = layout.categories[0]?.[0] as ForumLayoutCategory;
    expect(() => layout.removeCategory(group, category, false)).toThrow(/confirm/);
  });

  test('removeCategory records the id and clears after save', async () => {
    const { layout, calls } = await fetchLayout();
    const group = layout.groups[0] as ForumLayoutGroup;
    const category = layout.categories[0]?.[0] as ForumLayoutCategory;

    layout.removeCategory(group, category, true);
    expect(layout.categories[0]).toEqual([]);

    await layout.save();
    const saveBody = calls[1];
    expect(saveBody?.deleted_categories).toBe('[7001]');
    expect(saveBody?.groups).toBeDefined();
    expect(saveBody?.categories).toBeDefined();
  });
});

describe('ForumCategoryPermissionOverride', () => {
  test('encodes explicit permissions', () => {
    const perms = ForumPermissions.decode('t:m;p:arm;e:m');
    const override = new ForumCategoryPermissionOverride(7001, perms);
    const raw = override.toRaw();
    expect(raw.category_id).toBe(7001);
    expect(raw.permissions).toBe(perms.encode());
  });

  test('null permissions means inherit default', () => {
    const override = new ForumCategoryPermissionOverride(7001, null);
    expect(override.toRaw()).toEqual({ category_id: 7001, permissions: null });
  });
});

describe('saveForumPermissions', () => {
  test('sends default and category overrides', async () => {
    const { site, calls } = createMockSite(queued([okResponse]));
    const defaultPermissions = ForumPermissions.decode('t:m;p:arm;e:m');
    const overrides = [new ForumCategoryPermissionOverride(7001, null)];

    const result = await saveForumPermissions(site, defaultPermissions, overrides);

    expect(result.isOk()).toBe(true);
    expect(calls[0]?.action).toBe('ManageSiteForumAction');
    expect(calls[0]?.event).toBe('saveForumPermissions');
    expect(calls[0]?.default_permissions).toBe(defaultPermissions.encode());
    expect(calls[0]?.categories).toBe('[{"category_id":7001,"permissions":null}]');
  });

  test('defaults to an empty override array', async () => {
    const { site, calls } = createMockSite(queued([okResponse]));
    const defaultPermissions = ForumPermissions.decode('t:m;p:arm;e:m');

    await saveForumPermissions(site, defaultPermissions);

    expect(calls[0]?.categories).toBe('[]');
  });
});
