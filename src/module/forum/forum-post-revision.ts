import type { Cheerio, CheerioAPI } from 'cheerio';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { NoElementError, UnexpectedError } from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { parseOdate, parseUser } from '../../util/parser';
import type { Client } from '../client';
import type { ForumPostRef } from '../types';
import type { AbstractUser } from '../user';

/**
 * Forum post revision data
 */
export interface ForumPostRevisionData {
  post: ForumPostRef;
  id: number;
  revNo: number;
  createdBy: AbstractUser;
  createdAt: Date;
}

/**
 * Forum post revision (version in edit history)
 */
export class ForumPostRevision {
  /** Post this revision belongs to */
  public readonly post: ForumPostRef;

  /** Revision ID */
  public readonly id: number;

  /** Revision number (0 = initial version) */
  public readonly revNo: number;

  /** Revision creator */
  public readonly createdBy: AbstractUser;

  /** Revision creation date */
  public readonly createdAt: Date;

  /** HTML content (internal cache) */
  private _html: string | null = null;

  constructor(data: ForumPostRevisionData) {
    this.post = data.post;
    this.id = data.id;
    this.revNo = data.revNo;
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt;
  }

  /**
   * Whether HTML content has been acquired
   */
  isHtmlAcquired(): boolean {
    return this._html !== null;
  }

  /**
   * Get HTML content (cached)
   */
  get html(): string | null {
    return this._html;
  }

  /**
   * Set HTML content
   */
  set html(value: string | null) {
    this._html = value;
  }

  /**
   * Get revision HTML content
   * @returns HTML string
   */
  getHtml(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        if (this._html !== null) {
          return this._html;
        }

        const result = await this.post.thread.site.amcRequest([
          {
            moduleName: 'forum/sub/ForumPostRevisionModule',
            revisionId: this.id,
          },
        ]);

        if (result.isErr()) {
          throw result.error;
        }

        const response = result.value[0];
        if (!response) {
          throw new NoElementError('Empty response from ForumPostRevisionModule');
        }

        const content = String(response.content ?? '');
        this._html = content;
        return content;
      })(),
      (error) => {
        if (error instanceof NoElementError) {
          return error;
        }
        return new UnexpectedError(`Failed to get revision HTML: ${String(error)}`);
      }
    );
  }

  toString(): string {
    return `ForumPostRevision(id=${this.id}, revNo=${this.revNo})`;
  }
}

/**
 * Forum post revision collection
 */
export class ForumPostRevisionCollection extends Array<ForumPostRevision> {
  public readonly post: ForumPostRef;

  constructor(post: ForumPostRef, revisions?: ForumPostRevision[]) {
    super();
    this.post = post;
    if (revisions) {
      this.push(...revisions);
    }
  }

  /**
   * Find by ID
   * @param id - Revision ID
   * @returns Revision (undefined if not found)
   */
  findById(id: number): ForumPostRevision | undefined {
    return this.find((revision) => revision.id === id);
  }

  /**
   * Find by revision number
   * @param revNo - Revision number
   * @returns Revision (undefined if not found)
   */
  findByRevNo(revNo: number): ForumPostRevision | undefined {
    return this.find((revision) => revision.revNo === revNo);
  }

  /**
   * Get HTML for all revisions
   * @returns Array of HTML strings
   */
  getHtmls(): WikidotResultAsync<string[]> {
    return fromPromise(
      (async () => {
        const results = await Promise.all(
          this.map(async (revision) => {
            const result = await revision.getHtml();
            if (result.isErr()) {
              throw result.error;
            }
            return result.value;
          })
        );
        return results;
      })(),
      (error) => {
        if (error instanceof NoElementError) {
          return error;
        }
        return new UnexpectedError(`Failed to get HTMLs: ${String(error)}`);
      }
    );
  }

