/**
 * Module for handling Wikidot's per-site "category" objects
 *
 * `categories` is the shared read-modify-write data structure behind seven
 * Manage Site areas (Permissions / License / Navigation / Templates / PageRate
 * / PerPageDiscussion / Appearance): each renders the *entire* category array
 * alongside its HTML body, and each save sends the *entire* array back as a
 * single JSON string -- there is no partial-update endpoint. See 30_plan.md D3
 * and 40_admin-managesite.md (in the sibling wikidot.py repo's memory
 * directory) for the schema and wire format this is built from. This is a
 * direct port of wikidot.py's `module/site_category.py`.
 */

import { ResponseDataError, type WikidotError } from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { jsonParam } from '../../connector/amc-body';
import type { Site } from './site';
import {
  type Actor,
  PagePermissions,
  type PagePermissionsData,
  RatingSettings,
} from './site-permissions';

/**
 * Known `license_id` values for a category.
 *
 * Values and the exact option text come from a live read-only fetch of
 * `managesite/ManageSiteLicenseModule` (`select#sm-license-lic`), recorded
 * in the sibling wikidot.py repo's 35_form-fields.md "license_id の値
 * （実測）" table. All 15 values are confirmed, including the
 * previously-grouped NonCommercial variants (5/6/7 and 15/16/17).
 */
export const SiteLicense = {
  /** "Other" (custom license). Requires `licenseOther` to be set. */
  OTHER: 1,
  /** "Creative Commons Attribution Share Alike 2.5" */
  CC_ATTRIBUTION_SHAREALIKE_2_5: 2,
  /** "Creative Commons Attribution 2.5" */
  CC_ATTRIBUTION_2_5: 3,
  /** "Creative Commons Attribution No Derivatives 2.5" */
  CC_ATTRIBUTION_NO_DERIVATIVES_2_5: 4,
  /** "Creative Commons Attribution Non-commercial 2.5" */
  CC_ATTRIBUTION_NONCOMMERCIAL_2_5: 5,
  /** "Creative Commons Attribution Non-commercial Share Alike 2.5" */
  CC_ATTRIBUTION_NONCOMMERCIAL_SHAREALIKE_2_5: 6,
  /** "Creative Commons Attribution Non-commercial No Derivatives 2.5" */
  CC_ATTRIBUTION_NONCOMMERCIAL_NO_DERIVATIVES_2_5: 7,
  /** "GNU Free Documentation License 1.2" */
  GFDL_1_2: 8,
  /** "Standard copyright (not recommended)" */
  STANDARD_COPYRIGHT: 11,
  /** "Creative Commons Attribution-ShareAlike 3.0 License (recommended)" */
  CC_ATTRIBUTION_SHAREALIKE_3_0: 12,
  /** "Creative Commons Attribution 3.0 License" */
  CC_ATTRIBUTION_3_0: 13,
  /** "Creative Commons Attribution-NoDerivs 3.0 License" */
  CC_ATTRIBUTION_NO_DERIVATIVES_3_0: 14,
  /** "Creative Commons Attribution-NonCommercial 3.0 License" */
  CC_ATTRIBUTION_NONCOMMERCIAL_3_0: 15,
  /** "Creative Commons Attribution-NonCommercial-ShareAlike 3.0 License" */
  CC_ATTRIBUTION_NONCOMMERCIAL_SHAREALIKE_3_0: 16,
  /** "Creative Commons Attribution-NonCommercial-NoDerivs 3.0 License" */
  CC_ATTRIBUTION_NONCOMMERCIAL_NO_DERIVATIVES_3_0: 17,
} as const;
export type SiteLicense = (typeof SiteLicense)[keyof typeof SiteLicense];

/** Raw category object shape as returned by Wikidot (snake_case wire format) */
export type RawSiteCategory = Record<string, unknown> & {
  category_id: number;
  site_id: number;
  name: string;
};

