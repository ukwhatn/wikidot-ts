import * as cheerio from 'cheerio';
import { RequireLogin } from '../../common/decorators';
import { LoginRequiredError, NoElementError, UnexpectedError } from '../../common/errors';
import { type WikidotResultAsync, fromPromise } from '../../common/types';
import type { Site } from '../site';
import { ForumThread, ForumThreadCollection } from './forum-thread';

/**
 * フォーラムカテゴリデータ
 */
export interface ForumCategoryData {
  site: Site;
  id: number;
  title: string;
  description: string;
  threadsCount: number;
  postsCount: number;
}

/**
 * フォーラムカテゴリ
 */
export class ForumCategory {
  public readonly site: Site;
  public readonly id: number;
  public readonly title: string;
  public readonly description: string;
  public readonly threadsCount: number;
  public readonly postsCount: number;
  private _threads: ForumThreadCollection | null = null;

  constructor(data: ForumCategoryData) {
    this.site = data.site;
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.threadsCount = data.threadsCount;
    this.postsCount = data.postsCount;
  }

  /**
   * スレッド一覧を取得
   */
  getThreads(): WikidotResultAsync<ForumThreadCollection> {
    if (this._threads !== null) {
      return fromPromise(Promise.resolve(this._threads), (e) => new UnexpectedError(String(e)));
    }

    return fromPromise(
      (async () => {
        const result = await ForumThreadCollection.acquireAllInCategory(this);
        if (result.isErr()) {
          throw result.error;
        }
        this._threads = result.value;
        return this._threads;
      })(),
      (error) => new UnexpectedError(`Failed to get threads: ${String(error)}`)
    );
  }

  /**
   * スレッド一覧を再取得
   */
  reloadThreads(): WikidotResultAsync<ForumThreadCollection> {
    this._threads = null;
    return this.getThreads();
  }

  /**
   * スレッドを作成
   */
  @RequireLogin
  createThread(
    title: string,
    description: string,
    source: string
  ): WikidotResultAsync<ForumThread> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            moduleName: 'Empty',
            action: 'ForumAction',
            event: 'newThread',
            category_id: this.id,
            title,
            description,
            source,
          },
        ]);

        if (result.isErr()) {
          throw result.error;
        }

        const response = result.value[0];
        if (!response || typeof response.threadId !== 'number') {
          throw new NoElementError('Thread ID not found in response');
        }

        const threadId = response.threadId as number;
        const threadResult = await ForumThread.getFromId(this.site, threadId, this);
        if (threadResult.isErr()) {
          throw threadResult.error;
        }
        return threadResult.value;
      })(),
      (error) => {
        if (error instanceof NoElementError || error instanceof LoginRequiredError) {
          return error;
        }
        return new UnexpectedError(`Failed to create thread: ${String(error)}`);
      }
    );
  }

  toString(): string {
    return `ForumCategory(id=${this.id}, title=${this.title})`;
  }
}

/**
 * フォーラムカテゴリコレクション
 */
export class ForumCategoryCollection extends Array<ForumCategory> {
  public readonly site: Site;

  constructor(site: Site, categories?: ForumCategory[]) {
    super();
    this.site = site;
    if (categories) {
      this.push(...categories);
    }
  }

  /**
   * IDで検索
   */
  findById(id: number): ForumCategory | undefined {
    return this.find((category) => category.id === id);
  }

  /**
   * サイトの全カテゴリを取得
   */
  static acquireAll(site: Site): WikidotResultAsync<ForumCategoryCollection> {
    return fromPromise(
      (async () => {
        const result = await site.amcRequest([
          {
            moduleName: 'forum/ForumStartModule',
            hidden: 'true',
          },
        ]);

        if (result.isErr()) {
          throw result.error;
        }

        const response = result.value[0];
        if (!response) {
          throw new NoElementError('Empty response');
        }

        const body = String(response.body ?? '');
        const $ = cheerio.load(body);

        const categories: ForumCategory[] = [];

        $('table tr.head~tr').each((_i, row) => {
          const $row = $(row);
          const nameElem = $row.find('td.name');
          const nameLinkElem = nameElem.find('a');
          const href = nameLinkElem.attr('href') ?? '';

          const categoryIdMatch = href.match(/c-(\d+)/);
          if (!categoryIdMatch?.[1]) return;

          const categoryId = Number.parseInt(categoryIdMatch[1], 10);
          const title = nameLinkElem.text().trim();
          const description = nameElem.find('div.description').text().trim();
          const threadsCount = Number.parseInt($row.find('td.threads').text().trim(), 10) || 0;
          const postsCount = Number.parseInt($row.find('td.posts').text().trim(), 10) || 0;

          categories.push(
            new ForumCategory({
              site,
              id: categoryId,
              title,
              description,
              threadsCount,
              postsCount,
            })
          );
        });

        return new ForumCategoryCollection(site, categories);
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to acquire categories: ${String(error)}`);
      }
    );
  }
}
