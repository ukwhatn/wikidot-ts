import type { Cheerio, CheerioAPI } from 'cheerio';
import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import { RequireLogin } from '../../common/decorators';
import { LoginRequiredError, NoElementError, UnexpectedError } from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { parseOdate, parseUser } from '../../util/parser';
import type { Client } from '../client';
import type { ForumThreadRef } from '../types';
import type { AbstractUser } from '../user';
import { ForumPostRevisionCollection } from './forum-post-revision';

/**
 * Forum post data
 */
export interface ForumPostData {
  thread: ForumThreadRef;
  id: number;
  title: string;
  text: string;
  element: Element;
  createdBy: AbstractUser;
  createdAt: Date;
  editedBy?: AbstractUser | null;
  editedAt?: Date | null;
  parentId?: number | null;
}

/**
 * Forum post
 */
export class ForumPost {
  public readonly thread: ForumThreadRef;
  public readonly id: number;
  public title: string;
  public readonly text: string;
  public readonly element: Element;
  public readonly createdBy: AbstractUser;
  public readonly createdAt: Date;
  public readonly editedBy: AbstractUser | null;
  public readonly editedAt: Date | null;
  private _parentId: number | null;
  protected _source: string | null = null;
  private _revisions: ForumPostRevisionCollection | null = null;

  constructor(data: ForumPostData) {
    this.thread = data.thread;
    this.id = data.id;
    this.title = data.title;
    this.text = data.text;
    this.element = data.element;
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt;
    this.editedBy = data.editedBy ?? null;
    this.editedAt = data.editedAt ?? null;
    this._parentId = data.parentId ?? null;
  }

  /**
   * Parent post ID
   */
  get parentId(): number | null {
    return this._parentId;
  }

  /**
   * Get source code (Wikidot syntax)
   */
  getSource(): WikidotResultAsync<string> {
    if (this._source !== null) {
      return fromPromise(Promise.resolve(this._source), (e) => new UnexpectedError(String(e)));
    }

    return fromPromise(
      (async () => {
        const result = await ForumPostCollection.acquirePostSources(this.thread, [this]);
        if (result.isErr()) {
          throw result.error;
        }
        if (this._source === null) {
          throw new NoElementError('Source textarea not found');
        }
        return this._source;
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to get post source: ${String(error)}`);
      }
    );
  }

  /**
   * Edit post
   * @param source - New source (Wikidot syntax)
   * @param title - New title (keeps current title if omitted)
   */
  @RequireLogin
  edit(source: string, title?: string): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        // Get current revision ID
        const formResult = await this.thread.site.amcRequest([
          {
            moduleName: 'forum/sub/ForumEditPostFormModule',
            threadId: this.thread.id,
            postId: this.id,
          },
        ]);

        if (formResult.isErr()) {
          throw formResult.error;
        }

        const formResponse = formResult.value[0];
        if (!formResponse) {
          throw new NoElementError('Empty form response');
        }

        const $ = cheerio.load(String(formResponse.body ?? ''));
        const revisionInput = $("input[name='currentRevisionId']");
        if (revisionInput.length === 0) {
          throw new NoElementError('Current revision ID input not found');
        }

        const revisionValue = revisionInput.val();
        const currentRevisionId = Number.parseInt(String(revisionValue ?? ''), 10);
        if (Number.isNaN(currentRevisionId)) {
          throw new NoElementError('Invalid revision ID value');
        }

        // Save edit
        const editResult = await this.thread.site.amcRequest([
          {
            action: 'ForumAction',
            event: 'saveEditPost',
            moduleName: 'Empty',
            postId: this.id,
            currentRevisionId,
            title: title ?? this.title,
            source,
          },
        ]);

        if (editResult.isErr()) {
          throw editResult.error;
        }

        // Update local state
        if (title !== undefined) {
          this.title = title;
        }
        this._source = source;
      })(),
      (error) => {
        if (error instanceof NoElementError || error instanceof LoginRequiredError) {
          return error;
        }
        return new UnexpectedError(`Failed to edit post: ${String(error)}`);
      }
    );
  }

  /**
   * Whether the post has been edited (has revisions)
   */
  get hasRevisions(): boolean {
    return this.editedBy !== null;
  }

  /**
   * Get post revisions (edit history)
   * @returns Revision collection
   */
  getRevisions(): WikidotResultAsync<ForumPostRevisionCollection> {
    if (this._revisions !== null) {
      return fromPromise(Promise.resolve(this._revisions), (e) => new UnexpectedError(String(e)));
    }

    return fromPromise(
      (async () => {
        const result = await ForumPostRevisionCollection.acquireAllForPosts([this]);
        if (result.isErr()) {
          throw result.error;
        }
        this._revisions = result.value.get(this.id) ?? new ForumPostRevisionCollection(this, []);
        return this._revisions;
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to get revisions: ${String(error)}`);
      }
    );
  }

