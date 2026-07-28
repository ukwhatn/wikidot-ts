import type { Cheerio } from 'cheerio';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import pLimit from 'p-limit';
import { z } from 'zod';
import { RequireLogin } from '../../common/decorators';
import {
  ForbiddenError,
  LoginRequiredError,
  NoElementError,
  NotFoundException,
  TargetError,
  TargetExistsError,
  UnexpectedError,
} from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { type AMCRequestBody, flag, omitFalsy, requireBody } from '../../connector';
import { fetchWithRetry } from '../../util/http';
import { parseUser } from '../../util/parser';
import type { Site } from '../site';
import type { AbstractUser } from '../user';
import { type EditMode, PageEditSession, withEditLock } from './page-edit-session';
import { PageFileCollection } from './page-file';
import { PageMetaCollection } from './page-meta';
import { type PageRevision, PageRevisionCollection, parseRevisionListHtml } from './page-revision';
import { PageSource } from './page-source';
import { PageVote, PageVoteCollection } from './page-vote';
import { DEFAULT_MODULE_BODY, DEFAULT_PER_PAGE, SearchPagesQuery } from './search-query';

/**
 * Schema for ListPagesModule parse result
 * Uses Zod for type-safe validation of parse results
 */
const pageParamsSchema = z.object({
  fullname: z.preprocess((v) => v ?? '', z.string()),
  name: z.preprocess((v) => v ?? '', z.string()),
  category: z.preprocess((v) => v ?? '', z.string()),
  title: z.preprocess((v) => v ?? '', z.string()),
  children_count: z.coerce.number().default(0),
  comments_count: z.coerce.number().default(0),
  size: z.coerce.number().default(0),
  rating: z.coerce.number().default(0),
  votes_count: z.coerce.number().default(0),
  rating_percent: z.coerce.number().nullable().default(null),
  revisions_count: z.coerce.number().default(0),
  parent_fullname: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  created_by: z.custom<AbstractUser>().nullable().default(null),
  created_at: z.date().nullable().default(null),
  updated_by: z.custom<AbstractUser>().nullable().default(null),
  updated_at: z.date().nullable().default(null),
  commented_by: z.custom<AbstractUser>().nullable().default(null),
  commented_at: z.date().nullable().default(null),
});

/**
 * Page data
 */
export interface PageData {
  site: Site;
  fullname: string;
  name: string;
  category: string;
  title: string;
  childrenCount: number;
  commentsCount: number;
  size: number;
  rating: number;
  votesCount: number;
  ratingPercent: number | null;
  revisionsCount: number;
  parentFullname: string | null;
  tags: string[];
  createdBy: AbstractUser | null;
  createdAt: Date;
  updatedBy: AbstractUser | null;
  updatedAt: Date;
  commentedBy: AbstractUser | null;
  commentedAt: Date | null;
}

/**
 * Wikidot page
 */
export class Page {
  public readonly site: Site;
  public readonly fullname: string;
  public readonly name: string;
  public readonly category: string;
  public title: string;
  public childrenCount: number;
  public commentsCount: number;
  public size: number;
  public rating: number;
  public votesCount: number;
  public ratingPercent: number | null;
  public revisionsCount: number;
  public parentFullname: string | null;
  public tags: string[];
  public readonly createdBy: AbstractUser | null;
  public readonly createdAt: Date;
  public updatedBy: AbstractUser | null;
  public updatedAt: Date;
  public commentedBy: AbstractUser | null;
  public commentedAt: Date | null;

  private _id: number | null = null;
  private _source: PageSource | null = null;
  private _revisions: PageRevisionCollection | null = null;
  private _votes: PageVoteCollection | null = null;
  _files: PageFileCollection | null = null;

  constructor(data: PageData) {
    this.site = data.site;
    this.fullname = data.fullname;
    this.name = data.name;
    this.category = data.category;
    this.title = data.title;
    this.childrenCount = data.childrenCount;
    this.commentsCount = data.commentsCount;
    this.size = data.size;
    this.rating = data.rating;
    this.votesCount = data.votesCount;
    this.ratingPercent = data.ratingPercent;
    this.revisionsCount = data.revisionsCount;
    this.parentFullname = data.parentFullname;
    this.tags = data.tags;
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt;
    this.updatedBy = data.updatedBy;
    this.updatedAt = data.updatedAt;
    this.commentedBy = data.commentedBy;
    this.commentedAt = data.commentedAt;
  }

  /**
   * Get page URL
   */
  getUrl(): string {
    return `${this.site.getBaseUrl()}/${this.fullname}`;
  }

  /**
   * Whether page ID has been acquired
   */
  isIdAcquired(): boolean {
    return this._id !== null;
  }

  /**
   * Get page ID
   */
  get id(): number | null {
    return this._id;
  }

  /**
   * Set page ID
   */
  set id(value: number | null) {
    this._id = value;
  }

  /**
   * Get source code
   */
  get source(): PageSource | null {
    return this._source;
  }

  /**
   * Set source code
   */
  set source(value: PageSource | null) {
    this._source = value;
  }

  /**
   * Get revision history
   */
  get revisions(): PageRevisionCollection | null {
    return this._revisions;
  }

