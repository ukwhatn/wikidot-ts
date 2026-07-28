/**
 * Accessor for Wikidot's site-wide settings (Manage Site's `_admin` panel).
 *
 * Access through `Site.settings`. Methods are grouped following the sibling
 * wikidot.py repo's 31_tasks.md P1 breakdown, and this file is a direct port
 * of wikidot.py's `module/site_settings.py`:
 *
 * - `updateCategories`: the read-modify-write primitive for the seven
 *   `categories`-backed areas (Task 1-1)
 * - Permissions / License / Navigation / Templates / PageRate /
 *   PerPageDiscussion / Appearance: thin wrappers over `updateCategories`
 *   (Task 1-4)
 * - General / Domain / Access policy: read-modify-write form saves
 *   (Task 1-3)
 * - Everything else (CustomFooter / Toolbars / GoogleAnalytics /
 *   Autonumerate / Pingbacks / API / OpenID / Backup / Icons / Newsletter):
 *   single-shot settings (Task 1-5)
 *
 * General/Domain/Access policy have both a `get*` and a `save*` method.
 * `save*`'s options all default to undefined, meaning "keep the current
 * value" (fetched via `get*` first); pass "" explicitly to clear a text
 * field. This matters because Wikidot's save events resubmit the whole
 * form, not a diff -- omitting a field silently blanks it (`saveGeneral`
 * called with only `name` would otherwise wipe subtitle/description/
 * defaultPage/welcomePage and reset language to "en").
 */

import * as cheerio from 'cheerio';
import type { WikidotError } from '../../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../../common/types';
import { checkbox, flag, jsonParam, omitFalsy } from '../../../connector/amc-body';
import { requireBody } from '../../../connector/amc-client';
import type { AMCRequestBody } from '../../../connector/amc-types';
import type { AbstractUser } from '../../user';
import type { Site } from '../site';
import { SiteCategory, SiteCategoryCollection, SiteLicense } from '../site-category';
import type { PagePermissions, RatingSettings } from '../site-permissions';

/**
 * Module names that render each categories-backed settings area. Each of these
 * embeds the site's full `categories` array (same 24-field schema), so
 * updateCategories fetches from the module matching the area being changed
 * rather than a single fixed one -- a module that only echoes back a subset of
 * fields would otherwise cause the categories round trip (SiteCategory.raw,
 * see 30_plan.md D3) to lose the fields it didn't include on the next save of
 * a *different* area.
 */
const MODULE_PERMISSIONS = 'managesite/ManageSitePermissionsModule';
const MODULE_LICENSE = 'managesite/ManageSiteLicenseModule';
const MODULE_NAVIGATION = 'managesite/ManageSiteNavigationModule';
const MODULE_TEMPLATES = 'managesite/ManageSiteTemplatesModule';
const MODULE_PAGE_RATE = 'managesite/pagerate/ManageSitePageRateSettingsModule';
const MODULE_PER_PAGE_DISCUSSION = 'managesite/ManageSitePerPageDiscussionModule';
const MODULE_APPEARANCE = 'managesite/themes/ManageSiteAppearanceModule';

/** Accepts a user object, or a raw user id, wherever a viewer/recipient list is needed */
type UserOrId = AbstractUser | number;

function toId(u: UserOrId): number {
  return typeof u === 'number' ? u : u.id;
}

/**
 * Read a form field's current value by its `name` attribute.
 *
 * Handles the three form control shapes formToArray understands (text-like
 * input, textarea, select); returns undefined if the element is missing or
 * (for select) nothing is marked selected, rather than guessing a value.
 */
function formField($: cheerio.CheerioAPI, name: string): string | undefined {
  const el = $(`[name="${name}"]`).first();
  if (el.length === 0) {
    return undefined;
  }
  if (el.is('textarea')) {
    return el.text();
  }
  if (el.is('select')) {
    const selected = el.find('option[selected]').first();
    if (selected.length === 0) {
      return undefined;
    }
    return selected.attr('value') ?? selected.text();
  }
  return el.attr('value');
}