  toString(): string {
    return `ForumPost(id=${this.id}, title=${this.title})`;
  }
}

/**
 * Forum post collection
 */
export class ForumPostCollection extends Array<ForumPost> {
  public readonly thread: ForumThreadRef;

  constructor(thread: ForumThreadRef, posts?: ForumPost[]) {
    super();
    this.thread = thread;
    if (posts) {
      this.push(...posts);
    }
  }

  /**
   * Find by ID
   * @param id - Post ID
   * @returns Post (undefined if not found)
   */
  findById(id: number): ForumPost | undefined {
    return this.find((post) => post.id === id);
  }

  /**
   * Parse posts from HTML (internal method)
   */
  private static _parse(thread: ForumThreadRef, $: CheerioAPI): ForumPost[] {
    const posts: ForumPost[] = [];

    $('div.post').each((_i, postElem) => {
      const $post = $(postElem);
      const postIdAttr = $post.attr('id');
      if (!postIdAttr) return;

      const postId = Number.parseInt(postIdAttr.replace('post-', ''), 10);
      if (Number.isNaN(postId)) return;

      // Get parent post ID
      let parentId: number | null = null;
      const $parentContainer = $post.parent();
      if ($parentContainer.length > 0) {
        const $grandparent = $parentContainer.parent();
        if ($grandparent.length > 0 && $grandparent[0]?.name !== 'body') {
          const grandparentClasses = $grandparent.attr('class') ?? '';
          if (grandparentClasses.includes('post-container')) {
            const $parentPost = $grandparent.find('> div.post');
            if ($parentPost.length > 0) {
              const parentPostIdAttr = $parentPost.attr('id');
              if (parentPostIdAttr) {
                parentId = Number.parseInt(parentPostIdAttr.replace('post-', ''), 10);
              }
            }
          }
        }
      }

      // Get title and content
      const $wrapper = $post.find('div.long');
      if ($wrapper.length === 0) return;

      const $head = $wrapper.find('div.head');
      if ($head.length === 0) return;

      const $title = $head.find('div.title');
      const title = $title.text().trim();

      const $content = $wrapper.find('div.content');
      const text = $content.html() ?? '';

      // Author and timestamp
      const $info = $head.find('div.info');
      if ($info.length === 0) return;

      const $userElem = $info.find('span.printuser');
      if ($userElem.length === 0) return;

      const createdBy = parseUser(thread.site.client as Client, $userElem as Cheerio<AnyNode>);

      const $odateElem = $info.find('span.odate');
      if ($odateElem.length === 0) return;

      const createdAt = parseOdate($odateElem as Cheerio<AnyNode>) ?? new Date();

      // Edit info (if exists)
      let editedBy: AbstractUser | null = null;
      let editedAt: Date | null = null;
      const $changes = $wrapper.find('div.changes');
      if ($changes.length > 0) {
        const $editUserElem = $changes.find('span.printuser');
        const $editOdateElem = $changes.find('span.odate');
        if ($editUserElem.length > 0 && $editOdateElem.length > 0) {
          editedBy = parseUser(thread.site.client as Client, $editUserElem as Cheerio<AnyNode>);
          editedAt = parseOdate($editOdateElem as Cheerio<AnyNode>);
        }
      }

      posts.push(
        new ForumPost({
          thread,
          id: postId,
          title,
          text,
          element: postElem as Element,
          createdBy,
          createdAt,
          editedBy,
          editedAt,
          parentId,
        })
      );
    });

    return posts;
  }