  /**
   * Set revision history
   */
  set revisions(value: PageRevisionCollection | null) {
    this._revisions = value;
  }

  /**
   * Get vote information
   */
  get votes(): PageVoteCollection | null {
    return this._votes;
  }

  /**
   * Set vote information
   */
  set votes(value: PageVoteCollection | null) {
    this._votes = value;
  }

  /**
   * Get latest revision
   */
  get latestRevision(): PageRevision | undefined {
    if (!this._revisions || this._revisions.length === 0) return undefined;
    return this._revisions.reduce((max, rev) => (rev.revNo > max.revNo ? rev : max));
  }

  /**
   * Ensure page ID is available (auto-acquire if not yet acquired)
   * @param operation - Operation name (for error message)
   * @throws If ID acquisition fails
   */
  private async ensureId(operation: string): Promise<number> {
    if (this._id === null) {
      const result = await PageCollection.acquirePageIds(this.site, [this]);
      if (result.isErr()) {
        throw new UnexpectedError(
          `Failed to acquire page ID for ${operation}: ${result.error.message}`
        );
      }
    }
    if (this._id === null) {
      throw new UnexpectedError(`Page ID acquisition failed for ${operation}`);
    }
    return this._id;
  }

  /**
   * Delete page
   */
  @RequireLogin
  destroy(): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('deletion');
        const result = await this.site.amcRequest([
          {
            action: 'WikiPageAction',
            event: 'deletePage',
            page_id: pageId,
            moduleName: 'Empty',
          },
        ]);
        if (result.isErr()) {
          throw result.error;
        }
      })(),
      (error) => new UnexpectedError(`Failed to delete page: ${String(error)}`)
    );
  }

  /**
   * Save tags
   */
  @RequireLogin
  commitTags(): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('saving tags');
        const result = await this.site.amcRequest([
          {
            tags: this.tags.join(' '),
            action: 'WikiPageAction',
            event: 'saveTags',
            pageId: pageId,
            moduleName: 'Empty',
          },
        ]);
        if (result.isErr()) {
          throw result.error;
        }
      })(),
      (error) => new UnexpectedError(`Failed to save tags: ${String(error)}`)
    );
  }

  /**
   * Set parent page
   * @param parentFullname - Parent page fullname (null to remove)
   */
  @RequireLogin
  setParent(parentFullname: string | null): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('setting parent');
        const result = await this.site.amcRequest([
          {
            action: 'WikiPageAction',
            event: 'setParentPage',
            moduleName: 'Empty',
            pageId: String(pageId),
            parentName: parentFullname ?? '',
          },
        ]);
        if (result.isErr()) {
          throw result.error;
        }
        this.parentFullname = parentFullname;
      })(),
      (error) => new UnexpectedError(`Failed to set parent: ${String(error)}`)
    );
  }

  /**
   * Vote on page
   * @param value - Vote value
   * @returns New rating
   */
  @RequireLogin
  vote(value: number): WikidotResultAsync<number> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('voting');
        const result = await this.site.amcRequest([
          {
            action: 'RateAction',
            event: 'ratePage',
            moduleName: 'Empty',
            pageId: pageId,
            points: value,
            force: 'yes',
          },
        ]);
        if (result.isErr()) {
          throw result.error;
        }
        const response = result.value[0];
        if (!response) {
          throw new UnexpectedError('Empty response from vote request');
        }
        const newRating = Number.parseInt(String(response.points ?? this.rating), 10);
        this.rating = newRating;
        return newRating;
      })(),
      (error) => new UnexpectedError(`Failed to vote: ${String(error)}`)
    );
  }

  /**
   * Cancel vote
   * @returns New rating
   */
  @RequireLogin
  cancelVote(): WikidotResultAsync<number> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('canceling vote');
        const result = await this.site.amcRequest([
          {
            action: 'RateAction',
            event: 'cancelVote',
            moduleName: 'Empty',
            pageId: pageId,
          },
        ]);
        if (result.isErr()) {
          throw result.error;
        }
        const response = result.value[0];
        if (!response) {
          throw new UnexpectedError('Empty response from cancel vote request');
        }
        const newRating = Number.parseInt(String(response.points ?? this.rating), 10);
        this.rating = newRating;
        return newRating;
      })(),
      (error) => new UnexpectedError(`Failed to cancel vote: ${String(error)}`)
    );
  }

  /**
   * Edit the page
   * @param options - Edit options
   */
  @RequireLogin
  edit(options: {
    title?: string;
    source?: string;
    comment?: string;
    forceEdit?: boolean;
  }): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('editing');

        // Get current source (if not specified)
        let currentSource = options.source;
        if (currentSource === undefined) {
          const existingSource = this._source;
          if (existingSource !== null) {
            currentSource = existingSource.wikiText;
          } else {
            // Acquire source
            const sourceResult = await PageCollection.acquirePageSources(this.site, [this]);
            if (sourceResult.isErr()) {
              throw sourceResult.error;
            }
            // After acquirePageSources, this._source is set
            currentSource = this._source?.wikiText ?? '';
          }
        }

        const result = await PageCollection.createOrEdit(this.site, this.fullname, {
          pageId,
          title: options.title ?? this.title,
          source: currentSource,
          comment: options.comment ?? '',
          forceEdit: options.forceEdit ?? false,
        });
        if (result.isErr()) {
          throw result.error;
        }
      })(),
      (error) => {
        if (error instanceof LoginRequiredError || error instanceof ForbiddenError) {
          return error;
        }
        return new UnexpectedError(`Failed to edit page: ${String(error)}`);
      }
    );
  }

  /**
   * Rename the page
   * @param newFullname - New fullname
   * @param options - fixdeps: backlink page IDs (see getRenameBacklinks())
   * whose links should be updated along with the rename. force: force the
   * rename despite an active edit lock held by someone else
   */
  @RequireLogin
  rename(
    newFullname: string,
    options: { fixdeps?: number[]; force?: boolean } = {}
  ): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('renaming');
        const result = await this.site.amcRequest([
          {
            action: 'WikiPageAction',
            event: 'renamePage',
            moduleName: 'Empty',
            page_id: pageId,
            new_name: newFullname,
            ...omitFalsy({
              fixdeps:
                options.fixdeps && options.fixdeps.length > 0
                  ? options.fixdeps.join(',')
                  : undefined,
              force: options.force ? 'yes' : undefined,
            }),
          },
        ]);
        if (result.isErr()) {
          throw result.error;
        }
        const data = result.value[0];
        if (data?.locks) {
          throw new TargetError(`Cannot rename page ${this.fullname}: page is locked`);
        }
        if (data?.leftDeps) {
          throw new TargetError(
            `Cannot rename page ${this.fullname}: unresolved backlink dependencies remain (newName=${String(data.newName)})`
          );
        }
        // Update properties (using Object.assign since readonly)
        Object.assign(this, {
          fullname: newFullname,
          category: newFullname.includes(':') ? newFullname.split(':')[0] : '_default',
          name: newFullname.includes(':') ? newFullname.split(':')[1] : newFullname,
        });
      })(),
      (error) => {
        if (error instanceof TargetError) return error;
        return new UnexpectedError(`Failed to rename page: ${String(error)}`);
      }
    );
  }

  /**
   * Get list of files attached to the page
   */
  getFiles(): WikidotResultAsync<PageFileCollection> {
    if (this._files !== null) {
      return fromPromise(Promise.resolve(this._files), (e) => new UnexpectedError(String(e)));
    }
    return fromPromise(
      (async () => {
        const result = await new PageCollection(this.site, [this]).getPageFiles();
        if (result.isErr()) {
          throw result.error;
        }
        // _files should be set by getPageFiles()
        if (this._files === null) {
          this._files = new PageFileCollection(this, []);
        }
        return this._files;
      })(),
      (error) => new UnexpectedError(`Failed to get files: ${String(error)}`)
    );
  }

  /**
   * Get the discussion thread for the page
   */
  getDiscussion(): WikidotResultAsync<import('../forum').ForumThread | null> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('getting discussion');

        const result = await this.site.amcRequest([
          {
            moduleName: 'forum/ForumCommentsListModule',
            pageId,
          },
        ]);

        if (result.isErr()) {
          throw result.error;
        }

        const response = result.value[0];
        if (!response) {
          return null;
        }

        const html = requireBody(response, 'forum/ForumCommentsListModule');
        // Extract thread ID
        const match = html.match(
          /WIKIDOT\.modules\.ForumViewThreadModule\.vars\.threadId\s*=\s*(\d+)/
        );
        if (!match?.[1]) {
          return null;
        }

        const threadId = Number.parseInt(match[1], 10);

        // Get ForumThread
        const { ForumThread } = await import('../forum');
        const threadResult = await ForumThread.getFromId(this.site, threadId);
        if (threadResult.isErr()) {
          throw threadResult.error;
        }
        return threadResult.value;
      })(),
      (error) => new UnexpectedError(`Failed to get discussion: ${String(error)}`)
    );
  }

  /**
   * Get the list of meta tags for the page
   * @returns Meta tag collection
   */
  getMetas(): WikidotResultAsync<PageMetaCollection> {
    return fromPromise(
      (async () => {
        await this.ensureId('getting metas');
        const result = await PageMetaCollection.acquire(this);
        if (result.isErr()) {
          throw result.error;
        }
        return result.value;
      })(),
      (error) => new UnexpectedError(`Failed to get metas: ${String(error)}`)
    );
  }

  /**
   * Set a meta tag
   * @param name - Meta tag name
   * @param content - Meta tag value
   * @param options - allPages: apply to all pages sharing the template
   */
  @RequireLogin
  setMeta(
    name: string,
    content: string,
    options: { allPages?: boolean } = {}
  ): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        await this.ensureId('setting meta');
        const result = await PageMetaCollection.setMeta(this, name, content, options);
        if (result.isErr()) {
          throw result.error;
        }
      })(),
      (error) => new UnexpectedError(`Failed to set meta: ${String(error)}`)
    );
  }

  /**
   * Delete a meta tag
   * @param name - Meta tag name
   * @param options - allPages: apply to all pages sharing the template
   */
  @RequireLogin
  deleteMeta(name: string, options: { allPages?: boolean } = {}): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        await this.ensureId('deleting meta');
        const result = await PageMetaCollection.deleteMeta(this, name, options);
        if (result.isErr()) {
          throw result.error;
        }
      })(),
      (error) => new UnexpectedError(`Failed to delete meta: ${String(error)}`)
    );
  }

  /**
   * Get page source (auto-acquire if not yet acquired)
   * @returns Page source
   */
  getSource(): WikidotResultAsync<PageSource> {
    return fromPromise(
      (async () => {
        if (this._source === null) {
          const result = await PageCollection.acquirePageIds(this.site, [this]);
          if (result.isErr()) {
            throw result.error;
          }
          const sourceResult = await PageCollection.acquirePageSources(this.site, [this]);
          if (sourceResult.isErr()) {
            throw sourceResult.error;
          }
        }
        if (this._source === null) {
          throw new NotFoundException('Cannot find page source');
        }
        return this._source;
      })(),
      (error) => {
        if (error instanceof NotFoundException) return error;
        return new UnexpectedError(`Failed to get source: ${String(error)}`);
      }
    );
  }

  /**
   * Get revision history (auto-acquire if not yet acquired)
   * @returns Revision collection
   */
  getRevisions(): WikidotResultAsync<PageRevisionCollection> {
    return fromPromise(
      (async () => {
        if (this._revisions === null) {
          const result = await PageCollection.acquirePageIds(this.site, [this]);
          if (result.isErr()) {
            throw result.error;
          }
          const revResult = await PageCollection.acquirePageRevisions(this.site, [this]);
          if (revResult.isErr()) {
            throw revResult.error;
          }
        }
        if (this._revisions === null) {
          throw new NotFoundException('Cannot find page revisions');
        }
        return this._revisions;
      })(),
      (error) => {
        if (error instanceof NotFoundException) return error;
        return new UnexpectedError(`Failed to get revisions: ${String(error)}`);
      }
    );
  }

  /**
   * Get vote information (auto-acquire if not yet acquired)
   * @returns Vote collection
   */
  getVotes(): WikidotResultAsync<PageVoteCollection> {
    return fromPromise(
      (async () => {
        if (this._votes === null) {
          const result = await PageCollection.acquirePageIds(this.site, [this]);
          if (result.isErr()) {
            throw result.error;
          }
          const votesResult = await PageCollection.acquirePageVotes(this.site, [this]);
          if (votesResult.isErr()) {
            throw votesResult.error;
          }
        }
        if (this._votes === null) {
          throw new NotFoundException('Cannot find page votes');
        }
        return this._votes;
      })(),
      (error) => {
        if (error instanceof NotFoundException) return error;
        return new UnexpectedError(`Failed to get votes: ${String(error)}`);
      }
    );
  }

  /**
   * Open a manual edit session for this page
   *
   * Unlike `edit()`/`site.page.create()`, which perform a single
   * create-or-edit round trip, this returns an unopened `PageEditSession`
   * for callers that need access to intermediate operations while the
   * lock is held (preview, diff, synchronize, section/append mode,
   * andContinue, ...). Use `withEditLock()` so the lock is always
   * released unless save() succeeds.
   */
  openEditor(
    options: { mode?: EditMode; section?: number | null; forceLock?: boolean } = {}
  ): PageEditSession {
    return new PageEditSession({
      site: this.site,
      fullname: this.fullname,
      pageId: this._id,
      mode: options.mode,
      section: options.section,
      forceLock: options.forceLock,
    });
  }

  /**
   * Get this page's source for use as a page-creation template (edit/TemplateSourceModule)
   *
   * Distinct from getSource(): this is the wire endpoint Wikidot uses when
   * populating a new page's editor from a template page selection, not
   * general source retrieval.
   */
  getTemplateSource(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('getting template source');
        const result = await this.site.amcRequest([
          { moduleName: 'edit/TemplateSourceModule', page_id: pageId },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'edit/TemplateSourceModule');
      })(),
      (error) => new UnexpectedError(`Failed to get template source: ${String(error)}`)
    );
  }

  /**
   * Get the rendered page-block form (pageblock/PageBlockModule)
   */
  getBlockForm(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('getting block form');
        const result = await this.site.amcRequest([
          { moduleName: 'pageblock/PageBlockModule', page_id: pageId },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'pageblock/PageBlockModule');
      })(),
      (error) => new UnexpectedError(`Failed to get block form: ${String(error)}`)
    );
  }

  /**
   * Set or clear this page's edit-block flag (WikiPageAction/saveBlock)
   *
   * A blocked page cannot be edited by non-moderator users.
   * @param block - Whether to block editing (default true)
   */
  @RequireLogin
  setBlock(block = true): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('setting block');
        const result = await this.site.amcRequest([
          {
            action: 'WikiPageAction',
            event: 'saveBlock',
            moduleName: 'Empty',
            pageId,
            ...omitFalsy({ block: flag(block) }),
          },
        ]);
        if (result.isErr()) throw result.error;
      })(),
      (error) => new UnexpectedError(`Failed to set block: ${String(error)}`)
    );
  }

  /**
   * Get pages linking to this page (backlinks/BacklinksModule)
   *
   * Returns the raw HTML rather than a parsed list; the exact markup was
   * not captured during wire-format research (same caveat as
   * getRenameBacklinks(), which uses a different, rename-specific module).
   */
  getBacklinks(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('getting backlinks');
        const result = await this.site.amcRequest([
          { moduleName: 'backlinks/BacklinksModule', page_id: pageId },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'backlinks/BacklinksModule');
      })(),
      (error) => new UnexpectedError(`Failed to get backlinks: ${String(error)}`)
    );
  }

  /**
   * Watch this page for changes (WatchAction/watchPage)
   */
  @RequireLogin
  watch(): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('watching');
        const result = await this.site.amcRequest([
          { action: 'WatchAction', event: 'watchPage', moduleName: 'Empty', pageId },
        ]);
        if (result.isErr()) throw result.error;
      })(),
      (error) => new UnexpectedError(`Failed to watch page: ${String(error)}`)
    );
  }

  /**
   * Get the list of users watching this page (watch/WhoWatchesModule)
   */
  getWatchers(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('getting watchers');
        const result = await this.site.amcRequest([
          { moduleName: 'watch/WhoWatchesModule', page_id: pageId, verbose: true },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'watch/WhoWatchesModule');
      })(),
      (error) => new UnexpectedError(`Failed to get watchers: ${String(error)}`)
    );
  }

  /**
   * Get the rendered tags editing form (pagetags/PageTagsModule)
   */
  getTagsForm(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('getting tags form');
        const result = await this.site.amcRequest([
          { moduleName: 'pagetags/PageTagsModule', pageId },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'pagetags/PageTagsModule');
      })(),
      (error) => new UnexpectedError(`Failed to get tags form: ${String(error)}`)
    );
  }

  /**
   * Update tags via the quick-tag button UI (WikiPageAction/updateTagsByButton)
   *
   * Distinct from commitTags(): that saves the current `tags` property in
   * full via WikiPageAction/saveTags. This instead mirrors clicking one of
   * Wikidot's own quick-tag buttons, which sends whatever tag string the
   * button computed client-side rather than the page's current tag list.
   * @param tags - Space-separated tag string to apply
   */
  @RequireLogin
  updateTagsByButton(tags: string): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('updating tags by button');
        const result = await this.site.amcRequest([
          {
            action: 'WikiPageAction',
            event: 'updateTagsByButton',
            moduleName: 'Empty',
            pageId,
            tags,
          },
        ]);
        if (result.isErr()) throw result.error;
      })(),
      (error) => new UnexpectedError(`Failed to update tags by button: ${String(error)}`)
    );
  }

  /**
   * Get the rendered parent-page selection form (parent/ParentPageModule)
   */
  getParentForm(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('getting parent form');
        const result = await this.site.amcRequest([
          { moduleName: 'parent/ParentPageModule', page_id: pageId },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'parent/ParentPageModule');
      })(),
      (error) => new UnexpectedError(`Failed to get parent form: ${String(error)}`)
    );
  }

  /**
   * Get pages linking to this page, for building rename()'s fixdeps (rename/RenameBacklinksModule)
   *
   * Returns the rendered HTML listing backlink pages with checkboxes; the
   * IDs of the ones a caller wants fixed up are what rename()'s `fixdeps`
   * expects. The exact list markup was not captured during wire-format
   * research (only the request/response shape is documented), so this
   * returns the raw body rather than a parsed ID list.
   */
  getRenameBacklinks(): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        const pageId = await this.ensureId('getting rename backlinks');
        const result = await this.site.amcRequest([
          { moduleName: 'rename/RenameBacklinksModule', page_id: pageId },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'rename/RenameBacklinksModule');
      })(),
      (error) => new UnexpectedError(`Failed to get rename backlinks: ${String(error)}`)
    );
  }

  toString(): string {
    return `Page(fullname=${this.fullname}, title=${this.title})`;
  }
}