  /**
   * Parse revisions from HTML (internal method)
   */
  private static _parse(post: ForumPostRef, $: CheerioAPI): ForumPostRevision[] {
    const revisions: ForumPostRevision[] = [];

    $('table.table tr').each((_i, rowElem) => {
      const $row = $(rowElem);

      // Skip header row
      if ($row.hasClass('head')) return;

      // Get user element
      const $userElem = $row.find('span.printuser');
      if ($userElem.length === 0) return;

      // Get odate element
      const $odateElem = $row.find('span.odate');
      if ($odateElem.length === 0) return;

      // Get revision ID from onclick attribute
      const $revisionLink = $row.find('a[onclick*="showRevision"]');
      if ($revisionLink.length === 0) return;

      const onclick = $revisionLink.attr('onclick') ?? '';
      const revisionIdMatch = onclick.match(/showRevision\s*\(\s*event\s*,\s*(\d+)\s*\)/);
      if (!revisionIdMatch?.[1]) return;

      const revisionId = Number.parseInt(revisionIdMatch[1], 10);
      if (Number.isNaN(revisionId)) return;

      const createdBy = parseUser(post.thread.site.client as Client, $userElem as Cheerio<AnyNode>);
      const createdAt = parseOdate($odateElem as Cheerio<AnyNode>) ?? new Date();

      revisions.push(
        new ForumPostRevision({
          post,
          id: revisionId,
          revNo: 0, // Will be set after parsing all revisions
          createdBy,
          createdAt,
        })
      );
    });

    // API returns newest first, reverse to get oldest first and set revNo
    revisions.reverse();
    for (let i = 0; i < revisions.length; i++) {
      // Use Object.defineProperty to set readonly property
      Object.defineProperty(revisions[i], 'revNo', {
        value: i,
        writable: false,
        configurable: true,
      });
    }

    return revisions;
  }

  /**
   * Get all revisions for a post
   * @param post - Forum post reference
   * @returns Revision collection
   */
  static acquireAll(post: ForumPostRef): WikidotResultAsync<ForumPostRevisionCollection> {
    return fromPromise(
      (async () => {
        const result = await post.thread.site.amcRequest([
          {
            moduleName: 'forum/sub/ForumPostRevisionsModule',
            postId: post.id,
          },
        ]);

        if (result.isErr()) {
          throw result.error;
        }

        const response = result.value[0];
        if (!response) {
          throw new NoElementError('Empty response from ForumPostRevisionsModule');
        }

        const body = String(response.body ?? '');
        const $ = cheerio.load(body);

        const revisions = ForumPostRevisionCollection._parse(post, $);
        return new ForumPostRevisionCollection(post, revisions);
      })(),
      (error) => {
        if (error instanceof NoElementError) {
          return error;
        }
        return new UnexpectedError(`Failed to acquire revisions: ${String(error)}`);
      }
    );
  }

  /**
   * Get revisions for multiple posts
   * @param posts - Array of forum post references
   * @param withHtml - Whether to also fetch HTML content for each revision
   * @returns Map of post ID to revision collection
   */
  static acquireAllForPosts(
    posts: ForumPostRef[],
    withHtml = false
  ): WikidotResultAsync<Map<number, ForumPostRevisionCollection>> {
    return fromPromise(
      (async () => {
        if (posts.length === 0) {
          return new Map<number, ForumPostRevisionCollection>();
        }

        const result = new Map<number, ForumPostRevisionCollection>();
        const site = posts[0]!.thread.site;

        // Step 1: Get revision lists for all posts
        const revisionsResult = await site.amcRequest(
          posts.map((post) => ({
            moduleName: 'forum/sub/ForumPostRevisionsModule',
            postId: post.id,
          }))
        );

        if (revisionsResult.isErr()) {
          throw revisionsResult.error;
        }

        // Step 2: Parse revisions
        for (let i = 0; i < posts.length; i++) {
          const post = posts[i]!;
          const response = revisionsResult.value[i];
          if (!response) continue;

          const body = String(response.body ?? '');
          const $ = cheerio.load(body);
          const revisions = ForumPostRevisionCollection._parse(post, $);
          result.set(post.id, new ForumPostRevisionCollection(post, revisions));
        }

        // Step 3: Get HTML content if requested
        if (withHtml) {
          const allRevisions: { revision: ForumPostRevision; postId: number }[] = [];
          for (const [postId, collection] of result) {
            for (const revision of collection) {
              allRevisions.push({ revision, postId });
            }
          }

          if (allRevisions.length > 0) {
            const htmlResult = await site.amcRequest(
              allRevisions.map(({ revision }) => ({
                moduleName: 'forum/sub/ForumPostRevisionModule',
                revisionId: revision.id,
              }))
            );

            if (htmlResult.isErr()) {
              throw htmlResult.error;
            }

            for (let i = 0; i < allRevisions.length; i++) {
              const { revision } = allRevisions[i]!;
              const response = htmlResult.value[i];
              if (response) {
                revision.html = String(response.content ?? '');
              }
            }
          }
        }

        return result;
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to acquire revisions for posts: ${String(error)}`);
      }
    );
  }
}
