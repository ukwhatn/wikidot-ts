/**
 * site-category module unit tests
 */
import { describe, expect, test } from 'bun:test';
import { errAsync, okAsync } from 'neverthrow';
import { ResponseDataError, UnexpectedError } from '../../../src/common/errors';
import type { AMCRequestBody, AMCResponse } from '../../../src/connector';
import type { Site } from '../../../src/module/site';
import {
  type RawSiteCategory,
  SiteCategory,
  SiteCategoryCollection,
  SiteLicense,
} from '../../../src/module/site/site-category';
import { PagePermissions, RatingSettings } from '../../../src/module/site/site-permissions';
import { amcFixtures } from '../../fixtures/loader';
import { TEST_SITE_DATA } from '../../setup';

type AmcRequestSingleHandler = (body: AMCRequestBody) => ReturnType<Site['amcRequestSingle']>;

function createMockSite(handler: AmcRequestSingleHandler): { site: Site; calls: AMCRequestBody[] } {
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

function queuedResponses(responses: AMCResponse[]): AmcRequestSingleHandler {
  let index = 0;
  return () => {
    const response = responses[index];
    index++;
    if (!response) {
      return errAsync(new UnexpectedError('No more mock responses queued'));
    }
    return okAsync(response);
  };
}

function rawCategory(): RawSiteCategory {
  return amcFixtures.site.categoriesSingle().categories[0] as RawSiteCategory;
}

describe('SiteCategory round trip', () => {
  test('fromRaw -> toRaw matches original', () => {
    const raw = rawCategory();
    const category = SiteCategory.fromRaw(raw);
    expect(category.toRaw()).toEqual(raw);
  });

  test('decoded fields', () => {
    const category = SiteCategory.fromRaw(rawCategory());
    expect(category.categoryId).toBe(30228632);
    expect(category.name).toBe('_default');
    expect(category.permissions).toBeInstanceOf(PagePermissions);
    expect([...(category.permissions?.view ?? [])].sort()).toEqual([
      'anonymous',
      'author',
      'member',
      'registered',
    ]);
    expect(category.rating).toBeInstanceOf(RatingSettings);
    expect(category.rating?.kind).toBe('plusMinus');
  });

  test('unknown field survives round trip', () => {
    const raw = { ...rawCategory(), some_future_field: 'unmodeled_value' };
    const category = SiteCategory.fromRaw(raw);
    expect(category.toRaw().some_future_field).toBe('unmodeled_value');
  });

  test('permissionsDefault true means permissions is null', () => {
    const raw = { ...rawCategory(), permissions_default: true, permissions: null };
    const category = SiteCategory.fromRaw(raw);
    expect(category.permissions).toBeNull();
    expect(category.toRaw().permissions).toBeNull();
  });

  test('setPermissions updates a single field and clears the default flag', () => {
    const category = SiteCategory.fromRaw(rawCategory());
    category.setPermissions({ view: ['anonymous', 'registered', 'member', 'author'] });
    expect(category.permissionsDefault).toBe(false);
    expect([...(category.permissions?.create ?? [])]).toEqual(['member']);
  });
});

describe('SiteCategoryCollection', () => {
  test('get finds a category by name', () => {
    const { site } = createMockSite(queuedResponses([]));
    const collection = new SiteCategoryCollection(site, [SiteCategory.fromRaw(rawCategory())]);
    expect(collection.get('_default').categoryId).toBe(30228632);
  });

  test('get throws for a missing category', () => {
    const { site } = createMockSite(queuedResponses([]));
    const collection = new SiteCategoryCollection(site, [SiteCategory.fromRaw(rawCategory())]);
    expect(() => collection.get('nonexistent')).toThrow();
  });

  test('length and names', () => {
    const { site } = createMockSite(queuedResponses([]));
    const collection = new SiteCategoryCollection(site, [SiteCategory.fromRaw(rawCategory())]);
    expect(collection.length).toBe(1);
    expect(collection.names()).toEqual(['_default']);
  });

  test('fetch parses the categories array', async () => {
    const response = amcFixtures.site.categoriesSingle() as AMCResponse;
    const { site, calls } = createMockSite(queuedResponses([response]));

    const result = await SiteCategoryCollection.fetch(
      site,
      'managesite/ManageSitePermissionsModule'
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.length).toBe(1);
    }
    expect(calls).toEqual([{ moduleName: 'managesite/ManageSitePermissionsModule' }]);
  });

  test('fetch fails when the response has no categories field', async () => {
    const { site } = createMockSite(queuedResponses([{ status: 'ok', body: '' }]));

    const result = await SiteCategoryCollection.fetch(
      site,
      'managesite/ManageSitePermissionsModule'
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ResponseDataError);
    }
  });

  test('save sends the full array as a JSON string', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok' }]));
    const collection = new SiteCategoryCollection(site, [SiteCategory.fromRaw(rawCategory())]);

    const result = await collection.save('ManageSiteAction', 'savePermissions');

    expect(result.isOk()).toBe(true);
    const body = calls[0];
    expect(body?.action).toBe('ManageSiteAction');
    expect(body?.event).toBe('savePermissions');
    expect(body?.moduleName).toBe('Empty');
    expect(typeof body?.categories).toBe('string');
    expect(body?.categories as string).toContain('_default');
  });
});

describe('SiteLicense', () => {
  test('OTHER is 1', () => {
    expect(SiteLicense.OTHER).toBe(1);
  });

  test('all 15 values are present', () => {
    expect(Object.keys(SiteLicense).length).toBe(15);
  });

  test('NonCommercial variants are uniquely named by id', () => {
    // Regression check for the VARIANT_A/B/C placeholders replaced after
    // lead confirmed the real option text via a live read-only fetch
    expect(SiteLicense.CC_ATTRIBUTION_NONCOMMERCIAL_2_5).toBe(5);
    expect(SiteLicense.CC_ATTRIBUTION_NONCOMMERCIAL_SHAREALIKE_2_5).toBe(6);
    expect(SiteLicense.CC_ATTRIBUTION_NONCOMMERCIAL_NO_DERIVATIVES_2_5).toBe(7);
    expect(SiteLicense.CC_ATTRIBUTION_NONCOMMERCIAL_3_0).toBe(15);
    expect(SiteLicense.CC_ATTRIBUTION_NONCOMMERCIAL_SHAREALIKE_3_0).toBe(16);
    expect(SiteLicense.CC_ATTRIBUTION_NONCOMMERCIAL_NO_DERIVATIVES_3_0).toBe(17);
  });
});
