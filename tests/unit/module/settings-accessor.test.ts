/**
 * SettingsAccessor unit tests
 */
import { describe, expect, test } from 'bun:test';
import { errAsync, okAsync } from 'neverthrow';
import { FormErrorsError, UnexpectedError } from '../../../src/common/errors';
import type { AMCRequestBody, AMCResponse } from '../../../src/connector';
import type { Site } from '../../../src/module/site';
import { SettingsAccessor } from '../../../src/module/site/accessors/settings-accessor';
import { SiteLicense } from '../../../src/module/site/site-category';
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

function categoriesResponse(): AMCResponse {
  return amcFixtures.site.categoriesSingle() as AMCResponse;
}

const okResponse: AMCResponse = { status: 'ok' };

describe('updateCategories', () => {
  test('fetches then saves (two requests)', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);
    const seen: number[] = [];

    const result = await accessor.updateCategories(
      'ManageSiteAction',
      'savePermissions',
      (cats) => {
        seen.push(cats.get('_default').categoryId);
      }
    );

    expect(result.isOk()).toBe(true);
    expect(seen).toEqual([30228632]);
    expect(calls.length).toBe(2);
    expect(calls[0]?.moduleName).toBe('managesite/ManageSitePermissionsModule');
    expect(calls[1]?.action).toBe('ManageSiteAction');
    expect(calls[1]?.event).toBe('savePermissions');
  });

  test('never caches: two calls issue two fetch+save round trips', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([categoriesResponse(), okResponse, categoriesResponse(), okResponse])
    );
    const accessor = new SettingsAccessor(site);

    await accessor.updateCategories('ManageSiteAction', 'savePermissions', () => {});
    await accessor.updateCategories('ManageSiteAction', 'saveLicense', () => {});

    expect(calls.length).toBe(4);
  });
});

describe('categories-backed settings (Task 1-4)', () => {
  test('setPagePermissions clears the default flag', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);
    const newPerms = PagePermissions.decode('v:arm;c:m;e:m;m:m;d:m;a:m;r:m;z:m;o:m');

    const result = await accessor.setPagePermissions('_default', newPerms);

    expect(result.isOk()).toBe(true);
    expect(calls[1]?.event).toBe('savePermissions');
    expect(calls[1]?.categories as string).toContain('v:arm');
  });

  test('setPagePermissions on a missing category propagates an error', async () => {
    const { site } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    const result = await accessor.setPagePermissions('nonexistent', new PagePermissions());

    expect(result.isErr()).toBe(true);
  });

  test('setLicense sends the license id', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    const result = await accessor.setLicense('_default', SiteLicense.CC_ATTRIBUTION_3_0);

    expect(result.isOk()).toBe(true);
    expect(calls[1]?.event).toBe('saveLicense');
    expect(calls[1]?.categories as string).toContain('"license_id":13');
  });

  test('setLicense throws for OTHER without text', () => {
    const { site } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    expect(() => accessor.setLicense('_default', SiteLicense.OTHER)).toThrow();
  });

  test('setLicense accepts OTHER with text', async () => {
    const { site } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    const result = await accessor.setLicense('_default', SiteLicense.OTHER, 'My custom license');

    expect(result.isOk()).toBe(true);
  });

  test('setNavigation', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.setNavigation('_default', 'nav:top', 'nav:side2');

    expect(calls[1]?.event).toBe('saveNavigation');
  });

  test('setTemplate', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.setTemplate('_default', 42);

    expect(calls[1]?.categories as string).toContain('"template_id":42');
  });

  test('setPageRateSettings', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.setPageRateSettings('_default', RatingSettings.decode('emaS'));

    expect(calls[1]?.event).toBe('savePageRateSettings');
  });

  test('setPerPageDiscussion with an explicit value', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.setPerPageDiscussion('_default', false);

    expect(calls[1]?.action).toBe('ManageSiteForumAction');
    expect(calls[1]?.event).toBe('savePerPageDiscussion');
  });

  test('setPerPageDiscussion with null uses the site default', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.setPerPageDiscussion('_default', null);

    expect(calls[1]?.categories as string).toContain('"per_page_discussion_default":true');
  });

  test('setAppearanceTheme', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.setAppearanceTheme('_default', 7);

    expect(calls[1]?.action).toBe('ManageSiteThemeAction');
    expect(calls[1]?.event).toBe('saveAppearance');
  });

  test('setAppearanceExternalTheme sends an empty-string theme_id', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.setAppearanceExternalTheme('_default', 'https://example.com/theme.css');

    expect(calls[1]?.categories as string).toContain('"theme_id":""');
  });
});

