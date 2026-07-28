/**
 * Module for managing Wikidot page edit sessions
 *
 * Wraps the lock lifecycle of `edit/PageEditModule` (acquire via open(),
 * keep alive via synchronize(), release via removePageEditLock) behind an
 * explicit session object. TypeScript has no context-manager protocol, so
 * `withEditLock()` provides the callback-based equivalent of wikidot.py's
 * `with PageEditSession(...) as ed:` -- it opens the session, runs the
 * callback, and releases the lock unless save() succeeded. Wikidot holds
 * the lock for up to 15 minutes once edit/PageEditModule is requested; any
 * code path that acquires the lock but does not reach a successful
 * savePage must release it explicitly, or the page stays uneditable for
 * other users until the lock expires. See 30_plan.md D5 in the sibling
 * wikidot.py repo's memory directory
 * (`.local/memory/260728_wikidot-ajax-modules/`) for the design rationale.
 */

import { TargetError, UnexpectedError, WikidotError } from '../../common/errors';
import { logger } from '../../common/logger';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { checkbox, omitFalsy } from '../../connector/amc-body';
import { requireBody } from '../../connector/amc-client';
import type { AMCRequestBody } from '../../connector/amc-types';
import type { Site } from '../site';

/** Edit mode accepted by edit/PageEditModule. "section" requires `section`
 * to be set; save() then takes rangeStart/rangeEnd instead. */
export type EditMode = 'page' | 'section' | 'append';

/** Options for constructing a PageEditSession */
export interface PageEditSessionOptions {
  site: Site;
  fullname: string;
  pageId?: number | null;
  mode?: EditMode;
  section?: number | null;
  forceLock?: boolean;
}

/** Options for PageEditSession.save() */
export interface SaveOptions {
  title?: string;
  source?: string;
  comment?: string;
  andContinue?: boolean;
  rangeStart?: number;
  rangeEnd?: number;
  tags?: string;
  parentPage?: string;
  dontNotifyWatchers?: boolean;
}

/** Options for PageEditSession.checkDraftExists() */
export interface CheckDraftExistsOptions {
  title?: string;
  source?: string;
  comment?: string;
}

/** Options for PageEditSession.preview() */
export interface PreviewOptions {
  title?: string;
  source?: string;
  pageUnixName?: string;
  rangeStart?: number;
  rangeEnd?: number;
}

/** Options for PageEditSession.diff() */
export interface DiffOptions {
  title?: string;
  source?: string;
  rangeStart?: number;
  rangeEnd?: number;
}

function toWikidotError(error: unknown): WikidotError {
  return error instanceof WikidotError ? error : new UnexpectedError(String(error));
}

/**
 * A single Wikidot page edit session
 *
 * Acquiring the lock (via `open()`) talks to `edit/PageEditModule`. From
 * that point on the lock is held until either `save()` succeeds or the
 * session is released (explicitly via `release()`, or automatically by
 * `withEditLock()` if `save()` never succeeded).
 */
export class PageEditSession {
  public readonly site: Site;
  public readonly fullname: string;
  public readonly pageId: number | null;
  public readonly mode: EditMode;
  public readonly section: number | null;
  public readonly forceLock: boolean;

  private _lockId: string | null = null;
  private _lockSecret: string | null = null;
  private _revisionId = '';
  private _timeLeft: number | null = null;
  private _isExistingPage = false;
  private _saved = false;
  private _locked = false;

  /**
   * @param options - Session options. `mode: "section"` requires `section` to be set
   */
  constructor(options: PageEditSessionOptions) {
    this.site = options.site;
    this.fullname = options.fullname;
    this.pageId = options.pageId ?? null;
    this.mode = options.mode ?? 'page';
    this.section = options.section ?? null;
    this.forceLock = options.forceLock ?? false;

    if (this.mode === 'section' && this.section === null) {
      throw new Error('section must be specified when mode is "section"');
    }
  }

  /** Lock ID, set once the session is open */
  get lockId(): string | null {
    return this._lockId;
  }

  /** Lock secret, set once the session is open */
  get lockSecret(): string | null {
    return this._lockSecret;
  }

  /** Revision ID submitted with save/synchronize requests */
  get revisionId(): string {
    return this._revisionId;
  }