/**
 * Page collection
 */
export class PageCollection extends Array<Page> {
  public readonly site: Site;

  constructor(site: Site, pages?: Page[]) {
    super();
    this.site = site;
    if (pages) {
      this.push(...pages);
    }
  }

  /**
   * Find by fullname
   * @param fullname - Page fullname
   * @returns Page (undefined if not found)
   */
  findByFullname(fullname: string): Page | undefined {
    return this.find((page) => page.fullname === fullname);
  }

  /**
   * Acquire page IDs in bulk
   */
  getPageIds(): WikidotResultAsync<PageCollection> {
    return PageCollection.acquirePageIds(this.site, this);
  }

  /**
   * Acquire page sources in bulk
   */
  getPageSources(): WikidotResultAsync<PageCollection> {
    return PageCollection.acquirePageSources(this.site, this);
  }

  /**
   * Acquire page revisions in bulk
   */
  getPageRevisions(): WikidotResultAsync<PageCollection> {
    return PageCollection.acquirePageRevisions(this.site, this);
  }

  /**
   * Acquire page votes in bulk
   */
  getPageVotes(): WikidotResultAsync<PageCollection> {
    return PageCollection.acquirePageVotes(this.site, this);
  }

  /**
   * Acquire page files in bulk
   */
  getPageFiles(): WikidotResultAsync<PageCollection> {
    return PageCollection.acquirePageFiles(this.site, this);
  }

