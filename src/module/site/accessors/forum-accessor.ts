import type { WikidotResultAsync } from '../../../common/types';
import {
  ForumCategory,
  ForumCategoryCollection,
  ForumPost,
  ForumThread,
  ForumThreadCollection,
} from '../../forum';
import {
  activateForum,
  ForumCategoryPermissionsCollection,
  ForumLayout,
  setForumDefaultNesting,
  updateForumPermissions,
} from '../forum-admin';
import type { Site } from '../site';
import type { ForumPermissions } from '../site-permissions';

/**
 * Forum operations accessor
 */
export class ForumAccessor {
  public readonly site: Site;

  constructor(site: Site) {
    this.site = site;
  }

  /**
   * Get forum category list
   * @returns Category list
   */
  getCategories(): WikidotResultAsync<ForumCategoryCollection> {
    return ForumCategoryCollection.acquireAll(this.site);
  }

  /**
   * Get thread
   * @param threadId - Thread ID
   * @returns Thread
   */
  getThread(threadId: number): WikidotResultAsync<ForumThread> {
    return ForumThread.getFromId(this.site, threadId);
  }

  /**
   * Get multiple threads
   * @param threadIds - Array of thread IDs
   * @returns Thread collection
   */
  getThreads(threadIds: number[]): WikidotResultAsync<ForumThreadCollection> {
    return ForumThreadCollection.acquireFromThreadIds(this.site, threadIds);
  }

  /** Enable the forum for this site (`ManageSiteForumAction/activateForum`) */
  activate(): WikidotResultAsync<void> {
    return activateForum(this.site);
  }

  /**
   * Set the forum's site-wide default reply nesting depth
   * @param maxNestLevel - 0-10 (0 = flat)
   */
  setDefaultNesting(maxNestLevel: number): WikidotResultAsync<void> {
    return setForumDefaultNesting(this.site, maxNestLevel);
  }

  /**
   * Fetch the current forum group/category layout for editing
   */
  getLayout(): WikidotResultAsync<ForumLayout> {
    return ForumLayout.fetch(this.site);
  }

  /**
   * Fetch the current forum category permissions, mutate them, and save
   * them back.
   *
   * See `forum-admin.ts`'s `updateForumPermissions` for why this must be a
   * fetch-mutate-save cycle rather than accepting a hand-built override
   * list (`ManageSiteForumAction/saveForumPermissions` sends the module's
   * entire fetched `categories` array).
   * @param mutator - Called with the freshly fetched collection; mutate
   * categories in place (e.g. `collection.get(categoryId).setPermissions(...)`)
   * @param defaultPermissions - Site-wide default forum permissions to
   * also set. Only sent when explicitly provided -- see
   * `ForumCategoryPermissionsCollection.save`'s docs for why this can't
   * be fetched and preserved automatically
   */
  updatePermissions(
    mutator: (categories: ForumCategoryPermissionsCollection) => void,
    defaultPermissions?: ForumPermissions
  ): WikidotResultAsync<void> {
    return updateForumPermissions(this.site, mutator, defaultPermissions);
  }

  /**
   * Create a page's discussion (comment) thread if it does not already have one
   * @param pageId - Numeric page ID (not the page's unix name)
   * @returns See `ForumThread.createForPage` for why this can be null
   */
  createPageDiscussionThread(pageId: number): WikidotResultAsync<ForumThread | null> {
    return ForumThread.createForPage(this.site, pageId);
  }
}

export {
  ForumCategory,
  ForumCategoryCollection,
  ForumCategoryPermissionsCollection,
  ForumLayout,
  ForumPost,
  ForumThread,
  ForumThreadCollection,
};