  /** Remaining lock time in seconds, last refreshed by open/synchronize/forceLockIntercept/recreateExpiredLock */
  get timeLeft(): number | null {
    return this._timeLeft;
  }

  /** Whether the page already existed when the lock was acquired */
  get isExistingPage(): boolean {
    return this._isExistingPage;
  }

  /** Whether save() has completed successfully */
  get saved(): boolean {
    return this._saved;
  }

  /** Whether the lock is currently held */
  get isOpen(): boolean {
    return this._locked;
  }

  private requireOpen(): void {
    if (!this._locked) {
      throw new UnexpectedError('Edit session is not open; call open() first');
    }
  }

  private lockParams(): AMCRequestBody {
    this.requireOpen();
    return {
      mode: this.mode,
      wiki_page: this.fullname,
      lock_id: this._lockId,
      lock_secret: this._lockSecret,
      revision_id: this._revisionId,
      ...omitFalsy({ page_id: this.pageId ?? undefined }),
    };
  }

  /**
   * Acquire the edit lock (edit/PageEditModule)
   */
  open(): WikidotResultAsync<PageEditSession> {
    return fromPromise(
      (async () => {
        const loginResult = this.site.client.requireLogin();
        if (loginResult.isErr()) {
          throw loginResult.error ?? new UnexpectedError('Login required');
        }

        const body: AMCRequestBody = {
          mode: this.mode,
          wiki_page: this.fullname,
          moduleName: 'edit/PageEditModule',
          ...omitFalsy({
            page_id: this.pageId ?? undefined,
            force_lock: this.forceLock ? 'yes' : undefined,
          }),
        };
        if (this.mode === 'section') {
          body.section = this.section ?? undefined;
        }

        const result = await this.site.amcRequest([body]);
        if (result.isErr()) {
          throw result.error;
        }
        const data = result.value[0];
        if (!data) {
          throw new UnexpectedError('Empty response from edit/PageEditModule');
        }

        if (data.locked || data.other_locks) {
          throw new TargetError(`Page ${this.fullname} is locked or other locks exist`);
        }

        this._isExistingPage = 'page_revision_id' in data;
        this._lockId = String(data.lock_id ?? '');
        this._lockSecret = String(data.lock_secret ?? '');
        this._revisionId = data.page_revision_id !== undefined ? String(data.page_revision_id) : '';
        this._timeLeft = typeof data.timeLeft === 'number' ? data.timeLeft : null;
        this._locked = true;
        return this;
      })(),
      toWikidotError
    );
  }

  /**
   * Save the page (WikiPageAction/savePage)
   *
   * `andContinue` keeps the lock/editor open; Wikidot returns a fresh
   * `revisionId` in the response in that case. `rangeStart`/`rangeEnd` are
   * only meaningful when mode is "section". `tags`/`parentPage` are only
   * used when creating a page via a /tags/... or /parentPage/... URL.
   */
  save(options: SaveOptions = {}): WikidotResultAsync<Record<string, unknown>> {
    return fromPromise(
      (async () => {
        const body: AMCRequestBody = {
          action: 'WikiPageAction',
          event: 'savePage',
          moduleName: 'Empty',
          ...this.lockParams(),
          title: options.title ?? '',
          source: options.source ?? '',
          comments: options.comment ?? '',
          ...omitFalsy({
            and_continue: options.andContinue ? 'yes' : undefined,
            range_start: options.rangeStart,
            range_end: options.rangeEnd,
            tags: options.tags,
            parentPage: options.parentPage,
            dont_notify_watchers: checkbox(options.dontNotifyWatchers),
          }),
        };

        const result = await this.site.amcRequest([body]);
        if (result.isErr()) {
          throw result.error;
        }
        const data = result.value[0];
        if (!data) {
          throw new UnexpectedError('Empty response from savePage');
        }

        if (data.status !== 'ok') {
          throw new UnexpectedError(
            `Failed to save page: ${this.fullname} (status: ${String(data.status)})`
          );
        }

        // Wikidot reports lock loss as `noLockError: true` alongside status
        // "ok", not as a distinct status value, so this is checked
        // separately from the status branch above.
        if (data.noLockError) {
          throw new TargetError(
            `Edit lock lost while saving page ${this.fullname}: ${String(data.body ?? '')}`
          );
        }

        this._saved = true;
        return data;
      })(),
      toWikidotError
    );
  }