  /**
   * Internal method to acquire page files in bulk
   */
  static acquirePageFiles(site: Site, pages: Page[]): WikidotResultAsync<PageCollection> {
    return fromPromise(
      (async () => {
        const targetPages = pages.filter((page) => page.id !== null);

        if (targetPages.length === 0) {
          return new PageCollection(site, pages);
        }

        const result = await site.amcRequest(
          targetPages.map((page) => ({
            moduleName: 'files/PageFilesModule',
            page_id: page.id,
          }))
        );

        if (result.isErr()) {
          throw result.error;
        }

        for (let i = 0; i < targetPages.length; i++) {
          const page = targetPages[i];
          const response = result.value[i];
          if (!page || !response) continue;

          const html = requireBody(response, 'files/PageFilesModule');
          const $ = cheerio.load(html);
          const files = PageFileCollection._parseFromHtml(page, $);
          page._files = new PageFileCollection(page, files);
        }

        return new PageCollection(site, pages);
      })(),
      (error) => new UnexpectedError(`Failed to acquire page files: ${String(error)}`)
    );
  }

  /**
   * Internal method to acquire page IDs in bulk
   */
  static acquirePageIds(site: Site, pages: Page[]): WikidotResultAsync<PageCollection> {
    return fromPromise(
      (async () => {
        const targetPages = pages.filter((page) => !page.isIdAcquired());

        if (targetPages.length === 0) {
          return new PageCollection(site, pages);
        }

        // Limit concurrent connections (using same semaphoreLimit as AMCClient)
        const limit = pLimit(site.client.amcClient.config.semaphoreLimit);
        const config = site.client.amcClient.config;

        // Access with norender, noredirect (with retry)
        const responses = await Promise.all(
          targetPages.map((page) =>
            limit(async () => {
              const url = `${page.getUrl()}/norender/true/noredirect/true`;
              const response = await fetchWithRetry(url, config, {
                headers: site.client.amcClient.header.getHeaders(),
              });
              return { page, response };
            })
          )
        );

        for (const { page, response } of responses) {
          const text = await response.text();
          const match = text.match(/WIKIREQUEST\.info\.pageId\s*=\s*(\d+);/);
          if (!match?.[1]) {
            throw new NoElementError(`Cannot find page id: ${page.fullname}`);
          }
          page.id = Number.parseInt(match[1], 10);
        }

        return new PageCollection(site, pages);
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to acquire page IDs: ${String(error)}`);
      }
    );
  }

  /**
   * Internal method to acquire page sources in bulk
   */
  static acquirePageSources(site: Site, pages: Page[]): WikidotResultAsync<PageCollection> {
    return fromPromise(
      (async () => {
        const targetPages = pages.filter((page) => page.source === null && page.id !== null);

        if (targetPages.length === 0) {
          return new PageCollection(site, pages);
        }

        const result = await site.amcRequest(
          targetPages.map((page) => ({
            moduleName: 'viewsource/ViewSourceModule',
            page_id: page.id,
          }))
        );

        if (result.isErr()) {
          throw result.error;
        }

        for (let i = 0; i < targetPages.length; i++) {
          const page = targetPages[i];
          const response = result.value[i];
          if (!page || !response) continue;
          const body = requireBody(response, 'viewsource/ViewSourceModule').replace(/&nbsp;/g, ' ');
          const $ = cheerio.load(body);
          const sourceElement = $('div.page-source');
          if (sourceElement.length === 0) {
            throw new NoElementError(`Cannot find source element for page: ${page.fullname}`);
          }
          const wikiText = sourceElement.text().trim().replace(/^\t/, '');
          page.source = new PageSource({ page, wikiText });
        }

        return new PageCollection(site, pages);
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to acquire page sources: ${String(error)}`);
      }
    );
  }

