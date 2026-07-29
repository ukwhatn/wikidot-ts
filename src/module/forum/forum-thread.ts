import type { Cheerio } from 'cheerio';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { RequireLogin } from '../../common/decorators';
import { LoginRequiredError, NoElementError, UnexpectedError } from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { requireBody } from '../../connector';
import { flag, omitFalsy } from '../../connector/amc-body';
import { parseOdate, parseUser } from '../../util/parser';
import type { Site } from '../site';
import type { AbstractUser } from '../user';
import type { ForumCategory } from './forum-category';
import { ForumPostCollection } from './forum-post';

/**
 * Forum thread data
 */
export interface ForumThreadData {
  site: Site;
  id: number;
  title: string;
  description: string;
  createdBy: AbstractUser | null;
  createdAt: Date;
  postCount: number;
  category?: ForumCategory | null;
}

/**
 * Forum thread
 */
export class ForumThread {
  public readonly site: Site;
  public readonly id: number;
  public title: string;
  public description: string;
  public readonly createdBy: AbstractUser | null;
  public readonly createdAt: Date;
  public postCount: number;
  public category: ForumCategory | null;
  private _posts: ForumPostCollection | null = null;

  constructor(data: ForumThreadData) {
    this.site = data.site;
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt;
    this.postCount = data.postCount;
    this.category = data.category ?? null;
  }

  /**
   * Get thread URL
   */
  getUrl(): string {
    return `${this.site.getBaseUrl()}/forum/t-${this.id}/`;
  }

  /**
   * Get post list
   */
  getPosts(): WikidotResultAsync<ForumPostCollection> {
    if (this._posts !== null) {
      return fromPromise(Promise.resolve(this._posts), (e) => new UnexpectedError(String(e)));
    }

    return fromPromise(
      (async () => {
        const result = await ForumPostCollection.acquireAllInThreads([this]);
        if (result.isErr()) {
          throw result.error;
        }
        this._posts = result.value.get(this.id) ?? new ForumPostCollection(this, []);
        return this._posts;
      })(),
      (error) => new UnexpectedError(`Failed to get posts: ${String(error)}`)
    );
  }