/** Read a checkbox's current checked state by its `name` attribute */
function formCheckbox($: cheerio.CheerioAPI, name: string): boolean | undefined {
  const el = $(`input[name="${name}"]`).first();
  if (el.length === 0) {
    return undefined;
  }
  return el.attr('checked') !== undefined;
}

/** Read the checked option's value from a radio button group */
function formRadio($: cheerio.CheerioAPI, name: string): string | undefined {
  const el = $(`input[name="${name}"][checked]`).first();
  if (el.length === 0) {
    return undefined;
  }
  return el.attr('value');
}

/**
 * Read an element's current value by its `id`.
 *
 * For the handful of fields Wikidot's own JS reads by id instead of via
 * formToArray (e.g. Domain's fields).
 */
function elementValue($: cheerio.CheerioAPI, elementId: string): string | undefined {
  const el = $(`#${elementId}`).first();
  if (el.length === 0) {
    return undefined;
  }
  return el.attr('value');
}

/** Read a checkbox's current checked state by its `id` */
function elementCheckbox($: cheerio.CheerioAPI, elementId: string): boolean | undefined {
  const el = $(`#${elementId}`).first();
  if (el.length === 0) {
    return undefined;
  }
  return el.attr('checked') !== undefined;
}

/**
 * Current values of the site's General settings form (`sm-general-form`).
 *
 * Any field is undefined when the corresponding form element could not be
 * found in the rendered HTML; this library does not guess a value in that
 * case.
 */
export interface GeneralSettings {
  name: string | undefined;
  subtitle: string | undefined;
  language: string | undefined;
  description: string | undefined;
  defaultPage: string | undefined;
  welcomePage: string | undefined;
}

/** Current values of the site's Domain settings */
export interface DomainSettings {
  domain: string | undefined;
  domainDefault: boolean | undefined;
  redirects: string[] | undefined;
}

/**
 * Current values of the site's Access policy settings (`sm-private-form`).
 *
 * `viewers` (extra allowed users for a private site) is intentionally
 * absent: it is not part of this form, see `saveAccessPolicy`'s docstring
 * for why it cannot be read back.
 */
export interface AccessPolicySettings {
  privacy: 'open' | 'closed' | 'private' | undefined;
  byApply: boolean | undefined;
  byDomain: string | undefined;
  byPassword: boolean | undefined;
  password: string | undefined;
  allowHotlink: boolean | undefined;
  landingPage: string | undefined;
  hideNav: boolean | undefined;
}

/** Accessor for Manage Site (`_admin`) settings. Access through `Site.settings`. */
export class SettingsAccessor {
  public readonly site: Site;

  constructor(site: Site) {
    this.site = site;
  }

  // ------------------------------------------------------------------
  // Task 1-1: categories read-modify-write primitive
  // ------------------------------------------------------------------