  /**
   * Keep the edit lock alive (WikiPageAction/synchronize)
   *
   * Call periodically while the editor stays open without saving.
   * @param sinceLastInput - Seconds elapsed since the last user input
   */
  synchronize(sinceLastInput = 0): WikidotResultAsync<Record<string, unknown>> {
    return fromPromise(
      (async () => {
        const body: AMCRequestBody = {
          action: 'WikiPageAction',
          event: 'synchronize',
          moduleName: 'Empty',
          ...this.lockParams(),
          since_last_input: sinceLastInput,
        };
        const result = await this.site.amcRequest([body]);
        if (result.isErr()) {
          throw result.error;
        }
        const data = result.value[0];
        if (!data) {
          throw new UnexpectedError('Empty response from synchronize');
        }

        if (data.noLockError) {
          throw new TargetError(`Edit lock lost for page ${this.fullname}`);
        }

        // Wikidot may recreate the lock transparently; the response then
        // carries fresh camelCase lockId/lockSecret that must replace the
        // ones used to acquire the lock, or subsequent calls fail.
        if (data.lockRecreated) {
          this._lockId = String(data.lockId ?? '');
          this._lockSecret = String(data.lockSecret ?? '');
        }

        this._timeLeft = typeof data.timeLeft === 'number' ? data.timeLeft : null;
        return data;
      })(),
      toWikidotError
    );
  }

  /**
   * Check whether a draft already exists for this lock (WikiPageAction/checkDraftExists)
   *
   * The wire format echoes `form(edit-page-form)` back to the server
   * alongside the lock identifiers; the exact reason the server wants the
   * in-progress content for this check (as opposed to just the lock id) is
   * not documented upstream, so the parameters sent here are an
   * implementation judgment call rather than a confirmed wire contract.
   */
  checkDraftExists(options: CheckDraftExistsOptions = {}): WikidotResultAsync<boolean> {
    return fromPromise(
      (async () => {
        this.requireOpen();
        const body: AMCRequestBody = {
          action: 'WikiPageAction',
          event: 'checkDraftExists',
          moduleName: 'Empty',
          wiki_page: this.fullname,
          lock_id: this._lockId,
          title: options.title ?? '',
          source: options.source ?? '',
          comments: options.comment ?? '',
          ...omitFalsy({ page_id: this.pageId ?? undefined }),
        };
        const result = await this.site.amcRequest([body]);
        if (result.isErr()) {
          throw result.error;
        }
        return Boolean(result.value[0]?.draftExists);
      })(),
      toWikidotError
    );
  }

  /**
   * Forcibly take over another user's lock (WikiPageAction/forceLockIntercept)
   *
   * On success this session's lockId/lockSecret are updated in place.
   */
  forceLockIntercept(): WikidotResultAsync<Record<string, unknown>> {
    return fromPromise(
      (async () => {
        const body: AMCRequestBody = {
          action: 'WikiPageAction',
          event: 'forceLockIntercept',
          moduleName: 'Empty',
          ...this.lockParams(),
        };
        const result = await this.site.amcRequest([body]);
        if (result.isErr()) {
          throw result.error;
        }
        const data = result.value[0];
        if (!data) {
          throw new UnexpectedError('Empty response from forceLockIntercept');
        }
        if ('lock_id' in data) {
          this._lockId = String(data.lock_id);
        }
        if ('lock_secret' in data) {
          this._lockSecret = String(data.lock_secret);
        }
        this._timeLeft = typeof data.timeLeft === 'number' ? data.timeLeft : null;
        return data;
      })(),
      toWikidotError
    );
  }

  /**
   * Recreate an expired lock (WikiPageAction/recreateExpiredLock)
   *
   * On success this session's lockId/lockSecret are updated in place.
   */
  recreateExpiredLock(): WikidotResultAsync<Record<string, unknown>> {
    return fromPromise(
      (async () => {
        const body: AMCRequestBody = {
          action: 'WikiPageAction',
          event: 'recreateExpiredLock',
          moduleName: 'Empty',
          ...this.lockParams(),
          since_last_input: 0,
        };
        const result = await this.site.amcRequest([body]);
        if (result.isErr()) {
          throw result.error;
        }
        const data = result.value[0];
        if (!data) {
          throw new UnexpectedError('Empty response from recreateExpiredLock');
        }
        if (data.lockRecreated) {
          this._lockId = String(data.lockId ?? '');
          this._lockSecret = String(data.lockSecret ?? '');
        }
        this._timeLeft = typeof data.timeLeft === 'number' ? data.timeLeft : null;
        return data;
      })(),
      toWikidotError
    );
  }

