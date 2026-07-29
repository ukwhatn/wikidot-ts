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
      'managesite/ManageSitePermissionsModule',
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

  test('fetches from the moduleName passed in', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.updateCategories(
      'managesite/ManageSiteLicenseModule',
      'ManageSiteAction',
      'saveLicense',
      () => {}
    );

    expect(calls[0]?.moduleName).toBe('managesite/ManageSiteLicenseModule');
  });

  test('never caches: two calls issue two fetch+save round trips', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([categoriesResponse(), okResponse, categoriesResponse(), okResponse])
    );
    const accessor = new SettingsAccessor(site);

    await accessor.updateCategories(
      'managesite/ManageSitePermissionsModule',
      'ManageSiteAction',
      'savePermissions',
      () => {}
    );
    await accessor.updateCategories(
      'managesite/ManageSiteLicenseModule',
      'ManageSiteAction',
      'saveLicense',
      () => {}
    );

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
    expect(calls[0]?.moduleName).toBe('managesite/ManageSitePermissionsModule');
    expect(calls[1]?.event).toBe('savePermissions');
    expect(calls[1]?.categories as string).toContain('v:arm');
  });

  test('setPagePermissions on a missing category propagates an error', async () => {
    const { site } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    const result = await accessor.setPagePermissions('nonexistent', new PagePermissions());

    expect(result.isErr()).toBe(true);
  });

  test('setLicense fetches from the License module and sends the license id', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    const result = await accessor.setLicense('_default', SiteLicense.CC_ATTRIBUTION_3_0);

    expect(result.isOk()).toBe(true);
    expect(calls[0]?.moduleName).toBe('managesite/ManageSiteLicenseModule');
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

  test('setNavigation fetches from the Navigation module', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.setNavigation('_default', 'nav:top', 'nav:side2');

    expect(calls[0]?.moduleName).toBe('managesite/ManageSiteNavigationModule');
    expect(calls[1]?.event).toBe('saveNavigation');
  });

  test('setTemplate fetches from the Templates module', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.setTemplate('_default', 42);

    expect(calls[0]?.moduleName).toBe('managesite/ManageSiteTemplatesModule');
    expect(calls[1]?.categories as string).toContain('"template_id":42');
  });

  test('setPageRateSettings fetches from the PageRate module', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.setPageRateSettings('_default', RatingSettings.decode('emaS'));

    expect(calls[0]?.moduleName).toBe('managesite/pagerate/ManageSitePageRateSettingsModule');
    expect(calls[1]?.event).toBe('savePageRateSettings');
  });

  test('setPerPageDiscussion with an explicit value fetches from the PerPageDiscussion module', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.setPerPageDiscussion('_default', false);

    expect(calls[0]?.moduleName).toBe('managesite/ManageSitePerPageDiscussionModule');
    expect(calls[1]?.action).toBe('ManageSiteForumAction');
    expect(calls[1]?.event).toBe('savePerPageDiscussion');
  });

  test('setPerPageDiscussion with null uses the site default', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.setPerPageDiscussion('_default', null);

    expect(calls[1]?.categories as string).toContain('"per_page_discussion_default":true');
  });

  test('setAppearanceTheme fetches from the Appearance module', async () => {
    const { site, calls } = createMockSite(queuedResponses([categoriesResponse(), okResponse]));
    const accessor = new SettingsAccessor(site);

    await accessor.setAppearanceTheme('_default', 7);

    expect(calls[0]?.moduleName).toBe('managesite/themes/ManageSiteAppearanceModule');
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

function generalFormResponse(): AMCResponse {
  return amcFixtures.site.generalForm() as AMCResponse;
}

function domainModuleResponse(): AMCResponse {
  return amcFixtures.site.domainModule() as AMCResponse;
}

function accessPolicyFormResponse(): AMCResponse {
  return amcFixtures.site.accessPolicyForm() as AMCResponse;
}

describe('getGeneral', () => {
  test('reads all fields', async () => {
    const { site } = createMockSite(queuedResponses([generalFormResponse()]));

    const result = await new SettingsAccessor(site).getGeneral();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({
        name: 'My Site',
        subtitle: 'A subtitle',
        language: 'ja',
        description: 'A description',
        defaultPage: 'start',
        welcomePage: 'welcome',
      });
    }
  });

  test('missing field is undefined, not guessed', async () => {
    const { site } = createMockSite(queuedResponses([{ status: 'ok', body: '<div></div>' }]));

    const result = await new SettingsAccessor(site).getGeneral();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBeUndefined();
      expect(result.value.language).toBeUndefined();
    }
  });
});

