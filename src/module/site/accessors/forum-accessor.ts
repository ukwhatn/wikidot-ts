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
 * フォーラム操作アクセサ
 */
export class ForumAccessor {
  public readonly site: Site;

  constructor(site: Site) {
    this.site = site;
  }

  /**
   * フォーラムカテゴリ一覧を取得
   * @returns カテゴリ一覧
   */
  getCategories(): WikidotResultAsync<ForumCategoryCollection> {
    return ForumCategoryCollection.acquireAll(this.site);
  }

  /**
   * スレッドを取得
   * @param threadId - スレッドID
   * @returns スレッド
   */
  getThread(threadId: number): WikidotResultAsync<ForumThread> {
    return ForumThread.getFromId(this.site, threadId);
  }

  /**
   * 複数スレッドを取得
   * @param threadIds - スレッドID配列
   * @returns スレッドコレクション
   */
  getThreads(threadIds: number[]): WikidotResultAsync<ForumThreadCollection> {
    return ForumThreadCollection.acquireFromThreadIds(this.site, threadIds);
  }
}

export { ForumCategory, ForumCategoryCollection, ForumThread, ForumThreadCollection, ForumPost };