/** Constructor data for {@link SiteCategory} */
export interface SiteCategoryData {
  categoryId: number;
  siteId: number;
  name: string;
  themeDefault: boolean;
  /**
   * Normally an int theme id. Wikidot's own client sends the empty string
   * here (not 0) when `themeExternalUrl` is used instead (see
   * 40_admin-managesite.md "Appearance").
   */
  themeId: number | string;
  layoutDefault: boolean;
  layoutId: number;
  themeExternalUrl: string;
  permissionsDefault: boolean;
  /** undefined/null when permissionsDefault is true (inherits site default) */
  permissions: PagePermissions | null;
  licenseDefault: boolean;
  licenseId: number | null;
  licenseOther: string;
  navDefault: boolean;
  topBarPageName: string | null;
  sideBarPageName: string | null;
  templateId: number | null;
  /** null means "use site default" */
  perPageDiscussion: boolean | null;
  perPageDiscussionDefault: boolean;
  rating: RatingSettings | null;
  autonumerate: boolean;
  pageTitleTemplate: string | null;
  enablePingbackOut: boolean;
  enablePingbackIn: boolean;
  /**
   * Original response object, kept so toRaw() can round-trip fields this
   * library does not (yet) know about instead of dropping them
   */
  raw: RawSiteCategory;
}

/** A single category object from a site's Manage Site `categories` array */
export class SiteCategory {
  categoryId: number;
  siteId: number;
  name: string;
  themeDefault: boolean;
  themeId: number | string;
  layoutDefault: boolean;
  layoutId: number;
  themeExternalUrl: string;
  permissionsDefault: boolean;
  permissions: PagePermissions | null;
  licenseDefault: boolean;
  licenseId: number | null;
  licenseOther: string;
  navDefault: boolean;
  topBarPageName: string | null;
  sideBarPageName: string | null;
  templateId: number | null;
  perPageDiscussion: boolean | null;
  perPageDiscussionDefault: boolean;
  rating: RatingSettings | null;
  autonumerate: boolean;
  pageTitleTemplate: string | null;
  enablePingbackOut: boolean;
  enablePingbackIn: boolean;
  private readonly raw: RawSiteCategory;

  constructor(data: SiteCategoryData) {
    this.categoryId = data.categoryId;
    this.siteId = data.siteId;
    this.name = data.name;
    this.themeDefault = data.themeDefault;
    this.themeId = data.themeId;
    this.layoutDefault = data.layoutDefault;
    this.layoutId = data.layoutId;
    this.themeExternalUrl = data.themeExternalUrl;
    this.permissionsDefault = data.permissionsDefault;
    this.permissions = data.permissions;
    this.licenseDefault = data.licenseDefault;
    this.licenseId = data.licenseId;
    this.licenseOther = data.licenseOther;
    this.navDefault = data.navDefault;
    this.topBarPageName = data.topBarPageName;
    this.sideBarPageName = data.sideBarPageName;
    this.templateId = data.templateId;
    this.perPageDiscussion = data.perPageDiscussion;
    this.perPageDiscussionDefault = data.perPageDiscussionDefault;
    this.rating = data.rating;
    this.autonumerate = data.autonumerate;
    this.pageTitleTemplate = data.pageTitleTemplate;
    this.enablePingbackOut = data.enablePingbackOut;
    this.enablePingbackIn = data.enablePingbackIn;
    this.raw = data.raw;
  }

  /**
   * Parse a single category object from a `categories` array element
   * @param data - Raw category object as returned by Wikidot
   */
  static fromRaw(data: RawSiteCategory): SiteCategory {
    const permissionsStr = data.permissions;
    const ratingStr = data.rating;
    return new SiteCategory({
      categoryId: data.category_id,
      siteId: data.site_id,
      name: data.name,
      themeDefault: Boolean(data.theme_default ?? false),
      themeId: (data.theme_id as number | string | undefined) ?? 0,
      layoutDefault: Boolean(data.layout_default ?? true),
      layoutId: (data.layout_id as number | undefined) ?? 0,
      themeExternalUrl: (data.theme_external_url as string | undefined) || '',
      permissionsDefault: Boolean(data.permissions_default ?? false),
      permissions:
        typeof permissionsStr === 'string' && permissionsStr
          ? PagePermissions.decode(permissionsStr)
          : null,
      licenseDefault: Boolean(data.license_default ?? true),
      licenseId: (data.license_id as number | null | undefined) ?? null,
      licenseOther: (data.license_other as string | undefined) || '',
      navDefault: Boolean(data.nav_default ?? true),
      topBarPageName: (data.top_bar_page_name as string | null | undefined) ?? null,
      sideBarPageName: (data.side_bar_page_name as string | null | undefined) ?? null,
      templateId: (data.template_id as number | null | undefined) ?? null,
      perPageDiscussion: (data.per_page_discussion as boolean | null | undefined) ?? null,
      perPageDiscussionDefault: Boolean(data.per_page_discussion_default ?? true),
      rating: typeof ratingStr === 'string' && ratingStr ? RatingSettings.decode(ratingStr) : null,
      autonumerate: Boolean(data.autonumerate ?? false),
      pageTitleTemplate: (data.page_title_template as string | null | undefined) ?? null,
      enablePingbackOut: Boolean(data.enable_pingback_out ?? false),
      enablePingbackIn: Boolean(data.enable_pingback_in ?? false),
      raw: data,
    });
  }