describe('saveGeneral read-modify-write', () => {
  test('only name given preserves other fields', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([generalFormResponse(), { status: 'ok' }])
    );

    await new SettingsAccessor(site).saveGeneral({ name: 'New Title' });

    const saveBody = calls[1];
    expect(saveBody?.name).toBe('New Title');
    expect(saveBody?.subtitle).toBe('A subtitle');
    expect(saveBody?.language).toBe('ja');
    expect(saveBody?.description).toBe('A description');
    expect(saveBody?.default_page).toBe('start');
    expect(saveBody?.welcome_page).toBe('welcome');
  });

  test('explicit empty string clears a field', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([generalFormResponse(), { status: 'ok' }])
    );

    await new SettingsAccessor(site).saveGeneral({ subtitle: '' });

    const saveBody = calls[1];
    expect(saveBody?.subtitle).toBe('');
    expect(saveBody?.name).toBe('My Site');
  });

  test('no arguments resends all current values', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([generalFormResponse(), { status: 'ok' }])
    );

    await new SettingsAccessor(site).saveGeneral();

    const saveBody = calls[1];
    expect(saveBody?.name).toBe('My Site');
    expect(saveBody?.subtitle).toBe('A subtitle');
    expect(saveBody?.language).toBe('ja');
  });

  test('returns the new unix name when it changes', async () => {
    const { site } = createMockSite(
      queuedResponses([generalFormResponse(), { status: 'ok', unixName: 'new-name' }])
    );

    const result = await new SettingsAccessor(site).saveGeneral({ name: 'Test Site' });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('new-name');
    }
  });

  test('returns null without a unixName change', async () => {
    const { site } = createMockSite(queuedResponses([generalFormResponse(), { status: 'ok' }]));

    const result = await new SettingsAccessor(site).saveGeneral({ name: 'Test Site' });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBeNull();
    }
  });

  test('empty name surfaces FormErrorsError', async () => {
    let callIndex = 0;
    const { site } = createMockSite(() => {
      callIndex++;
      if (callIndex === 1) {
        return okAsync(generalFormResponse());
      }
      return errAsync(
        new FormErrorsError('form_errors', 'form_errors', {
          status: 'form_errors',
          formErrors: { name: 'Please provide the site title' },
        })
      );
    });

    const result = await new SettingsAccessor(site).saveGeneral({ name: '' });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(FormErrorsError);
      expect((result.error as FormErrorsError).errors.name).toBe('Please provide the site title');
    }
  });
});

describe('getDomain', () => {
  test('reads fields by id', async () => {
    const { site } = createMockSite(queuedResponses([domainModuleResponse()]));

    const result = await new SettingsAccessor(site).getDomain();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.domain).toBe('example.com');
      expect(result.value.domainDefault).toBe(true);
      expect(result.value.redirects).toEqual(['a.com', 'b.com']);
    }
  });
});

describe('saveDomain read-modify-write', () => {
  test('rejects more than 10 redirects without any request', () => {
    const { site, calls } = createMockSite(queuedResponses([okResponse]));

    expect(() =>
      new SettingsAccessor(site).saveDomain({
        redirects: Array.from({ length: 11 }, (_, i) => `r${i}.com`),
      })
    ).toThrow();
    expect(calls.length).toBe(0);
  });

  test('joins redirects with a semicolon', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([domainModuleResponse(), { status: 'ok' }])
    );

    await new SettingsAccessor(site).saveDomain({ redirects: ['a.com', 'b.com'] });

    expect(calls[1]?.redirects).toBe('a.com;b.com');
  });

  test('only domain given preserves redirects and default flag', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([domainModuleResponse(), { status: 'ok' }])
    );

    await new SettingsAccessor(site).saveDomain({ domain: 'new.example.com' });

    const saveBody = calls[1];
    expect(saveBody?.domain).toBe('new.example.com');
    expect(saveBody?.redirects).toBe('a.com;b.com');
    expect(saveBody?.domainDefault).toBe('true');
  });
});

describe('getAccessPolicy', () => {
  test('reads all fields', async () => {
    const { site } = createMockSite(queuedResponses([accessPolicyFormResponse()]));

    const result = await new SettingsAccessor(site).getAccessPolicy();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({
        privacy: 'closed',
        byApply: true,
        byDomain: 'example.com',
        byPassword: false,
        password: '',
        allowHotlink: true,
        landingPage: 'start',
        hideNav: false,
      });
    }
  });
});

describe('saveAccessPolicy read-modify-write', () => {
  test('no privacy given keeps the current value', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([accessPolicyFormResponse(), { status: 'ok' }])
    );

    await new SettingsAccessor(site).saveAccessPolicy();

    const saveBody = calls[1];
    expect(saveBody?.privacy).toBe('closed');
    expect(saveBody?.by_domain).toBe('example.com');
    expect(saveBody?.landingPage).toBe('start');
    // by_apply / allowHotlink were checked in the fixture, so they must
    // still be sent even though this call didn't touch them
    expect(saveBody?.by_apply).toBe('on');
    expect(saveBody?.allowHotlink).toBe('on');
    expect(saveBody?.hideNav).toBeUndefined();
  });

  test('privacy cannot be determined surfaces an error result', async () => {
    const { site } = createMockSite(
      queuedResponses([{ status: 'ok', body: "<form id='sm-private-form'></form>" }])
    );

    const result = await new SettingsAccessor(site).saveAccessPolicy();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain('privacy');
    }
  });

  test('viewers from ids', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([accessPolicyFormResponse(), { status: 'ok' }])
    );

    await new SettingsAccessor(site).saveAccessPolicy(undefined, { viewers: [111, 222] });

    expect(calls[1]?.viewers).toBe('111,222');
  });

  test('viewers omitted when not given', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([accessPolicyFormResponse(), { status: 'ok' }])
    );

    await new SettingsAccessor(site).saveAccessPolicy();

    expect(calls[1]?.viewers).toBeUndefined();
  });

  test('explicit privacy overrides the current value', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([accessPolicyFormResponse(), { status: 'ok' }])
    );

    await new SettingsAccessor(site).saveAccessPolicy('private');

    expect(calls[1]?.privacy).toBe('private');
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