  /**
   * Release the edit lock (WikiPageAction/removePageEditLock)
   *
   * Safe to call on a session that was never opened (no-op in that case).
   * Failures are logged, not thrown, so calling this from `withEditLock()`
   * never masks whatever error triggered the release.
   * @param leaveDraft - Whether to keep the in-progress content as a draft instead of discarding it
   */
  release(leaveDraft = false): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        if (!this._locked) {
          return;
        }
        const body: AMCRequestBody = {
          action: 'WikiPageAction',
          event: 'removePageEditLock',
          moduleName: 'Empty',
          lock_id: this._lockId,
          lock_secret: this._lockSecret,
          wiki_page: this.fullname,
          ...omitFalsy({
            leave_draft: leaveDraft || undefined,
            page_id: this.pageId ?? undefined,
          }),
        };
        try {
          const result = await this.site.amcRequest([body]);
          if (result.isErr()) {
            logger.warn(
              `Failed to release page edit lock for ${this.fullname}: ${String(result.error)}`
            );
          }
        } finally {
          this._locked = false;
        }
      })(),
      toWikidotError
    );
  }

  /**
   * Render a preview of in-progress content (edit/PagePreviewModule)
   */
  preview(options: PreviewOptions = {}): WikidotResultAsync<{ body: string; title: string }> {
    return fromPromise(
      (async () => {
        this.requireOpen();
        const body: AMCRequestBody = {
          moduleName: 'edit/PagePreviewModule',
          mode: this.mode,
          revision_id: this._revisionId,
          title: options.title ?? '',
          source: options.source ?? '',
          page_unix_name: options.pageUnixName ?? this.fullname,
          ...omitFalsy({
            pageId: this.pageId ?? undefined,
            range_start: options.rangeStart,
            range_end: options.rangeEnd,
          }),
        };
        const result = await this.site.amcRequest([body]);
        if (result.isErr()) {
          throw result.error;
        }
        const response = result.value[0];
        return {
          body: requireBody(response, 'edit/PagePreviewModule'),
          title: response?.title !== undefined ? String(response.title) : '',
        };
      })(),
      toWikidotError
    );
  }

  /**
   * Render a diff of in-progress content against the base revision (edit/PageEditDiffModule)
   */
  diff(options: DiffOptions = {}): WikidotResultAsync<string> {
    return fromPromise(
      (async () => {
        this.requireOpen();
        const body: AMCRequestBody = {
          moduleName: 'edit/PageEditDiffModule',
          mode: this.mode,
          revision_id: this._revisionId,
          title: options.title ?? '',
          source: options.source ?? '',
          ...omitFalsy({
            range_start: options.rangeStart,
            range_end: options.rangeEnd,
          }),
        };
        const result = await this.site.amcRequest([body]);
        if (result.isErr()) {
          throw result.error;
        }
        return requireBody(result.value[0], 'edit/PageEditDiffModule');
      })(),
      toWikidotError
    );
  }
}

/**
 * Run `callback` with an opened PageEditSession, guaranteeing the lock is
 * released unless `save()` succeeded during the callback
 *
 * The callback-based equivalent of wikidot.py's
 * `with PageEditSession(...) as ed:`. If `open()` itself fails, no lock
 * was acquired, so nothing is released.
 * @param session - An unopened PageEditSession
 * @param callback - Receives the opened session; its result (success or
 * error) becomes this function's result
 */
export function withEditLock<T>(
  session: PageEditSession,
  callback: (session: PageEditSession) => WikidotResultAsync<T>
): WikidotResultAsync<T> {
  return fromPromise(
    (async () => {
      const openResult = await session.open();
      if (openResult.isErr()) {
        throw openResult.error;
      }

      try {
        const result = await callback(session);
        if (result.isErr()) {
          throw result.error;
        }
        return result.value;
      } finally {
        if (!session.saved) {
          await session.release();
        }
      }
    })(),
    toWikidotError
  );
}