  /**
   * Internal method to acquire page revisions in bulk
   */
  static acquirePageRevisions(site: Site, pages: Page[]): WikidotResultAsync<PageCollection> {
    return fromPromise(
      (async () => {
        const targetPages = pages.filter((page) => page.revisions === null && page.id !== null);

        if (targetPages.length === 0) {
          return new PageCollection(site, pages);
        }

        const result = await site.amcRequestWithRetry(
          targetPages.map((page) => ({
            moduleName: 'history/PageRevisionListModule',
            page_id: page.id,
            options: { all: true },
            perpage: 100000000,
          }))
        );

        if (result.isErr()) {
          throw result.error;
        }

        // Parse revisions
        for (let i = 0; i < targetPages.length; i++) {
          const page = targetPages[i];
          const response = result.value[i];
          if (!page || !response) continue;

          const body = requireBody(response, 'history/PageRevisionListModule');
          const $ = cheerio.load(body);
          page.revisions = new PageRevisionCollection(page, parseRevisionListHtml($, page));
        }

        return new PageCollection(site, pages);
      })(),
      (error) => new UnexpectedError(`Failed to acquire page revisions: ${String(error)}`)
    );
  }

  /**
   * Internal method to acquire page votes in bulk
   */
  static acquirePageVotes(site: Site, pages: Page[]): WikidotResultAsync<PageCollection> {
    return fromPromise(
      (async () => {
        const targetPages = pages.filter((page) => page.votes === null && page.id !== null);

        if (targetPages.length === 0) {
          return new PageCollection(site, pages);
        }

        const result = await site.amcRequestWithRetry(
          targetPages.map((page) => ({
            moduleName: 'pagerate/WhoRatedPageModule',
            pageId: page.id,
          }))
        );

        if (result.isErr()) {
          throw result.error;
        }

        // Parse votes
        for (let i = 0; i < targetPages.length; i++) {
          const page = targetPages[i];
          const response = result.value[i];
          if (!page || !response) continue;

          const body = requireBody(response, 'pagerate/WhoRatedPageModule');
          const $ = cheerio.load(body);

          const $userElems = $('span.printuser');
          const $valueElems = $("span[style^='color']");

          if ($userElems.length !== $valueElems.length) {
            throw new UnexpectedError('User and value count mismatch in votes');
          }

          const votes: PageVote[] = [];
          $userElems.each((j, userElem) => {
            const $user = $(userElem);
            const $value = $valueElems.eq(j);

            const user = parseUser(site.client, $user as Cheerio<AnyNode>);
            const valueText = $value.text().trim();

            let value: number;
            if (valueText === '+') {
              value = 1;
            } else if (valueText === '-') {
              value = -1;
            } else {
              value = Number.parseInt(valueText, 10) || 0;
            }

            votes.push(new PageVote({ page, user, value }));
          });

          page.votes = new PageVoteCollection(page, votes);
        }

        return new PageCollection(site, pages);
      })(),
      (error) => new UnexpectedError(`Failed to acquire page votes: ${String(error)}`)
    );
  }

