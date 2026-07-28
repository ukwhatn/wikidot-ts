/**
 * Module for Wikidot's forum-wide admin settings (Manage Site's Forum panel)
 *
 * Access through `Site.forum` (`ForumAccessor` in accessors/forum-accessor.ts),
 * which holds thin delegating wrappers over the functions/classes defined
 * here -- see 30_plan.md D6 ("site.forum: 既存 + フォーラム管理") and
 * 32_tasks.md Task 4-4 in the sibling wikidot.py repo's memory directory.
 * This is a direct port of wikidot.py's `module/forum_admin.py`.
 *
 * `ManageSiteForumAction/savePerPageDiscussion` is intentionally NOT
 * reimplemented here: it is one of the seven `categories`-backed settings
 * areas and already lives at `SettingsAccessor.setPerPageDiscussion` (Task
 * 1-4, in settings-accessor.ts). Duplicating its read-modify-write cycle
 * here would give two independent implementations of the same operation.
 */

import { ResponseDataError, type WikidotError } from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { jsonParam } from '../../connector/amc-body';
import type { Site } from './site';
import type { ForumPermissions } from './site-permissions';

const MODULE_GET_FORUM_LAYOUT = 'managesite/ManageSiteGetForumLayoutModule';

/**
 * Enable the forum for a site that does not have one yet.
 * `ManageSiteForumAction/activateForum` takes no parameters.
 */
export function activateForum(site: Site): WikidotResultAsync<void> {
  return fromPromise(
    (async () => {
      const result = await site.amcRequestSingle({
        action: 'ManageSiteForumAction',
        event: 'activateForum',
        moduleName: 'Empty',
      });
      if (result.isErr()) {
        throw result.error;
      }
    })(),
    (error) => error as WikidotError
  );
}

/**
 * Set the forum's site-wide default reply nesting depth.
 * @param maxNestLevel - 0-10 (0 = flat, no nested replies)
 * @throws {Error} If maxNestLevel is out of range
 */
export function setForumDefaultNesting(site: Site, maxNestLevel: number): WikidotResultAsync<void> {
  if (maxNestLevel < 0 || maxNestLevel > 10) {
    throw new Error(`maxNestLevel must be between 0 and 10, got ${maxNestLevel}`);
  }
  return fromPromise(
    (async () => {
      const result = await site.amcRequestSingle({
        action: 'ManageSiteForumAction',
        event: 'saveForumDefaultNesting',
        moduleName: 'Empty',
        max_nest_level: maxNestLevel,
      });
      if (result.isErr()) {
        throw result.error;
      }
    })(),
    (error) => error as WikidotError
  );
}

/** Raw forum group object shape as returned by Wikidot (snake_case wire format) */
export type RawForumLayoutGroup = Record<string, unknown> & {
  name?: string;
  description?: string;
  visible?: boolean;
};

/**
 * A single forum group entry from `saveForumLayout`'s `groups` array.
 *
 * Compares by reference (the default for a TS class), not by field values:
 * `ForumLayout` looks up a group's index with `indexOf`, and two distinct
 * groups can legitimately share the same name/description/visible values.
 */
export class ForumLayoutGroup {
  name: string;
  description: string;
  visible: boolean;
  /**
   * Original response object (holds `group_id` and any other field this
   * library does not model), kept so `toRaw()` round-trips fields it does
   * not know about instead of dropping them. Empty for a group created
   * locally via `ForumLayout.addGroup` (Wikidot assigns `group_id` on save)
   */
  private readonly raw: RawForumLayoutGroup;

  constructor(data: {
    name: string;
    description?: string;
    visible?: boolean;
    raw?: RawForumLayoutGroup;
  }) {
    this.name = data.name;
    this.description = data.description ?? '';
    this.visible = data.visible ?? true;
    this.raw = data.raw ?? {};
  }

  /** Parse a single `groups` array element */
  static fromRaw(data: RawForumLayoutGroup): ForumLayoutGroup {
    return new ForumLayoutGroup({
      name: data.name ?? '',
      description: data.description ?? '',
      visible: Boolean(data.visible ?? true),
      raw: data,
    });
  }