  /**
   * Rebuild a category object for sending back to Wikidot.
   * Starts from the original raw object (so unknown fields survive the round
   * trip) and overwrites only the fields this class models.
   */
  toRaw(): RawSiteCategory {
    return {
      ...this.raw,
      category_id: this.categoryId,
      site_id: this.siteId,
      name: this.name,
      theme_default: this.themeDefault,
      theme_id: this.themeId,
      layout_default: this.layoutDefault,
      layout_id: this.layoutId,
      theme_external_url: this.themeExternalUrl,
      permissions_default: this.permissionsDefault,
      permissions: this.permissions ? this.permissions.encode() : null,
      license_default: this.licenseDefault,
      license_id: this.licenseId,
      license_other: this.licenseOther,
      nav_default: this.navDefault,
      top_bar_page_name: this.topBarPageName,
      side_bar_page_name: this.sideBarPageName,
      template_id: this.templateId,
      per_page_discussion: this.perPageDiscussion,
      per_page_discussion_default: this.perPageDiscussionDefault,
      rating: this.rating ? this.rating.encode() : null,
      autonumerate: this.autonumerate,
      page_title_template: this.pageTitleTemplate,
      enable_pingback_out: this.enablePingbackOut,
      enable_pingback_in: this.enablePingbackIn,
    };
  }

  /**
   * Update the specified page-permission fields, leaving the rest unchanged.
   * Also clears `permissionsDefault` (this category now has its own explicit
   * permissions instead of inheriting the site default).
   */
  setPermissions(updates: Partial<Record<keyof PagePermissionsData, Iterable<Actor>>>): void {
    const current = this.permissions ?? new PagePermissions();
    this.permissions = current.withUpdates(updates);
    this.permissionsDefault = false;
  }
}

/**
 * The full `categories` array for a site, keyed by category name.
 *
 * Never cached (see 30_plan.md D3): a new collection is fetched every time
 * `SettingsAccessor.updateCategories` is called, so concurrent changes by
 * other admins are not clobbered by a stale save.
 */
export class SiteCategoryCollection {
  readonly site: Site;
  readonly categories: SiteCategory[];

  constructor(site: Site, categories: SiteCategory[]) {
    this.site = site;
    this.categories = categories;
  }

  /**
   * Look up a category by name
   * @throws {Error} If no category with that name exists
   */
  get(name: string): SiteCategory {
    const category = this.categories.find((c) => c.name === name);
    if (!category) {
      throw new Error(`Category not found: ${name}`);
    }
    return category;
  }

  /** Get all category names */
  names(): string[] {
    return this.categories.map((c) => c.name);
  }

  get length(): number {
    return this.categories.length;
  }

  /**
   * Fetch the current `categories` array by rendering a Manage Site module
   * @param site - Site to fetch categories for
   * @param moduleName - Any Manage Site module documented to embed the full
   * `categories` array in its response (e.g.
   * "managesite/ManageSitePermissionsModule")
   */
  static fetch(site: Site, moduleName: string): WikidotResultAsync<SiteCategoryCollection> {
    return fromPromise(
      (async () => {
        const result = await site.amcRequestSingle({ moduleName });
        if (result.isErr()) {
          throw result.error;
        }
        const rawCategories = result.value.categories;
        if (!Array.isArray(rawCategories)) {
          throw new ResponseDataError(`Response has no 'categories' field: ${moduleName}`);
        }
        return new SiteCategoryCollection(
          site,
          (rawCategories as RawSiteCategory[]).map((item) => SiteCategory.fromRaw(item))
        );
      })(),
      (error) => {
        if (error instanceof ResponseDataError) return error as unknown as WikidotError;
        return error as WikidotError;
      }
    );
  }

  /**
   * Send the full `categories` array back to Wikidot
   * @param action - AMC action (e.g. "ManageSiteAction")
   * @param event - AMC event (e.g. "savePermissions")
   */
  save(action: string, event: string): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequestSingle({
          action,
          event,
          categories: jsonParam(this.categories.map((c) => c.toRaw())),
          moduleName: 'Empty',
        });
        if (result.isErr()) {
          throw result.error;
        }
      })(),
      (error) => error as WikidotError
    );
  }
}