  /**
   * Get all posts in a thread
   */
  static acquireAllInThread(thread: ForumThreadRef): WikidotResultAsync<ForumPostCollection> {
    return fromPromise(
      (async () => {
        const posts: ForumPost[] = [];

        const firstResult = await thread.site.amcRequest([
          {
            moduleName: 'forum/ForumViewThreadPostsModule',
            pageNo: '1',
            t: String(thread.id),
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

        posts.push(...ForumPostCollection._parse(thread, $first));

        // Check pagination
        const $pager = $first('div.pager');
        if ($pager.length === 0) {
          return new ForumPostCollection(thread, posts);
        }

        const $pagerTargets = $pager.find('span.target');
        if ($pagerTargets.length < 2) {
          return new ForumPostCollection(thread, posts);
        }

        // Get last page number from second to last page link
        const lastPageText = $pagerTargets
          .eq($pagerTargets.length - 2)
          .text()
          .trim();
        const lastPage = Number.parseInt(lastPageText, 10);
        if (Number.isNaN(lastPage) || lastPage <= 1) {
          return new ForumPostCollection(thread, posts);
        }

        // Get remaining pages
        const bodies: { moduleName: string; pageNo: string; t: string }[] = [];
        for (let page = 2; page <= lastPage; page++) {
          bodies.push({
            moduleName: 'forum/ForumViewThreadPostsModule',
            pageNo: String(page),
            t: String(thread.id),
          });
        }

        const additionalResults = await thread.site.amcRequest(bodies);
        if (additionalResults.isErr()) {
          throw additionalResults.error;
        }

        for (const response of additionalResults.value) {
          const body = String(response?.body ?? '');
          const $ = cheerio.load(body);
          posts.push(...ForumPostCollection._parse(thread, $));
        }

        return new ForumPostCollection(thread, posts);
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to acquire posts: ${String(error)}`);
      }
    );
  }

  /**
   * Get all posts from multiple threads
   */
  static acquireAllInThreads(
    threads: ForumThreadRef[]
  ): WikidotResultAsync<Map<number, ForumPostCollection>> {
    return fromPromise(
      (async () => {
        if (threads.length === 0) {
          return new Map<number, ForumPostCollection>();
        }

        const result = new Map<number, ForumPostCollection>();
        const site = threads[0]!.site;

        // Step 1: Get first page of all threads
        const firstPageResult = await site.amcRequest(
          threads.map((thread) => ({
            moduleName: 'forum/ForumViewThreadPostsModule',
            pageNo: '1',
            t: String(thread.id),
          }))
        );

        if (firstPageResult.isErr()) {
          throw firstPageResult.error;
        }

        // Step 2: Parse first pages and determine pagination
        const additionalRequests: { thread: ForumThreadRef; page: number }[] = [];

        for (let i = 0; i < threads.length; i++) {
          const thread = threads[i]!;
          const response = firstPageResult.value[i];
          if (!response) continue;

          const body = String(response.body ?? '');
          const $ = cheerio.load(body);

          const posts = ForumPostCollection._parse(thread, $);
          result.set(thread.id, new ForumPostCollection(thread, posts));

          // Check pagination
          const $pager = $('div.pager');
          if ($pager.length === 0) continue;

          const $pagerTargets = $pager.find('span.target');
          if ($pagerTargets.length < 2) continue;

          const lastPageText = $pagerTargets
            .eq($pagerTargets.length - 2)
            .text()
            .trim();
          const lastPage = Number.parseInt(lastPageText, 10);
          if (Number.isNaN(lastPage) || lastPage <= 1) continue;

          for (let page = 2; page <= lastPage; page++) {
            additionalRequests.push({ thread, page });
          }
        }

        // Step 3: Fetch additional pages
        if (additionalRequests.length > 0) {
          const additionalResult = await site.amcRequest(
            additionalRequests.map(({ thread, page }) => ({
              moduleName: 'forum/ForumViewThreadPostsModule',
              pageNo: String(page),
              t: String(thread.id),
            }))
          );

          if (additionalResult.isErr()) {
            throw additionalResult.error;
          }

          for (let i = 0; i < additionalRequests.length; i++) {
            const { thread } = additionalRequests[i]!;
            const response = additionalResult.value[i];
            if (!response) continue;

            const body = String(response.body ?? '');
            const $ = cheerio.load(body);
            const posts = ForumPostCollection._parse(thread, $);

            const existing = result.get(thread.id);
            if (existing) {
              existing.push(...posts);
            }
          }
        }

        return result;
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to acquire posts: ${String(error)}`);
      }
    );
  }

  /**
   * Internal method to acquire post sources in bulk
   */
  static acquirePostSources(
    thread: ForumThreadRef,
    posts: ForumPost[]
  ): WikidotResultAsync<ForumPostCollection> {
    return fromPromise(
      (async () => {
        const targetPosts = posts.filter((post) => post._source === null);

        if (targetPosts.length === 0) {
          return new ForumPostCollection(thread, posts);
        }

        const result = await thread.site.amcRequest(
          targetPosts.map((post) => ({
            moduleName: 'forum/sub/ForumEditPostFormModule',
            threadId: thread.id,
            postId: post.id,
          }))
        );

        if (result.isErr()) {
          throw result.error;
        }

        for (let i = 0; i < targetPosts.length; i++) {
          const post = targetPosts[i];
          const response = result.value[i];
          if (!post || !response) continue;
          const $ = cheerio.load(String(response.body ?? ''));
          const sourceElem = $("textarea[name='source']");
          if (sourceElem.length === 0) {
            throw new NoElementError(`Source textarea not found for post: ${post.id}`);
          }
          post._source = sourceElem.text();
        }

        return new ForumPostCollection(thread, posts);
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to acquire post sources: ${String(error)}`);
      }
    );
  }

  /**
   * Get sources for all posts in the collection
   * @returns Result containing the collection (for method chaining)
   */
  getPostSources(): WikidotResultAsync<ForumPostCollection> {
    return ForumPostCollection.acquirePostSources(this.thread, Array.from(this));
  }
}