  /** Rebuild a `groups` array element for sending back to Wikidot */
  toRaw(): RawForumLayoutGroup {
    return { ...this.raw, name: this.name, description: this.description, visible: this.visible };
  }
}

/** Raw forum category object shape as returned by Wikidot (snake_case wire format) */
export type RawForumLayoutCategory = Record<string, unknown> & {
  name?: string;
  description?: string;
  max_nest_level?: number | null;
  category_id?: number;
  number_threads?: number;
};

/**
 * A single forum category entry from `saveForumLayout`'s `categories` array.
 * Compares by reference, like ForumLayoutGroup.
 */
export class ForumLayoutCategory {
  name: string;
  description: string;
  /** 0-10, or null to inherit the forum's site-wide default */
  maxNestLevel: number | null;
  /** undefined for a category created locally that Wikidot has not assigned an ID to yet */
  categoryId: number | undefined;
  /**
   * Thread count as last reported by Wikidot. Read-only local info, not sent
   * back on save (kept only so callers can guard against removing a
   * non-empty category)
   */
  readonly numberThreads: number | undefined;
  private readonly raw: RawForumLayoutCategory;

  constructor(data: {
    name: string;
    description?: string;
    maxNestLevel?: number | null;
    categoryId?: number;
    numberThreads?: number;
    raw?: RawForumLayoutCategory;
  }) {
    this.name = data.name;
    this.description = data.description ?? '';
    this.maxNestLevel = data.maxNestLevel ?? null;
    this.categoryId = data.categoryId;
    this.numberThreads = data.numberThreads;
    this.raw = data.raw ?? {};
  }

  /** Parse a single `categories[groupIndex]` array element */
  static fromRaw(data: RawForumLayoutCategory): ForumLayoutCategory {
    return new ForumLayoutCategory({
      name: data.name ?? '',
      description: data.description ?? '',
      maxNestLevel: data.max_nest_level ?? null,
      categoryId: data.category_id,
      numberThreads: data.number_threads,
      raw: data,
    });
  }

  /** Rebuild a `categories[groupIndex]` array element for sending back */
  toRaw(): RawForumLayoutCategory {
    const result: RawForumLayoutCategory = {
      ...this.raw,
      name: this.name,
      description: this.description,
      max_nest_level: this.maxNestLevel,
    };
    if (this.categoryId !== undefined) {
      result.category_id = this.categoryId;
    } else {
      delete result.category_id;
    }
    return result;
  }
}

/**
 * The full forum group/category layout for a site (`saveForumLayout`'s
 * read-modify-write cycle).
 *
 * `categories` is Wikidot's own two-dimensional shape: `categories[i]` holds
 * the ForumLayoutCategory list belonging to `groups[i]` (same index).
 * Adding/removing a group keeps both arrays in sync so this invariant is
 * never violated by calling code.
 *
 * `defaultNesting` is informational only (as returned alongside the layout
 * by `managesite/ManageSiteGetForumLayoutModule`); changing it goes through
 * `setForumDefaultNesting` / `ManageSiteForumAction/saveForumDefaultNesting`
 * instead, a separate event from `saveForumLayout` -- this class does not
 * send it back.
 *
 * Never cached: call `ForumLayout.fetch` again for the latest state before
 * editing, consistent with `SiteCategoryCollection` (30_plan.md D3).
 */
export class ForumLayout {
  readonly site: Site;
  groups: ForumLayoutGroup[];
  categories: ForumLayoutCategory[][];
  readonly defaultNesting: number | null;
  private deletedGroups: RawForumLayoutGroup[] = [];
  private deletedCategoryIds: number[] = [];

  constructor(
    site: Site,
    groups: ForumLayoutGroup[],
    categories: ForumLayoutCategory[][],
    defaultNesting: number | null
  ) {
    this.site = site;
    this.groups = groups;
    this.categories = categories;
    this.defaultNesting = defaultNesting;
  }