  /**
   * Parse ListPagesModule response
   */
  static parse(
    site: Site,
    htmlBody: cheerio.CheerioAPI,
    _parseUser: (element: cheerio.Cheerio<AnyNode>) => AbstractUser
  ): PageCollection {
    const pages: Page[] = [];

    htmlBody('div.page').each((_i, pageElement) => {
      const $page = htmlBody(pageElement);
      const pageParams: Record<string, unknown> = {};

      // Check for 5-star rating
      const is5StarRating = $page.find('span.rating span.page-rate-list-pages-start').length > 0;

      // Get each value
      $page.find('span.set').each((_j, setElement) => {
        const $set = htmlBody(setElement);
        const keyElement = $set.find('span.name');
        if (keyElement.length === 0) return;

        let key = keyElement.text().trim();
        const valueElement = $set.find('span.value');

        let value: unknown = null;

        if (valueElement.length === 0) {
          value = null;
        } else if (['created_at', 'updated_at', 'commented_at'].includes(key)) {
          const odateElement = valueElement.find('span.odate');
          if (odateElement.length > 0) {
            const timestamp = odateElement.attr('class')?.match(/time_(\d+)/)?.[1];
            value = timestamp ? new Date(Number.parseInt(timestamp, 10) * 1000) : null;
          }
        } else if (
          ['created_by_linked', 'updated_by_linked', 'commented_by_linked'].includes(key)
        ) {
          const printuserElement = valueElement.find('span.printuser');
          if (printuserElement.length > 0) {
            value = _parseUser(printuserElement);
          }
        } else if (['tags', '_tags'].includes(key)) {
          value = valueElement.text().split(/\s+/).filter(Boolean);
        } else if (['rating_votes', 'comments', 'size', 'revisions'].includes(key)) {
          value = Number.parseInt(valueElement.text().trim(), 10) || 0;
        } else if (key === 'rating') {
          const ratingText = valueElement.text().trim();
          value = is5StarRating
            ? Number.parseFloat(ratingText) || 0
            : Number.parseInt(ratingText, 10) || 0;
        } else if (key === 'rating_percent') {
          if (is5StarRating) {
            value = (Number.parseFloat(valueElement.text().trim()) || 0) / 100;
          } else {
            value = null;
          }
        } else {
          value = valueElement.text().trim();
        }

        // Key conversion
        if (key.includes('_linked')) {
          key = key.replace('_linked', '');
        } else if (['comments', 'children', 'revisions'].includes(key)) {
          key = `${key}_count`;
        } else if (key === 'rating_votes') {
          key = 'votes_count';
        }

        pageParams[key] = value;
      });

      // Merge tags
      const tags = Array.isArray(pageParams.tags) ? pageParams.tags : [];
      const hiddenTags = Array.isArray(pageParams._tags) ? pageParams._tags : [];
      pageParams.tags = [...tags, ...hiddenTags];

      // Validate with Zod schema and apply defaults
      const parsed = pageParamsSchema.parse(pageParams);

      // Create Page object
      pages.push(
        new Page({
          site,
          fullname: parsed.fullname,
          name: parsed.name,
          category: parsed.category,
          title: parsed.title,
          childrenCount: parsed.children_count,
          commentsCount: parsed.comments_count,
          size: parsed.size,
          rating: parsed.rating,
          votesCount: parsed.votes_count,
          ratingPercent: parsed.rating_percent,
          revisionsCount: parsed.revisions_count,
          parentFullname: parsed.parent_fullname,
          tags: parsed.tags,
          createdBy: parsed.created_by,
          createdAt: parsed.created_at ?? new Date(),
          updatedBy: parsed.updated_by,
          updatedAt: parsed.updated_at ?? new Date(),
          commentedBy: parsed.commented_by,
          commentedAt: parsed.commented_at,
        })
      );
    });

    return new PageCollection(site, pages);
  }