  /**
   * Reply to thread
   */
  @RequireLogin
  reply(
    source: string,
    title = '',
    parentPostId: number | null = null
  ): WikidotResultAsync<ForumThread> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            threadId: String(this.id),
            parentId: parentPostId !== null ? String(parentPostId) : '',
            title,
            source,
            action: 'ForumAction',
            event: 'savePost',
            moduleName: 'Empty',
          },
        ]);
        if (result.isErr()) {
          throw result.error;
        }
        this._posts = null;
        this.postCount += 1;
        return this;
      })(),
      (error) => new UnexpectedError(`Failed to reply: ${String(error)}`)
    );
  }

  /**
   * Update the thread's title and/or description.
   *
   * Sends both fields on every call (`ForumAction/saveThreadMeta` resubmits
   * the whole `thread-meta-form`, it does not patch a single field), so
   * omitted arguments default to the thread's current locally-known
   * title/description instead of blanking them.
   * @param title - New title. Keeps the current title if omitted
   * @param description - New description (1000 character limit). Keeps the
   * current description if omitted
   */
  @RequireLogin
  saveMeta(title?: string, description?: string): WikidotResultAsync<ForumThread> {
    const newTitle = title ?? this.title;
    const newDescription = description ?? this.description;
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            action: 'ForumAction',
            event: 'saveThreadMeta',
            moduleName: 'Empty',
            threadId: this.id,
            title: newTitle,
            description: newDescription,
          },
        ]);
        if (result.isErr()) {
          throw result.error;
        }
        this.title = newTitle;
        this.description = newDescription;
        return this;
      })(),
      (error) => new UnexpectedError(`Failed to save thread meta: ${String(error)}`)
    );
  }

  /**
   * Pin or unpin the thread within its category
   * @param sticky - true to pin, false to unpin
   */
  @RequireLogin
  setSticky(sticky: boolean): WikidotResultAsync<ForumThread> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            action: 'ForumAction',
            event: 'saveSticky',
            moduleName: 'Empty',
            threadId: this.id,
            ...omitFalsy({ sticky: flag(sticky) }),
          },
        ]);
        if (result.isErr()) {
          throw result.error;
        }
        return this;
      })(),
      (error) => new UnexpectedError(`Failed to set sticky: ${String(error)}`)
    );
  }

  /**
   * Lock or unlock the thread (locked threads reject new posts)
   * @param block - true to lock, false to unlock
   */
  @RequireLogin
  setBlock(block: boolean): WikidotResultAsync<ForumThread> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            action: 'ForumAction',
            event: 'saveBlock',
            moduleName: 'Empty',
            threadId: this.id,
            ...omitFalsy({ block: flag(block) }),
          },
        ]);
        if (result.isErr()) {
          throw result.error;
        }
        return this;
      })(),
      (error) => new UnexpectedError(`Failed to set block: ${String(error)}`)
    );
  }

  /**
   * Move the thread to a different forum category
   * @param category - Destination category
   */
  @RequireLogin
  move(category: ForumCategory): WikidotResultAsync<ForumThread> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            action: 'ForumAction',
            event: 'moveThread',
            moduleName: 'Empty',
            threadId: this.id,
            categoryId: category.id,
          },
        ]);
        if (result.isErr()) {
          throw result.error;
        }
        this.category = category;
        return this;
      })(),
      (error) => new UnexpectedError(`Failed to move thread: ${String(error)}`)
    );
  }

  /**
   * Start watching the thread (email notification on new posts)
   */
  @RequireLogin
  watch(): WikidotResultAsync<ForumThread> {
    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            action: 'WatchAction',
            event: 'watchThread',
            moduleName: 'Empty',
            threadId: this.id,
          },
        ]);
        if (result.isErr()) {
          throw result.error;
        }
        return this;
      })(),
      (error) => new UnexpectedError(`Failed to watch thread: ${String(error)}`)
    );
  }

  toString(): string {
    return `ForumThread(id=${this.id}, title=${this.title})`;
  }

  /**
   * Create a page's discussion (comment) thread if it does not already have one.
   * @param site - Site the page belongs to
   * @param pageId - Numeric page ID (not the page's unix name)
   * @returns The created thread, or `null` if the response did not include a
   * recognizable thread ID. The survey of `ForumAction/createPageDiscussionThread`
   * only confirmed the request parameter (`page_id`); the response schema was
   * not captured, so this does not assume a `threadId` field is present and
   * guess-parse it -- callers that get `null` back can still locate the
   * thread via the page's `/comments/show` view
   */
  static createForPage(site: Site, pageId: number): WikidotResultAsync<ForumThread | null> {
    // Static method: `this` inside a decorated function would be the class
    // itself, not an instance, so `@RequireLogin` (which reads
    // this.client/this.site/this.thread) does not apply here -- check
    // manually instead, matching Page.createOrEdit's static factory pattern.
    const loginResult = site.client.requireLogin();
    if (loginResult.isErr()) {
      return fromPromise(
        Promise.reject(loginResult.error),
        () => new LoginRequiredError('Login required to create a page discussion thread')
      );
    }

    return fromPromise(
      (async () => {
        const result = await site.amcRequest([
          {
            action: 'ForumAction',
            event: 'createPageDiscussionThread',
            moduleName: 'Empty',
            page_id: pageId,
          },
        ]);
        if (result.isErr()) {
          throw result.error;
        }
        const response = result.value[0];
        const threadId = response?.threadId;
        if (typeof threadId !== 'number') {
          return null;
        }
        const threadResult = await ForumThread.getFromId(site, threadId);
        if (threadResult.isErr()) {
          throw threadResult.error;
        }
        return threadResult.value;
      })(),
      (error) => new UnexpectedError(`Failed to create page discussion thread: ${String(error)}`)
    );
  }

  /**
   * Get thread by ID
   */
  static getFromId(
    site: Site,
    threadId: number,
    category: ForumCategory | null = null
  ): WikidotResultAsync<ForumThread> {
    return fromPromise(
      (async () => {
        const result = await ForumThreadCollection.acquireFromThreadIds(site, [threadId], category);
        if (result.isErr()) {
          throw result.error;
        }
        const thread = result.value[0];
        if (!thread) {
          throw new NoElementError(`Thread not found: ${threadId}`);
        }
        return thread;
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to get thread: ${String(error)}`);
      }
    );
  }
}

/**
 * Forum thread collection
 */
export class ForumThreadCollection extends Array<ForumThread> {
  public readonly site: Site;

  constructor(site: Site, threads?: ForumThread[]) {
    super();
    this.site = site;
    if (threads) {
      this.push(...threads);
    }
  }

  /**
   * Find by ID
   */
  findById(id: number): ForumThread | undefined {
    return this.find((thread) => thread.id === id);
  }

  /**
   * Get all threads in category
   */
  static acquireAllInCategory(category: ForumCategory): WikidotResultAsync<ForumThreadCollection> {
    return fromPromise(
      (async () => {
        const threads: ForumThread[] = [];

        const firstResult = await category.site.amcRequest([
          {
            p: 1,
            c: category.id,
            moduleName: 'forum/ForumViewCategoryModule',
          },
        ]);

        if (firstResult.isErr()) {
          throw firstResult.error;
        }

        const firstResponse = firstResult.value[0];
        if (!firstResponse) {
          throw new NoElementError('Empty response');
        }

        const firstBody = requireBody(firstResponse, 'forum/ForumViewCategoryModule');
        const $first = cheerio.load(firstBody);

        $first('table.table tr.head~tr').each((_i, elem) => {
          const $row = $first(elem);
          const titleElem = $row.find('div.title a');
          const href = titleElem.attr('href') ?? '';
          const threadIdMatch = href.match(/t-(\d+)/);
          if (!threadIdMatch?.[1]) return;

          const threadId = Number.parseInt(threadIdMatch[1], 10);
          const title = titleElem.text().trim();
          const description = $row.find('div.description').text().trim();
          const postCount = Number.parseInt($row.find('td.posts').text().trim(), 10) || 0;

          // Parse user and timestamp
          const $userElem = $row.find('td.started span.printuser');
          const $odateElem = $row.find('td.started span.odate');

          const createdBy =
            $userElem.length > 0
              ? parseUser(category.site.client, $userElem as Cheerio<AnyNode>)
              : null;
          const createdAt =
            $odateElem.length > 0
              ? (parseOdate($odateElem as Cheerio<AnyNode>) ?? new Date())
              : new Date();

          threads.push(
            new ForumThread({
              site: category.site,
              id: threadId,
              title,
              description,
              createdBy,
              createdAt,
              postCount,
              category,
            })
          );
        });

        // Check pagination
        const pager = $first('div.pager');
        if (pager.length === 0) {
          return new ForumThreadCollection(category.site, threads);
        }

        const pagerLinks = pager.find('a');
        if (pagerLinks.length < 2) {
          return new ForumThreadCollection(category.site, threads);
        }

        const lastPageLink = pagerLinks[pagerLinks.length - 2];
        const lastPageText = lastPageLink ? $first(lastPageLink).text().trim() : '1';
        const lastPage = Number.parseInt(lastPageText, 10) || 1;

        if (lastPage <= 1) {
          return new ForumThreadCollection(category.site, threads);
        }

        // Fetch remaining pages
        const bodies: { p: number; c: number; moduleName: string }[] = [];
        for (let page = 2; page <= lastPage; page++) {
          bodies.push({
            p: page,
            c: category.id,
            moduleName: 'forum/ForumViewCategoryModule',
          });
        }

        const additionalResults = await category.site.amcRequestWithRetry(bodies);
        if (additionalResults.isErr()) {
          throw additionalResults.error;
        }

        for (const response of additionalResults.value) {
          if (!response) continue;
          const body = requireBody(response, 'forum/ForumViewCategoryModule');
          const $ = cheerio.load(body);

          $('table.table tr.head~tr').each((_i, elem) => {
            const $row = $(elem);
            const titleElem = $row.find('div.title a');
            const href = titleElem.attr('href') ?? '';
            const threadIdMatch = href.match(/t-(\d+)/);
            if (!threadIdMatch?.[1]) return;

            const threadId = Number.parseInt(threadIdMatch[1], 10);
            const title = titleElem.text().trim();
            const description = $row.find('div.description').text().trim();
            const postCount = Number.parseInt($row.find('td.posts').text().trim(), 10) || 0;

            // Parse user and timestamp
            const $userElem = $row.find('td.started span.printuser');
            const $odateElem = $row.find('td.started span.odate');

            const createdBy =
              $userElem.length > 0
                ? parseUser(category.site.client, $userElem as Cheerio<AnyNode>)
                : null;
            const createdAt =
              $odateElem.length > 0
                ? (parseOdate($odateElem as Cheerio<AnyNode>) ?? new Date())
                : new Date();

            threads.push(
              new ForumThread({
                site: category.site,
                id: threadId,
                title,
                description,
                createdBy,
                createdAt,
                postCount,
                category,
              })
            );
          });
        }

        return new ForumThreadCollection(category.site, threads);
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to acquire threads: ${String(error)}`);
      }
    );
  }

  /**
   * Get a single thread by thread ID
   * @param site - Site instance
   * @param threadId - Thread ID
   */
  static fromId(site: Site, threadId: number): WikidotResultAsync<ForumThread> {
    return fromPromise(
      (async () => {
        const result = await ForumThreadCollection.acquireFromThreadIds(site, [threadId]);
        if (result.isErr()) {
          throw result.error;
        }
        const thread = result.value[0];
        if (!thread) {
          throw new NoElementError(`Thread not found: ${threadId}`);
        }
        return thread;
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to get thread: ${String(error)}`);
      }
    );
  }

  /**
   * Get threads by thread IDs
   */
  static acquireFromThreadIds(
    site: Site,
    threadIds: number[],
    category: ForumCategory | null = null
  ): WikidotResultAsync<ForumThreadCollection> {
    return fromPromise(
      (async () => {
        const result = await site.amcRequest(
          threadIds.map((threadId) => ({
            t: threadId,
            moduleName: 'forum/ForumViewThreadModule',
          }))
        );

        if (result.isErr()) {
          throw result.error;
        }

        const threads: ForumThread[] = [];

        for (let i = 0; i < threadIds.length; i++) {
          const response = result.value[i];
          const threadId = threadIds[i];
          if (!response || !threadId) continue;

          const body = requireBody(response, 'forum/ForumViewThreadModule');
          const $ = cheerio.load(body);

          // Parse thread info from page
          const bcElem = $('div.forum-breadcrumbs');
          if (bcElem.length === 0) {
            throw new NoElementError('Breadcrumbs not found');
          }
          const bcParts = bcElem.text().split('»');
          const title = bcParts.length > 0 ? (bcParts[bcParts.length - 1]?.trim() ?? '') : '';

          const descBlockElem = $('div.description-block');
          const description = descBlockElem.text().trim();

          const postCountMatch = $('div.statistics').text().match(/(\d+)/);
          const postCount = postCountMatch?.[1] ? Number.parseInt(postCountMatch[1], 10) : 0;

          threads.push(
            new ForumThread({
              site,
              id: threadId,
              title,
              description,
              createdBy: null,
              createdAt: new Date(),
              postCount,
              category,
            })
          );
        }

        return new ForumThreadCollection(site, threads);
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to acquire threads: ${String(error)}`);
      }
    );
  }
}
