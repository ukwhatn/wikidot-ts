import type { Cheerio } from 'cheerio';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { RequireLogin } from '../../common/decorators';
import { NoElementError, UnexpectedError } from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
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
  public readonly title: string;
  public readonly description: string;
  public readonly createdBy: AbstractUser | null;
  public readonly createdAt: Date;
  public postCount: number;
  public readonly category: ForumCategory | null;
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

  toString(): string {
    return `ForumThread(id=${this.id}, title=${this.title})`;
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

        const firstBody = String(firstResponse.body ?? '');
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

        const additionalResults = await category.site.amcRequest(bodies);
        if (additionalResults.isErr()) {
          throw additionalResults.error;
        }

        for (const response of additionalResults.value) {
          const body = String(response?.body ?? '');
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

          const body = String(response.body ?? '');
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