  /**
   * Search pages
   */
  static searchPages(
    site: Site,
    parseUser: (element: cheerio.Cheerio<AnyNode>) => AbstractUser,
    query: SearchPagesQuery | null = null
  ): WikidotResultAsync<PageCollection> {
    return fromPromise(
      (async () => {
        const q = query ?? new SearchPagesQuery();
        const queryDict = q.asDict();

        // Generate module body
        const moduleBody = `[[div class="page"]]\n${DEFAULT_MODULE_BODY.map(
          (key) =>
            `[[span class="set ${key}"]][[span class="name"]] ${key} [[/span]][[span class="value"]] %%${key}%% [[/span]][[/span]]`
        ).join('')}\n[[/div]]`;

        const requestBody = {
          ...queryDict,
          moduleName: 'list/ListPagesModule',
          module_body: moduleBody,
        };

        const result = await site.amcRequest([requestBody]);
        if (result.isErr()) {
          if (result.error.message.includes('not_ok')) {
            throw new ForbiddenError('Failed to get pages, target site may be private');
          }
          throw result.error;
        }

        const firstResponse = result.value[0];
        const body = requireBody(firstResponse, 'list/ListPagesModule');
        const $first = cheerio.load(body);

        let total = 1;
        const htmlBodies: cheerio.CheerioAPI[] = [$first];

        // Check pagination
        const pagerElement = $first('div.pager');
        if (pagerElement.length > 0) {
          const lastPagerElements = $first('div.pager span.target');
          if (lastPagerElements.length >= 2) {
            const secondLastPager = $first(lastPagerElements[lastPagerElements.length - 2]);
            const lastPagerLink = secondLastPager.find('a');
            if (lastPagerLink.length > 0) {
              total = Number.parseInt(lastPagerLink.text().trim(), 10) || 1;
            }
          }
        }

        // Get additional pages
        if (total > 1) {
          const additionalBodies: AMCRequestBody[] = [];
          for (let i = 1; i < total; i++) {
            additionalBodies.push({
              ...queryDict,
              moduleName: 'list/ListPagesModule',
              module_body: moduleBody,
              offset: i * (q.perPage ?? DEFAULT_PER_PAGE),
            } as AMCRequestBody);
          }

          const additionalResults = await site.amcRequest(additionalBodies);
          if (additionalResults.isErr()) {
            throw additionalResults.error;
          }

          for (const response of additionalResults.value) {
            const respBody = requireBody(response, 'list/ListPagesModule');
            htmlBodies.push(cheerio.load(respBody));
          }
        }

        // Parse
        const pages: Page[] = [];
        for (const $html of htmlBodies) {
          const parsed = PageCollection.parse(site, $html, parseUser);
          pages.push(...parsed);
        }

        return new PageCollection(site, pages);
      })(),
      (error) => {
        if (error instanceof ForbiddenError || error instanceof NotFoundException) {
          return error;
        }
        return new UnexpectedError(`Failed to search pages: ${String(error)}`);
      }
    );
  }

