import type { WikidotResultAsync } from '../../../common/types';
import {
  ForumCategory,
  ForumCategoryCollection,
  ForumPost,
  ForumThread,
  ForumThreadCollection,
} from '../../forum';
import type { Site } from '../site';

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
}

export { ForumCategory, ForumCategoryCollection, ForumThread, ForumThreadCollection, ForumPost };