describe('General / Domain / Access policy (Task 1-3)', () => {
  test('saveGeneral with no unixName change', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([{ status: 'ok', CURRENT_TIMESTAMP: 1785204323 }])
    );
    const accessor = new SettingsAccessor(site);

    const result = await accessor.saveGeneral({ name: 'Test Site' });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBeNull();
    }
    expect(calls[0]?.action).toBe('ManageSiteAction');
    expect(calls[0]?.event).toBe('saveGeneral');
    expect(calls[0]?.name).toBe('Test Site');
  });

  test('saveGeneral returns the new unix name when it changes', async () => {
    const { site } = createMockSite(queuedResponses([{ status: 'ok', unixName: 'new-name' }]));
    const accessor = new SettingsAccessor(site);

    const result = await accessor.saveGeneral({ name: 'Test Site' });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('new-name');
    }
  });

  test('saveGeneral with an empty name surfaces FormErrorsError', async () => {
    const { site } = createMockSite(() =>
      errAsync(
        new FormErrorsError('form_errors', 'form_errors', {
          status: 'form_errors',
          formErrors: { name: 'Please provide the site title' },
        })
      )
    );
    const accessor = new SettingsAccessor(site);

    const result = await accessor.saveGeneral({ name: '' });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(FormErrorsError);
      expect((result.error as FormErrorsError).errors.name).toBe('Please provide the site title');
    }
  });

  test('saveDomain rejects more than 10 redirects', () => {
    const { site } = createMockSite(queuedResponses([okResponse]));
    const accessor = new SettingsAccessor(site);

    expect(() =>
      accessor.saveDomain('example.com', {
        redirects: Array.from({ length: 11 }, (_, i) => `r${i}.com`),
      })
    ).toThrow();
  });

  test('saveDomain joins redirects with a semicolon', async () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.saveDomain('example.com', { redirects: ['a.com', 'b.com'] });

    expect(calls[0]?.redirects).toBe('a.com;b.com');
  });

  test('saveAccessPolicy converts user ids into a comma list', async () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.saveAccessPolicy('private', { viewers: [111, 222] });

    expect(calls[0]?.viewers).toBe('111,222');
    expect(calls[0]?.privacy).toBe('private');
  });

  test('saveAccessPolicy omits unchecked checkboxes', async () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.saveAccessPolicy('open');

    expect(calls[0]?.by_apply).toBeUndefined();
    expect(calls[0]?.allowHotlink).toBeUndefined();
  });
});

describe('single-shot settings (Task 1-5)', () => {
  test('saveCustomFooter omits use when false', async () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));
    await new SettingsAccessor(site).saveCustomFooter('footer text');
    expect(calls[0]?.source).toBe('footer text');
    expect(calls[0]?.use).toBeUndefined();
  });

  test('saveCustomFooter sends use=true', async () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));
    await new SettingsAccessor(site).saveCustomFooter('footer text', true);
    expect(calls[0]?.use).toBe('true');
  });

  test('saveToolbarsPreference', async () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));
    await new SettingsAccessor(site).saveToolbarsPreference({ toolbarTop: true });
    expect(calls[0]?.toolbarTop).toBe('on');
    expect(calls[0]?.toolbarBottom).toBeUndefined();
  });

  test('saveApiSettings uses dashed keys', async () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));
    await new SettingsAccessor(site).saveApiSettings({ enabled: true, read1: true });
    expect(calls[0]?.['sm-api-enable']).toBe('on');
    expect(calls[0]?.['read-1']).toBe('on');
    expect(calls[0]?.['write-1']).toBeUndefined();
  });

  test('addAutonumeration', async () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));
    await new SettingsAccessor(site).addAutonumeration('_default', true);
    expect(calls[0]?.categoryName).toBe('_default');
    expect(calls[0]?.override).toBe('true');
  });

  test('addPingbacks without override omits the key', async () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));
    await new SettingsAccessor(site).addPingbacks('_default');
    expect(calls[0]?.override).toBeUndefined();
  });

  test('saveOpenId always sends the enable flag', async () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));
    await new SettingsAccessor(site).saveOpenId(false);
    expect(calls[0]?.enableOpenID).toBe('false');
  });

  test('requestBackup', async () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));
    await new SettingsAccessor(site).requestBackup({ backupSources: true, backupType: 'tar' });
    expect(calls[0]?.event).toBe('requestBackup');
    expect(calls[0]?.backupSources).toBe('on');
    expect(calls[0]?.backupType).toBe('tar');
  });

  test('deleteBackup requires confirm', () => {
    const { site } = createMockSite(queuedResponses([okResponse]));
    expect(() => new SettingsAccessor(site).deleteBackup(false)).toThrow();
  });

  test('deleteBackup with confirm sends the request', async () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));
    await new SettingsAccessor(site).deleteBackup(true);
    expect(calls[0]?.event).toBe('deleteBackup');
  });

  test('setWindowsIconBackgroundColor uses the exact typo event name', async () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));
    await new SettingsAccessor(site).setWindowsIconBackgroundColor('#ffffff');
    expect(calls[0]?.event).toBe('windowsIconBackroundColor');
  });

  test('previewNewsletter', async () => {
    const { site } = createMockSite(
      queuedResponses([{ status: 'ok', title: 'Rendered', content: '<p>hi</p>' }])
    );
    const result = await new SettingsAccessor(site).previewNewsletter('T', 'C');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ title: 'Rendered', content: '<p>hi</p>' });
    }
  });

  test('sendNewsletter passes others as a plain array (bracket-encoded by the AMC client)', async () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));
    await new SettingsAccessor(site).sendNewsletter('T', 'C', { admins: true, others: [1, 2, 3] });
    expect(calls[0]?.admins).toBe('true');
    expect(calls[0]?.moderators).toBe('false');
    expect(calls[0]?.others).toEqual([1, 2, 3]);
  });

  test('sendNewsletter defaults others to an empty array', async () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));
    await new SettingsAccessor(site).sendNewsletter('T', 'C');
    expect(calls[0]?.others).toEqual([]);
  });
});