  /**
   * Create or edit a page
   */
  static createOrEdit(
    site: Site,
    fullname: string,
    options: {
      pageId?: number | null;
      title?: string;
      source?: string;
      comment?: string;
      forceEdit?: boolean;
      raiseOnExists?: boolean;
    } = {}
  ): WikidotResultAsync<void> {
    const loginResult = site.client.requireLogin();
    if (loginResult.isErr()) {
      return fromPromise(
        Promise.reject(loginResult.error),
        () => new LoginRequiredError('Login required to create/edit page')
      );
    }

    const {
      pageId = null,
      title = '',
      source = '',
      comment = '',
      forceEdit = false,
      raiseOnExists = false,
    } = options;

    // PageEditSession/withEditLock guarantees the lock lifecycle
    // (acquire via edit/PageEditModule, release via removePageEditLock
    // unless save() succeeds) -- see page-edit-session.ts D5.
    const session = new PageEditSession({ site, fullname, pageId, forceLock: forceEdit });

    return withEditLock(session, (ed) =>
      fromPromise(
        (async () => {
          if (raiseOnExists && ed.isExistingPage) {
            throw new TargetExistsError(`Page ${fullname} already exists`);
          }
          if (ed.isExistingPage && pageId === null) {
            throw new UnexpectedError('page_id must be specified when editing existing page');
          }

          const saveResult = await ed.save({ title, source, comment });
          if (saveResult.isErr()) {
            throw saveResult.error;
          }
        })(),
        (error) => {
          if (error instanceof TargetExistsError) {
            return error;
          }
          return new UnexpectedError(`Failed to create/edit page: ${String(error)}`);
        }
      )
    );
  }
}

export { SearchPagesQuery };