  /** Fetch the current forum layout */
  static fetch(site: Site): WikidotResultAsync<ForumLayout> {
    return fromPromise(
      (async () => {
        const result = await site.amcRequestSingle({ moduleName: MODULE_GET_FORUM_LAYOUT });
        if (result.isErr()) {
          throw result.error;
        }
        const rawGroups = result.value.groups;
        const rawCategories = result.value.categories;
        if (!Array.isArray(rawGroups) || !Array.isArray(rawCategories)) {
          throw new ResponseDataError(
            `Response has no 'groups'/'categories' field: ${MODULE_GET_FORUM_LAYOUT}`
          );
        }
        const groups = (rawGroups as RawForumLayoutGroup[]).map((g) => ForumLayoutGroup.fromRaw(g));
        const categories = (rawCategories as RawForumLayoutCategory[][]).map((groupCats) =>
          groupCats.map((c) => ForumLayoutCategory.fromRaw(c))
        );
        const defaultNesting =
          typeof result.value.defaultNesting === 'number' ? result.value.defaultNesting : null;
        return new ForumLayout(site, groups, categories, defaultNesting);
      })(),
      (error) => {
        if (error instanceof ResponseDataError) return error as unknown as WikidotError;
        return error as WikidotError;
      }
    );
  }

  /** Look up a group's index by reference, throwing if it isn't part of this layout */
  private groupIndex(group: ForumLayoutGroup): number {
    const index = this.groups.indexOf(group);
    if (index === -1) {
      throw new Error('group does not belong to this ForumLayout');
    }
    return index;
  }

  /**
   * Add a new (empty) group to the layout
   * @returns The newly created group (append categories to it via `addCategory`)
   */
  addGroup(name: string, description = '', visible = true): ForumLayoutGroup {
    const newGroup = new ForumLayoutGroup({ name, description, visible });
    this.groups.push(newGroup);
    this.categories.push([]);
    return newGroup;
  }

  /**
   * Add a new category to a group in this layout
   * @param group - Must be a group already in this layout (from `fetch` or `addGroup`)
   */
  addCategory(
    group: ForumLayoutGroup,
    name: string,
    description = '',
    maxNestLevel: number | null = null
  ): ForumLayoutCategory {
    const index = this.groupIndex(group);
    const newCategory = new ForumLayoutCategory({ name, description, maxNestLevel });
    this.categories[index]?.push(newCategory);
    return newCategory;
  }

  /**
   * Remove a group and every category in it. Destructive and irreversible.
   *
   * Wikidot's own UI refuses to delete a non-empty group client-side;
   * whether the server re-validates this is unconfirmed, so this method
   * does not attempt the same check -- pass confirm=true to acknowledge you
   * want the group (and its categories) gone regardless.
   * @throws {Error} If confirm is not true, or group does not belong to this layout
   */
  removeGroup(group: ForumLayoutGroup, confirm: boolean): void {
    if (!confirm) {
      throw new Error('removeGroup is destructive; pass confirm=true to proceed');
    }
    const index = this.groupIndex(group);
    const [removedGroup] = this.groups.splice(index, 1);
    const [removedCategories] = this.categories.splice(index, 1);
    if (removedGroup) {
      this.deletedGroups.push(removedGroup.toRaw());
    }
    for (const category of removedCategories ?? []) {
      if (category.categoryId !== undefined) {
        this.deletedCategoryIds.push(category.categoryId);
      }
    }
  }

  /**
   * Remove a single category from a group. Destructive and irreversible.
   *
   * Wikidot's own UI refuses to delete a category that still has threads
   * client-side (see `category.numberThreads`); whether the server
   * re-validates this is unconfirmed, so pass confirm=true to acknowledge
   * you want it gone regardless.
   * @throws {Error} If confirm is not true, or group/category do not belong to this layout
   */
  removeCategory(group: ForumLayoutGroup, category: ForumLayoutCategory, confirm: boolean): void {
    if (!confirm) {
      throw new Error('removeCategory is destructive; pass confirm=true to proceed');
    }
    const groupIdx = this.groupIndex(group);
    const categories = this.categories[groupIdx] ?? [];
    const categoryIdx = categories.indexOf(category);
    if (categoryIdx === -1) {
      throw new Error('category does not belong to the given group');
    }
    categories.splice(categoryIdx, 1);
    if (category.categoryId !== undefined) {
      this.deletedCategoryIds.push(category.categoryId);
    }
  }