  /**
   * Fetch the current `categories` array, mutate it, and save it back.
   *
   * This is the single place that performs the categories read-modify-write
   * cycle; every method below that touches `categories` (Permissions /
   * License / Navigation / Templates / PageRate / PerPageDiscussion /
   * Appearance) is a thin wrapper over this. The array is always re-fetched
   * here (never cached), because a partial-update API does not exist and
   * holding a stale snapshot risks reverting another admin's concurrent
   * change.
   * @param moduleName - Manage Site module to fetch the `categories` array
   * from before mutating (e.g. "managesite/ManageSitePermissionsModule").
   * Matches the module that would render the area being changed -- it is
   * unconfirmed whether every categories-rendering module echoes back the
   * same full 24-field schema, so this fetches from the module for the area
   * actually being saved rather than a single fixed one
   * @param action - AMC action for the save request (e.g. "ManageSiteAction")
   * @param event - AMC event for the save request (e.g. "savePermissions")
   * @param mutator - Called with the freshly fetched collection; mutate
   * categories in place
   */
  updateCategories(
    moduleName: string,
    action: string,
    event: string,
    mutator: (categories: SiteCategoryCollection) => void
  ): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const fetchResult = await SiteCategoryCollection.fetch(this.site, moduleName);
        if (fetchResult.isErr()) {
          throw fetchResult.error;
        }
        const collection = fetchResult.value;
        mutator(collection);
        const saveResult = await collection.save(action, event);
        if (saveResult.isErr()) {
          throw saveResult.error;
        }
      })(),
      (error) => error as WikidotError
    );
  }

  // ------------------------------------------------------------------
  // Task 1-4: categories-backed settings
  // ------------------------------------------------------------------

  /**
   * Set explicit page permissions for a category. Clears the category's
   * `permissionsDefault` flag (it stops inheriting the site default).
   */
  setPagePermissions(categoryName: string, permissions: PagePermissions): WikidotResultAsync<void> {
    return this.updateCategories(
      MODULE_PERMISSIONS,
      'ManageSiteAction',
      'savePermissions',
      (cats) => {
        const category = cats.get(categoryName);
        category.permissions = permissions;
        category.permissionsDefault = false;
      }
    );
  }

  /** Make a category inherit the site's default page permissions */
  useDefaultPagePermissions(categoryName: string): WikidotResultAsync<void> {
    return this.updateCategories(
      MODULE_PERMISSIONS,
      'ManageSiteAction',
      'savePermissions',
      (cats) => {
        const category = cats.get(categoryName);
        category.permissions = null;
        category.permissionsDefault = true;
      }
    );
  }

  /**
   * Set an explicit license for a category
   * @param other - Free-text license description. Required when `license` is
   * `SiteLicense.OTHER`
   * @throws {Error} If `license` is `SiteLicense.OTHER` and `other` is empty
   */
  setLicense(categoryName: string, license: SiteLicense, other = ''): WikidotResultAsync<void> {
    if (license === SiteLicense.OTHER && !other) {
      throw new Error('licenseOther is required when license is SiteLicense.OTHER');
    }
    return this.updateCategories(MODULE_LICENSE, 'ManageSiteAction', 'saveLicense', (cats) => {
      const category = cats.get(categoryName);
      category.licenseId = license;
      category.licenseOther = other;
      category.licenseDefault = false;
    });
  }

  /** Make a category inherit the site's default license */
  useDefaultLicense(categoryName: string): WikidotResultAsync<void> {
    return this.updateCategories(MODULE_LICENSE, 'ManageSiteAction', 'saveLicense', (cats) => {
      cats.get(categoryName).licenseDefault = true;
    });
  }

  /** Set explicit top/side navigation pages for a category */
  setNavigation(
    categoryName: string,
    topBarPageName: string,
    sideBarPageName: string
  ): WikidotResultAsync<void> {
    return this.updateCategories(
      MODULE_NAVIGATION,
      'ManageSiteAction',
      'saveNavigation',
      (cats) => {
        const category = cats.get(categoryName);
        category.topBarPageName = topBarPageName;
        category.sideBarPageName = sideBarPageName;
        category.navDefault = false;
      }
    );
  }

  /** Make a category inherit the site's default navigation */
  useDefaultNavigation(categoryName: string): WikidotResultAsync<void> {
    return this.updateCategories(
      MODULE_NAVIGATION,
      'ManageSiteAction',
      'saveNavigation',
      (cats) => {
        cats.get(categoryName).navDefault = true;
      }
    );
  }

  /** Set (or clear, with null) the page template for a category */
  setTemplate(categoryName: string, templateId: number | null): WikidotResultAsync<void> {
    return this.updateCategories(MODULE_TEMPLATES, 'ManageSiteAction', 'saveTemplates', (cats) => {
      cats.get(categoryName).templateId = templateId;
    });
  }

  /** Set the rating (vote) configuration for a category */
  setPageRateSettings(categoryName: string, rating: RatingSettings): WikidotResultAsync<void> {
    return this.updateCategories(
      MODULE_PAGE_RATE,
      'ManageSiteAction',
      'savePageRateSettings',
      (cats) => {
        cats.get(categoryName).rating = rating;
      }
    );
  }

  /**
   * Enable/disable the per-page discussion thread for a category
   * @param enabled - true/false to force on/off, or null to use the site default
   */
  setPerPageDiscussion(categoryName: string, enabled: boolean | null): WikidotResultAsync<void> {
    return this.updateCategories(
      MODULE_PER_PAGE_DISCUSSION,
      'ManageSiteForumAction',
      'savePerPageDiscussion',
      (cats) => {
        const category = cats.get(categoryName);
        category.perPageDiscussion = enabled;
        category.perPageDiscussionDefault = enabled === null;
      }
    );
  }

  /** Apply a built-in theme to a category */
  setAppearanceTheme(categoryName: string, themeId: number): WikidotResultAsync<void> {
    return this.updateCategories(
      MODULE_APPEARANCE,
      'ManageSiteThemeAction',
      'saveAppearance',
      (cats) => {
        const category = cats.get(categoryName);
        category.themeId = themeId;
        category.themeExternalUrl = '';
        category.themeDefault = false;
      }
    );
  }

  /**
   * Apply an external theme URL to a category. Wikidot represents "external
   * theme" by sending `theme_id` as the empty string instead of an int (see
   * SiteCategory.themeId).
   */
  setAppearanceExternalTheme(
    categoryName: string,
    themeExternalUrl: string
  ): WikidotResultAsync<void> {
    return this.updateCategories(
      MODULE_APPEARANCE,
      'ManageSiteThemeAction',
      'saveAppearance',
      (cats) => {
        const category = cats.get(categoryName);
        category.themeId = '';
        category.themeExternalUrl = themeExternalUrl;
        category.themeDefault = false;
      }
    );
  }

  /** Make a category inherit the site's default appearance */
  useDefaultAppearance(categoryName: string): WikidotResultAsync<void> {
    return this.updateCategories(
      MODULE_APPEARANCE,
      'ManageSiteThemeAction',
      'saveAppearance',
      (cats) => {
        cats.get(categoryName).themeDefault = true;
      }
    );
  }

  // ------------------------------------------------------------------
  // Task 1-3: General / Domain / Access policy
  // ------------------------------------------------------------------

  /**
   * Fetch the site's current General settings.
   *
   * Renders `managesite/ManageSiteGeneralModule` and reads the current
   * values out of `sm-general-form` by its documented field names.
   */
  getGeneral(): WikidotResultAsync<GeneralSettings> {
    const moduleName = 'managesite/ManageSiteGeneralModule';
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequestSingle({ moduleName });
        if (result.isErr()) {
          throw result.error;
        }
        const $ = cheerio.load(requireBody(result.value, moduleName));
        return {
          name: formField($, 'name'),
          subtitle: formField($, 'subtitle'),
          language: formField($, 'language'),
          description: formField($, 'description'),
          defaultPage: formField($, 'default_page'),
          welcomePage: formField($, 'welcome_page'),
        };
      })(),
      (error) => error as WikidotError
    );
  }

  /**
   * Save the site's title/subtitle/language/description/entry pages.
   *
   * `saveGeneral` resubmits the whole form rather than a diff, so this
   * fetches the current settings (`getGeneral`) first and only overrides
   * the fields the caller passed explicitly. Undefined keeps the current
   * value; pass "" to clear a field.
   * @param options.name - Site title. Undefined keeps the current title. An
   * empty string (or a current title this library could not read) raises
   * FormErrorsError, since the title is required
   * @returns New unix name, only returned when the site's unix name changed
   * as a result
   * @throws {FormErrorsError} (in the returned Result's error channel) when
   * validation fails (e.g. an empty title)
   */
  saveGeneral(
    options: {
      name?: string;
      subtitle?: string;
      language?: string;
      description?: string;
      defaultPage?: string;
      welcomePage?: string;
    } = {}
  ): WikidotResultAsync<string | null> {
    return fromPromise(
      (async () => {
        const currentResult = await this.getGeneral();
        if (currentResult.isErr()) {
          throw currentResult.error;
        }
        const current = currentResult.value;
        const result = await this.site.amcRequestSingle({
          action: 'ManageSiteAction',
          event: 'saveGeneral',
          name: options.name ?? current.name ?? '',
          subtitle: options.subtitle ?? current.subtitle ?? '',
          language: options.language ?? current.language ?? 'en',
          description: options.description ?? current.description ?? '',
          default_page: options.defaultPage ?? current.defaultPage ?? '',
          welcome_page: options.welcomePage ?? current.welcomePage ?? '',
          moduleName: 'Empty',
        });
        if (result.isErr()) {
          throw result.error;
        }
        const unixName = result.value.unixName;
        return typeof unixName === 'string' ? unixName : null;
      })(),
      (error) => error as WikidotError
    );
  }

  /**
   * Fetch the site's current Domain settings.
   *
   * Renders `managesite/ManageSiteDomainModule`. Unlike General/Access
   * policy these fields are read by element id, not `name` (Wikidot's own
   * JS reads them the same way).
   */
  getDomain(): WikidotResultAsync<DomainSettings> {
    const moduleName = 'managesite/ManageSiteDomainModule';
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequestSingle({ moduleName });
        if (result.isErr()) {
          throw result.error;
        }
        const $ = cheerio.load(requireBody(result.value, moduleName));
        const redirectsBox = $('#sm-redirects-box');
        const redirects =
          redirectsBox.length === 0
            ? undefined
            : redirectsBox
                .find('input')
                .toArray()
                .map((el) => $(el).attr('value'))
                .filter((value): value is string => value !== undefined);
        return {
          domain: elementValue($, 'sm-domain-field'),
          domainDefault: elementCheckbox($, 'sm-domain-default'),
          redirects,
        };
      })(),
      (error) => error as WikidotError
    );
  }

  /**
   * Save the site's custom domain and redirect domains.
   *
   * Fetches the current settings (`getDomain`) first; undefined keeps the
   * current value for each option.
   * @param options.redirects - Additional domains that redirect to this
   * site. Undefined keeps the current redirect list; pass [] to clear it.
   * At most 10 (Wikidot's own client also allows empty entries through,
   * which show up as consecutive ";" in the joined string; this method does
   * not filter them out to match observed behavior)
   * @returns New domain, only returned when it changed
   * @throws {Error} If more than 10 redirects are given
   */
  saveDomain(
    options: { domain?: string; redirects?: string[]; domainDefault?: boolean } = {}
  ): WikidotResultAsync<string | null> {
    if (options.redirects && options.redirects.length > 10) {
      throw new Error('redirects supports at most 10 entries');
    }
    return fromPromise(
      (async () => {
        const currentResult = await this.getDomain();
        if (currentResult.isErr()) {
          throw currentResult.error;
        }
        const current = currentResult.value;
        const resolvedRedirects = options.redirects ?? current.redirects ?? [];
        const resolvedDomainDefault = options.domainDefault ?? current.domainDefault ?? false;
        const result = await this.site.amcRequestSingle({
          action: 'ManageSiteAction',
          event: 'saveDomain',
          domain: options.domain ?? current.domain ?? '',
          redirects: resolvedRedirects.join(';'),
          moduleName: 'Empty',
          ...omitFalsy({ domainDefault: flag(resolvedDomainDefault) }),
        });
        if (result.isErr()) {
          throw result.error;
        }
        const newDomain = result.value.newDomain;
        return typeof newDomain === 'string' ? newDomain : null;
      })(),
      (error) => error as WikidotError
    );
  }

  /**
   * Fetch the site's current Access policy settings.
   *
   * Renders `managesite/ManageSiteAccessPolicyModule` and reads
   * `sm-private-form`. Does not include `viewers` -- see `saveAccessPolicy`
   * for why that field cannot be read back.
   */
  getAccessPolicy(): WikidotResultAsync<AccessPolicySettings> {
    const moduleName = 'managesite/ManageSiteAccessPolicyModule';
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequestSingle({ moduleName });
        if (result.isErr()) {
          throw result.error;
        }
        const $ = cheerio.load(requireBody(result.value, moduleName));
        const privacyRaw = formRadio($, 'privacy');
        const privacy: AccessPolicySettings['privacy'] =
          privacyRaw === 'open' || privacyRaw === 'closed' || privacyRaw === 'private'
            ? privacyRaw
            : undefined;
        return {
          privacy,
          byApply: formCheckbox($, 'by_apply'),
          byDomain: formField($, 'by_domain'),
          byPassword: formCheckbox($, 'by_password'),
          password: formField($, 'password'),
          allowHotlink: formCheckbox($, 'allowHotlink'),
          landingPage: formField($, 'landingPage'),
          hideNav: formCheckbox($, 'hideNav'),
        };
      })(),
      (error) => error as WikidotError
    );
  }

  /**
   * Save the site's access policy (privacy level, apply/password/domain
   * gating, extra viewers, hotlinking, landing page, nav visibility).
   *
   * Fetches the current settings (`getAccessPolicy`) first; undefined keeps
   * the current value for each option (except `viewers`, see below).
   * @param privacy - Undefined keeps the current value. Throws if it cannot
   * be determined (this library will not guess between open / closed /
   * private, since a wrong guess could expose a private site)
   * @param options.password - Undefined keeps the current value. **Note**:
   * it is unconfirmed whether Wikidot actually echoes the real current
   * password back in this form (services commonly blank password fields
   * for security) -- if you are changing another field on a
   * password-gated site, pass the password explicitly rather than relying
   * on this
   * @param options.viewers - Extra users allowed to view a private site.
   * **Not** part of `sm-private-form` -- Wikidot assembles it client-side
   * via an autocomplete widget with no static representation of the
   * current selection, so it cannot be read back the way the other fields
   * can. Undefined omits the `viewers` parameter from the request entirely
   * (rather than sending an empty string, which would actively clear it),
   * but this is *not* the same guarantee as the other fields' "keeps the
   * current value": if the site has extra viewers configured, pass them
   * explicitly to preserve them
   * @throws {Error} If `privacy` is undefined and the current value could
   * not be determined
   */
  saveAccessPolicy(
    privacy?: 'open' | 'closed' | 'private',
    options: {
      byApply?: boolean;
      byDomain?: string;
      byPassword?: boolean;
      password?: string;
      allowHotlink?: boolean;
      landingPage?: string;
      hideNav?: boolean;
      viewers?: UserOrId[];
    } = {}
  ): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const currentResult = await this.getAccessPolicy();
        if (currentResult.isErr()) {
          throw currentResult.error;
        }
        const current = currentResult.value;
        const resolvedPrivacy = privacy ?? current.privacy;
        if (resolvedPrivacy === undefined) {
          throw new Error(
            "privacy could not be determined from the site's current settings; pass it explicitly"
          );
        }
        const body: AMCRequestBody = {
          action: 'ManageSiteAction',
          event: 'savePrivateSettings',
          privacy: resolvedPrivacy,
          by_domain: options.byDomain ?? current.byDomain ?? '',
          password: options.password ?? current.password ?? '',
          landingPage: options.landingPage ?? current.landingPage ?? '',
          moduleName: 'Empty',
          ...omitFalsy({
            by_apply: checkbox(options.byApply ?? current.byApply),
            by_password: checkbox(options.byPassword ?? current.byPassword),
            allowHotlink: checkbox(options.allowHotlink ?? current.allowHotlink),
            hideNav: checkbox(options.hideNav ?? current.hideNav),
          }),
        };
        if (options.viewers !== undefined) {
          body.viewers = options.viewers.map(toId).join(',');
        }
        const result = await this.site.amcRequestSingle(body);
        if (result.isErr()) {
          throw result.error;
        }
      })(),
      (error) => error as WikidotError
    );
  }

  // ------------------------------------------------------------------
  // Task 1-5: single-shot settings
  // ------------------------------------------------------------------

  /** Save the site's custom footer */
  saveCustomFooter(source: string, use = false): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteAction',
      event: 'saveCustomFooter',
      source,
      ...omitFalsy({ use: flag(use) }),
    });
  }

  /** Save the site's edit-toolbar visibility preference */
  saveToolbarsPreference(options: {
    toolbarTop?: boolean;
    toolbarBottom?: boolean;
    promote?: boolean;
  }): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteAction',
      event: 'saveToolbarsPref',
      ...omitFalsy({
        toolbarTop: checkbox(options.toolbarTop),
        toolbarBottom: checkbox(options.toolbarBottom),
        promote: checkbox(options.promote),
      }),
    });
  }

  /** Save the site's Google Analytics key */
  saveGoogleAnalytics(key: string, use = false): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSite3rdPartyAction',
      event: 'saveGoogleAnalytics',
      key,
      ...omitFalsy({ use: checkbox(use) }),
    });
  }

  /**
   * Enable page auto-numbering for a category
   * @param override - Wikidot responds with status "non_numeric" and asks
   * for confirmation when the category has pages with non-numeric names;
   * pass override=true to confirm and proceed. This method does not
   * auto-retry on "non_numeric" -- inspect the returned Result's error and
   * re-call with override=true if needed
   */
  addAutonumeration(categoryName: string, override = false): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteAutonumerateAction',
      event: 'addAutonumeration',
      categoryName,
      ...omitFalsy({ override: flag(override) }),
    });
  }

  /** Disable page auto-numbering for a category */
  removeAutonumeration(categoryName: string): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteAutonumerateAction',
      event: 'removeAutonumeration',
      categoryName,
    });
  }

  /** Set the auto-numbering title format for a category */
  setAutonumerateTitleFormat(categoryName: string, titleFormat: string): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteAutonumerateAction',
      event: 'setTitleFormat',
      categoryName,
      titleFormat,
    });
  }

  /** Enable outgoing pingbacks for a category (see addAutonumeration for `override`) */
  addPingbacks(categoryName: string, override = false): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSitePingbacksAction',
      event: 'addPingbacks',
      categoryName,
      ...omitFalsy({ override: flag(override) }),
    });
  }

  /** Disable outgoing pingbacks for a category */
  removePingbacks(categoryName: string): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSitePingbacksAction',
      event: 'removePingbacks',
      categoryName,
    });
  }

  /** Enable/disable pingbacks site-wide */
  setGlobalPingback(enabled = false): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSitePingbacksAction',
      event: 'setGlobalPingback',
      ...omitFalsy({ enabled: flag(enabled) }),
    });
  }

  /** Save the site's public API access settings */
  saveApiSettings(options: {
    enabled?: boolean;
    read1?: boolean;
    read2?: boolean;
    write1?: boolean;
    write2?: boolean;
  }): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteApiAction',
      event: 'save',
      ...omitFalsy({
        'sm-api-enable': checkbox(options.enabled),
        'read-1': checkbox(options.read1),
        'read-2': checkbox(options.read2),
        'write-1': checkbox(options.write1),
        'write-2': checkbox(options.write2),
      }),
    });
  }

  /**
   * Save the site-wide OpenID configuration. Only the site-wide form
   * (`sm-openid-form-0`) is modeled; the per-page OpenID forms are
   * dynamically added/removed in the UI and out of scope for this method.
   * @param enabled - Whether OpenID login is enabled. Sent as the literal
   * string "true"/"false" (unlike most other boolean settings here, this
   * one is not omitted when false)
   */
  saveOpenId(
    enabled: boolean,
    options: { identityUrl?: string; serverUrl?: string } = {}
  ): WikidotResultAsync<void> {
    const vals = [{ identityUrl: options.identityUrl ?? '', serverUrl: options.serverUrl ?? '' }];
    return this.simpleAction({
      action: 'ManageSiteOpenIDAction',
      event: 'saveOpenID',
      enableOpenID: enabled ? 'true' : 'false',
      vals: jsonParam(vals),
    });
  }

  /** Request a site backup */
  requestBackup(
    options: { backupSources?: boolean; backupFiles?: boolean; backupType?: 'tar' | 'zip' } = {}
  ): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteBackupAction',
      event: 'requestBackup',
      backupType: options.backupType ?? 'zip',
      ...omitFalsy({
        backupSources: checkbox(options.backupSources),
        backupFiles: checkbox(options.backupFiles),
      }),
    });
  }

  /**
   * Delete a site backup. Destructive and irreversible.
   * @param confirm - Must be explicitly true to proceed (safety gate for a
   * destructive operation)
   * @throws {Error} If confirm is not true
   */
  deleteBackup(
    confirm: boolean,
    options: { backupSources?: boolean; backupFiles?: boolean; backupType?: 'tar' | 'zip' } = {}
  ): WikidotResultAsync<void> {
    if (!confirm) {
      throw new Error('deleteBackup is destructive; pass confirm=true to proceed');
    }
    return this.simpleAction({
      action: 'ManageSiteBackupAction',
      event: 'deleteBackup',
      backupType: options.backupType ?? 'zip',
      ...omitFalsy({
        backupSources: checkbox(options.backupSources),
        backupFiles: checkbox(options.backupFiles),
      }),
    });
  }

  /** Delete the site's favicon */
  deleteFavicon(): WikidotResultAsync<void> {
    return this.simpleAction({ action: 'ManageSiteIconsAction', event: 'deleteFavicon' });
  }

  /** Set the site's favicon from a URL */
  setFaviconFromUri(uri: string): WikidotResultAsync<void> {
    return this.simpleAction({ action: 'ManageSiteIconsAction', event: 'uploadFaviconUri', uri });
  }

  /** Delete the site's iOS home screen icon */
  deleteIosIcon(): WikidotResultAsync<void> {
    return this.simpleAction({ action: 'ManageSiteIconsAction', event: 'deleteIosIcon' });
  }

  /** Set the site's iOS home screen icon from a URL */
  setIosIconFromUri(uri: string): WikidotResultAsync<void> {
    return this.simpleAction({ action: 'ManageSiteIconsAction', event: 'uploadIosIconUri', uri });
  }

  /** Delete the site's Windows tile icon */
  deleteWindowsIcon(): WikidotResultAsync<void> {
    return this.simpleAction({ action: 'ManageSiteIconsAction', event: 'deleteWindowsIcon' });
  }

  /** Set the site's Windows tile icon from a URL */
  setWindowsIconFromUri(uri: string): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteIconsAction',
      event: 'uploadWindowsIconUri',
      uri,
    });
  }

  /**
   * Set the site's Windows tile background color.
   *
   * The AMC event name is `windowsIconBackroundColor` (missing the "g" in
   * "Background") -- this is a typo in Wikidot's own JS, kept verbatim here
   * since the server only recognizes the exact name.
   */
  setWindowsIconBackgroundColor(color: string): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteIconsAction',
      event: 'windowsIconBackroundColor',
      color,
    });
  }

  /** Render a newsletter preview */
  previewNewsletter(
    title: string,
    content: string
  ): WikidotResultAsync<{ title: string; content: string }> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequestSingle({
          action: 'ManageSiteNewsletterAction',
          event: 'preview',
          title,
          content,
          moduleName: 'Empty',
        });
        if (result.isErr()) {
          throw result.error;
        }
        const renderedTitle = result.value.title;
        const renderedContent = result.value.content;
        return {
          title: typeof renderedTitle === 'string' ? renderedTitle : '',
          content: typeof renderedContent === 'string' ? renderedContent : '',
        };
      })(),
      (error) => error as WikidotError
    );
  }

  /** Send a newsletter to site members */
  sendNewsletter(
    title: string,
    content: string,
    options: {
      admins?: boolean;
      moderators?: boolean;
      members?: boolean;
      others?: UserOrId[];
    } = {}
  ): WikidotResultAsync<void> {
    return this.simpleAction({
      action: 'ManageSiteNewsletterAction',
      event: 'send',
      title,
      content,
      admins: options.admins ? 'true' : 'false',
      moderators: options.moderators ? 'true' : 'false',
      members: options.members ? 'true' : 'false',
      others: options.others ? options.others.map(toId) : [],
    });
  }

  /** Shared "fire a single AMC action, discard the response body" helper */
  private simpleAction(body: AMCRequestBody): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequestSingle({ moduleName: 'Empty', ...body });
        if (result.isErr()) {
          throw result.error;
        }
      })(),
      (error) => error as WikidotError
    );
  }
}

export { SiteCategory, SiteCategoryCollection, SiteLicense };