  /**
   * Send the layout back to Wikidot (`ManageSiteForumAction/saveForumLayout`).
   *
   * Sends `groups`, `categories`, `deleted_groups`, `deleted_categories`
   * every time (Wikidot's own client always builds and submits all four,
   * whether or not anything was deleted this round). Clears the
   * pending-deletion lists on success.
   */
  save(): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequestSingle({
          action: 'ManageSiteForumAction',
          event: 'saveForumLayout',
          moduleName: 'Empty',
          groups: jsonParam(this.groups.map((g) => g.toRaw())),
          categories: jsonParam(
            this.categories.map((groupCats) => groupCats.map((c) => c.toRaw()))
          ),
          deleted_groups: jsonParam(this.deletedGroups),
          deleted_categories: jsonParam(this.deletedCategoryIds),
        });
        if (result.isErr()) {
          throw result.error;
        }
        this.deletedGroups = [];
        this.deletedCategoryIds = [];
      })(),
      (error) => error as WikidotError
    );
  }
}

/**
 * A single element of `saveForumPermissions`'s `categories` array: one forum
 * category's permission override.
 */
export class ForumCategoryPermissionOverride {
  readonly categoryId: number;
  /**
   * null means "inherit the site-wide default permissions"
   * (40_admin-managesite.md: フォーラムカテゴリの permissions が null の場合は
   * 「サイト既定を使う」)
   */
  readonly permissions: ForumPermissions | null;

  constructor(categoryId: number, permissions: ForumPermissions | null) {
    this.categoryId = categoryId;
    this.permissions = permissions;
  }

  /**
   * Encode as the `{category_id, permissions}` shape `saveForumPermissions` expects.
   *
   * This field shape (`category_id` + `permissions`) was not directly
   * observed for this specific event -- no corresponding "get forum
   * permissions" module response was captured during the survey, unlike
   * `ManageSiteGetForumLayoutModule` for the layout side. It is inferred
   * from the same two field names Wikidot uses consistently elsewhere for a
   * forum category object (`ForumLayoutCategory.categoryId`,
   * `SiteCategory.permissions`), not invented from scratch. Treat
   * `saveForumPermissions` as unverified against a live site until confirmed
   */
  toRaw(): { category_id: number; permissions: string | null } {
    return {
      category_id: this.categoryId,
      permissions: this.permissions ? this.permissions.encode() : null,
    };
  }
}

/**
 * Save forum-wide default permissions and any per-category overrides.
 *
 * `ManageSiteForumAction/saveForumPermissions` sends the *entire* `categories`
 * array like every other categories-backed save in this library (30_plan.md
 * D3) -- there is no read endpoint confirmed for this specific event (see
 * `ForumCategoryPermissionOverride.toRaw`), so unlike `SettingsAccessor`'s
 * categories helpers this cannot offer a fetch-mutate-save cycle. Callers
 * must pass the complete desired set of overrides; categories left out of
 * `categoryPermissions` are not guaranteed to keep their current override
 * (server behavior for omitted categories is unconfirmed).
 *
 * Does not check login state before sending, matching the convention already
 * established by `settings-accessor.ts`'s Manage Site save methods (none of
 * them gate locally either -- a `no_permission` response surfaces as a
 * ForbiddenError from the transport layer instead).
 */
export function saveForumPermissions(
  site: Site,
  defaultPermissions: ForumPermissions,
  categoryPermissions: ForumCategoryPermissionOverride[] = []
): WikidotResultAsync<void> {
  return fromPromise(
    (async () => {
      const result = await site.amcRequestSingle({
        action: 'ManageSiteForumAction',
        event: 'saveForumPermissions',
        moduleName: 'Empty',
        default_permissions: defaultPermissions.encode(),
        categories: jsonParam(categoryPermissions.map((o) => o.toRaw())),
      });
      if (result.isErr()) {
        throw result.error;
      }
    })(),
    (error) => error as WikidotError
  );
}
