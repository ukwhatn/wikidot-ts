import * as cheerio from 'cheerio';
import type { Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { z } from 'zod';
import { RequireLogin } from '../../common/decorators';
import {
  ForbiddenError,
  LoginRequiredError,
  NoElementError,
  NotFoundException,
  TargetExistsError,
  UnexpectedError,
} from '../../common/errors';
import { type WikidotResultAsync, fromPromise } from '../../common/types';
import type { AMCRequestBody } from '../../connector';
import { parseOdate, parseUser } from '../../util/parser';
import type { Site } from '../site';
import type { AbstractUser } from '../user';
import { PageFileCollection } from './page-file';
import { PageMetaCollection } from './page-meta';
import { type PageRevision, PageRevisionCollection } from './page-revision';
import { PageSource } from './page-source';
import { PageVote, PageVoteCollection } from './page-vote';
import { DEFAULT_MODULE_BODY, DEFAULT_PER_PAGE, SearchPagesQuery } from './search-query';

/**
 * ListPagesModuleパース結果のスキーマ
 * 型安全性のためにZodを使用してパース結果を検証
 */
const pageParamsSchema = z.object({
  fullname: z.string().default(''),
  name: z.string().default(''),
  category: z.string().default(''),
  title: z.string().default(''),
  children_count: z.number().default(0),
  comments_count: z.number().default(0),
  size: z.number().default(0),
  rating: z.number().default(0),
  votes_count: z.number().default(0),
  rating_percent: z.number().nullable().default(null),
  revisions_count: z.number().default(0),
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
 * ページデータ
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
 * Wikidotページ
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
   * ページURLを取得
   */
  getUrl(): string {
    return `${this.site.getBaseUrl()}/${this.fullname}`;
  }

  /**
   * ページIDが取得済みかどうか
   */
  isIdAcquired(): boolean {
    return this._id !== null;
  }

  /**
   * ページIDを取得
   */
  get id(): number | null {
    return this._id;
  }

  /**
   * ページIDを設定
   */
  set id(value: number | null) {
    this._id = value;
  }

  /**
   * ソースコードを取得
   */
  get source(): PageSource | null {
    return this._source;
  }

  /**
   * ソースコードを設定
   */
  set source(value: PageSource | null) {
    this._source = value;
  }

  /**
   * リビジョン履歴を取得
   */
  get revisions(): PageRevisionCollection | null {
    return this._revisions;
  }

  /**
   * リビジョン履歴を設定
   */
  set revisions(value: PageRevisionCollection | null) {
    this._revisions = value;
  }

  /**
   * 投票情報を取得
   */
  get votes(): PageVoteCollection | null {
    return this._votes;
  }

  /**
   * 投票情報を設定
   */
  set votes(value: PageVoteCollection | null) {
    this._votes = value;
  }

  /**
   * 最新リビジョンを取得
   */
  get latestRevision(): PageRevision | undefined {
    if (!this._revisions || this._revisions.length === 0) return undefined;
    return this._revisions.reduce((max, rev) => (rev.revNo > max.revNo ? rev : max));
  }

  /**
   * ページIDが必須の操作で、IDがない場合にエラーを返すヘルパー
   * @param operation - 操作名（エラーメッセージ用）
   * @returns ページIDまたはエラーResult
   */
  private requireId(
    operation: string
  ): { ok: true; id: number } | { ok: false; error: WikidotResultAsync<never> } {
    if (this._id === null) {
      return {
        ok: false,
        error: fromPromise(
          Promise.reject(new Error('Page ID not acquired')),
          () => new UnexpectedError(`Page ID must be acquired before ${operation}`)
        ),
      };
    }
    return { ok: true, id: this._id };
  }

  /**
   * ページを削除する
   */
  @RequireLogin
  destroy(): WikidotResultAsync<void> {
    const idCheck = this.requireId('deletion');
    if (!idCheck.ok) return idCheck.error;

    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            action: 'WikiPageAction',
            event: 'deletePage',
            page_id: this._id,
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
   * タグを保存する
   */
  @RequireLogin
  commitTags(): WikidotResultAsync<void> {
    const idCheck = this.requireId('saving tags');
    if (!idCheck.ok) return idCheck.error;

    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            tags: this.tags.join(' '),
            action: 'WikiPageAction',
            event: 'saveTags',
            pageId: this._id,
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
   * 親ページを設定する
   * @param parentFullname - 親ページのフルネーム（nullで解除）
   */
  @RequireLogin
  setParent(parentFullname: string | null): WikidotResultAsync<void> {
    const idCheck = this.requireId('setting parent');
    if (!idCheck.ok) return idCheck.error;

    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            action: 'WikiPageAction',
            event: 'setParentPage',
            moduleName: 'Empty',
            pageId: String(this._id),
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
   * ページに投票する
   * @param value - 投票値
   * @returns 新しいレーティング
   */
  @RequireLogin
  vote(value: number): WikidotResultAsync<number> {
    const idCheck = this.requireId('voting');
    if (!idCheck.ok) return idCheck.error;

    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            action: 'RateAction',
            event: 'ratePage',
            moduleName: 'Empty',
            pageId: this._id,
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
   * 投票をキャンセルする
   * @returns 新しいレーティング
   */
  @RequireLogin
  cancelVote(): WikidotResultAsync<number> {
    const idCheck = this.requireId('canceling vote');
    if (!idCheck.ok) return idCheck.error;

    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            action: 'RateAction',
            event: 'cancelVote',
            moduleName: 'Empty',
            pageId: this._id,
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
   * ページを編集する
   * @param options - 編集オプション
   */
  @RequireLogin
  edit(options: {
    title?: string;
    source?: string;
    comment?: string;
    forceEdit?: boolean;
  }): WikidotResultAsync<void> {
    const idCheck = this.requireId('editing');
    if (!idCheck.ok) return idCheck.error;

    const pageId = idCheck.id;

    return fromPromise(
      (async () => {
        // 現在のソースを取得（指定がない場合）
        let currentSource = options.source;
        if (currentSource === undefined) {
          const existingSource = this._source;
          if (existingSource !== null) {
            currentSource = existingSource.wikiText;
          } else {
            // ソースを取得
            const sourceResult = await PageCollection.acquirePageSources(this.site, [this]);
            if (sourceResult.isErr()) {
              throw sourceResult.error;
            }
            // acquirePageSources後、this._sourceにセットされる
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
   * ページ名を変更する
   * @param newFullname - 新しいフルネーム
   */
  @RequireLogin
  rename(newFullname: string): WikidotResultAsync<void> {
    const idCheck = this.requireId('renaming');
    if (!idCheck.ok) return idCheck.error;

    return fromPromise(
      (async () => {
        const result = await this.site.amcRequest([
          {
            action: 'WikiPageAction',
            event: 'renamePage',
            moduleName: 'Empty',
            page_id: this._id,
            new_name: newFullname,
          },
        ]);
        if (result.isErr()) {
          throw result.error;
        }
        // プロパティを更新（readonlyなのでObject.assignで）
        Object.assign(this, {
          fullname: newFullname,
          category: newFullname.includes(':') ? newFullname.split(':')[0] : '_default',
          name: newFullname.includes(':') ? newFullname.split(':')[1] : newFullname,
        });
      })(),
      (error) => new UnexpectedError(`Failed to rename page: ${String(error)}`)
    );
  }

  /**
   * ページに添付されたファイル一覧を取得する
   */
  getFiles(): WikidotResultAsync<PageFileCollection> {
    return PageFileCollection.acquire(this);
  }

  /**
   * ページのディスカッションスレッドを取得する
   */
  getDiscussion(): WikidotResultAsync<import('../forum').ForumThread | null> {
    const idCheck = this.requireId('getting discussion');
    if (!idCheck.ok) return idCheck.error;

    const pageId = idCheck.id;

    return fromPromise(
      (async () => {
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

        const html = String(response.body ?? '');
        // スレッドIDを抽出
        const match = html.match(
          /WIKIDOT\.modules\.ForumViewThreadModule\.vars\.threadId\s*=\s*(\d+)/
        );
        if (!match?.[1]) {
          return null;
        }

        const threadId = Number.parseInt(match[1], 10);

        // ForumThreadを取得
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
   * ページのメタタグ一覧を取得する
   * @returns メタタグコレクション
   */
  getMetas(): WikidotResultAsync<PageMetaCollection> {
    const idCheck = this.requireId('getting metas');
    if (!idCheck.ok) {
      return idCheck.error;
    }

    return PageMetaCollection.acquire(this);
  }

  /**
   * メタタグを設定する
   * @param name - メタタグ名
   * @param content - メタタグの値
   */
  setMeta(name: string, content: string): WikidotResultAsync<void> {
    const idCheck = this.requireId('setting meta');
    if (!idCheck.ok) {
      return idCheck.error;
    }

    return PageMetaCollection.setMeta(this, name, content);
  }

  /**
   * メタタグを削除する
   * @param name - メタタグ名
   */
  deleteMeta(name: string): WikidotResultAsync<void> {
    const idCheck = this.requireId('deleting meta');
    if (!idCheck.ok) {
      return idCheck.error;
    }

    return PageMetaCollection.deleteMeta(this, name);
  }

  toString(): string {
    return `Page(fullname=${this.fullname}, title=${this.title})`;
  }
}

/**
 * ページコレクション
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
   * フルネームで検索
   * @param fullname - ページのフルネーム
   * @returns ページ（存在しない場合はundefined）
   */
  findByFullname(fullname: string): Page | undefined {
    return this.find((page) => page.fullname === fullname);
  }

  /**
   * ページIDを一括取得
   */
  getPageIds(): WikidotResultAsync<PageCollection> {
    return PageCollection.acquirePageIds(this.site, this);
  }

  /**
   * ページソースを一括取得
   */
  getPageSources(): WikidotResultAsync<PageCollection> {
    return PageCollection.acquirePageSources(this.site, this);
  }

  /**
   * ページリビジョンを一括取得
   */
  getPageRevisions(): WikidotResultAsync<PageCollection> {
    return PageCollection.acquirePageRevisions(this.site, this);
  }

  /**
   * ページ投票を一括取得
   */
  getPageVotes(): WikidotResultAsync<PageCollection> {
    return PageCollection.acquirePageVotes(this.site, this);
  }

  /**
   * ページIDを一括取得する内部メソッド
   */
  static acquirePageIds(site: Site, pages: Page[]): WikidotResultAsync<PageCollection> {
    return fromPromise(
      (async () => {
        const targetPages = pages.filter((page) => !page.isIdAcquired());

        if (targetPages.length === 0) {
          return new PageCollection(site, pages);
        }

        // norender, noredirectでアクセス
        const responses = await Promise.all(
          targetPages.map(async (page) => {
            const url = `${page.getUrl()}/norender/true/noredirect/true`;
            const response = await fetch(url, {
              headers: site.client.amcClient.header.getHeaders(),
            });
            return { page, response };
          })
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
   * ページソースを一括取得する内部メソッド
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
          const body = String(response.body ?? '').replace(/&nbsp;/g, ' ');
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
   * ページリビジョンを一括取得する内部メソッド
   */
  static acquirePageRevisions(site: Site, pages: Page[]): WikidotResultAsync<PageCollection> {
    return fromPromise(
      (async () => {
        const targetPages = pages.filter((page) => page.revisions === null && page.id !== null);

        if (targetPages.length === 0) {
          return new PageCollection(site, pages);
        }

        const result = await site.amcRequest(
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

        // リビジョンをパース
        const { PageRevision } = await import('./page-revision');
        for (let i = 0; i < targetPages.length; i++) {
          const page = targetPages[i];
          const response = result.value[i];
          if (!page || !response) continue;

          const body = String(response.body ?? '');
          const $ = cheerio.load(body);
          const revisions: PageRevision[] = [];

          $('table.page-history > tr[id^=revision-row-]').each((_j, revElement) => {
            const $rev = $(revElement);
            const revIdAttr = $rev.attr('id');
            if (!revIdAttr) return;

            const revId = Number.parseInt(revIdAttr.replace('revision-row-', ''), 10);
            if (Number.isNaN(revId)) return;

            const $tds = $rev.find('td');
            if ($tds.length < 7) return;

            const revNoText = $tds.eq(0).text().trim().replace(/\.$/, '');
            const revNo = Number.parseInt(revNoText, 10);
            if (Number.isNaN(revNo)) return;

            const $createdByElem = $tds.eq(4).find('span.printuser');
            if ($createdByElem.length === 0) return;
            const createdBy = parseUser(site.client, $createdByElem as Cheerio<AnyNode>);

            const $createdAtElem = $tds.eq(5).find('span.odate');
            if ($createdAtElem.length === 0) return;
            const createdAt = parseOdate($createdAtElem as Cheerio<AnyNode>) ?? new Date();

            const comment = $tds.eq(6).text().trim();

            revisions.push(
              new PageRevision({
                page,
                id: revId,
                revNo,
                createdBy,
                createdAt,
                comment,
              })
            );
          });

          page.revisions = new PageRevisionCollection(page, revisions);
        }

        return new PageCollection(site, pages);
      })(),
      (error) => new UnexpectedError(`Failed to acquire page revisions: ${String(error)}`)
    );
  }

  /**
   * ページ投票を一括取得する内部メソッド
   */
  static acquirePageVotes(site: Site, pages: Page[]): WikidotResultAsync<PageCollection> {
    return fromPromise(
      (async () => {
        const targetPages = pages.filter((page) => page.votes === null && page.id !== null);

        if (targetPages.length === 0) {
          return new PageCollection(site, pages);
        }

        const result = await site.amcRequest(
          targetPages.map((page) => ({
            moduleName: 'pagerate/WhoRatedPageModule',
            pageId: page.id,
          }))
        );

        if (result.isErr()) {
          throw result.error;
        }

        // 投票をパース
        for (let i = 0; i < targetPages.length; i++) {
          const page = targetPages[i];
          const response = result.value[i];
          if (!page || !response) continue;

          const body = String(response.body ?? '');
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
   * ListPagesModuleレスポンスをパース
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

      // 5つ星レーティング判定
      const is5StarRating = $page.find('span.rating span.page-rate-list-pages-start').length > 0;

      // 各値を取得
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

        // キー変換
        if (key.includes('_linked')) {
          key = key.replace('_linked', '');
        } else if (['comments', 'children', 'revisions'].includes(key)) {
          key = `${key}_count`;
        } else if (key === 'rating_votes') {
          key = 'votes_count';
        }

        pageParams[key] = value;
      });

      // タグ統合
      const tags = Array.isArray(pageParams.tags) ? pageParams.tags : [];
      const hiddenTags = Array.isArray(pageParams._tags) ? pageParams._tags : [];
      pageParams.tags = [...tags, ...hiddenTags];

      // Zodスキーマで検証・デフォルト値適用
      const parsed = pageParamsSchema.parse(pageParams);

      // Pageオブジェクト作成
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
   * ページ検索
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

        // モジュールボディ生成
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
        const body = String(firstResponse?.body ?? '');
        const $first = cheerio.load(body);

        let total = 1;
        const htmlBodies: cheerio.CheerioAPI[] = [$first];

        // ページネーション確認
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

        // 追加ページ取得
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
            const respBody = String(response?.body ?? '');
            htmlBodies.push(cheerio.load(respBody));
          }
        }

        // パース
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
   * ページを作成または編集
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

    return fromPromise(
      (async () => {
        const {
          pageId = null,
          title = '',
          source = '',
          comment = '',
          forceEdit = false,
          raiseOnExists = false,
        } = options;

        // ページロック取得
        const lockRequestBody: AMCRequestBody = {
          mode: 'page',
          wiki_page: fullname,
          moduleName: 'edit/PageEditModule',
        };
        if (forceEdit) {
          lockRequestBody.force_lock = 'yes';
        }

        const lockResult = await site.amcRequest([lockRequestBody]);
        if (lockResult.isErr()) {
          throw lockResult.error;
        }

        const lockResponse = lockResult.value[0];
        if (lockResponse?.locked || lockResponse?.other_locks) {
          throw new UnexpectedError(`Page ${fullname} is locked or other locks exist`);
        }

        const isExist = 'page_revision_id' in (lockResponse ?? {});

        if (raiseOnExists && isExist) {
          throw new TargetExistsError(`Page ${fullname} already exists`);
        }

        if (isExist && pageId === null) {
          throw new UnexpectedError('page_id must be specified when editing existing page');
        }

        const lockId = String(lockResponse?.lock_id ?? '');
        const lockSecret = String(lockResponse?.lock_secret ?? '');
        const pageRevisionId = String(lockResponse?.page_revision_id ?? '');

        // ページ保存
        const editRequestBody: AMCRequestBody = {
          action: 'WikiPageAction',
          event: 'savePage',
          moduleName: 'Empty',
          mode: 'page',
          lock_id: lockId,
          lock_secret: lockSecret,
          revision_id: pageRevisionId,
          wiki_page: fullname,
          page_id: pageId ?? '',
          title,
          source,
          comments: comment,
        };

        const editResult = await site.amcRequest([editRequestBody]);
        if (editResult.isErr()) {
          throw editResult.error;
        }
      })(),
      (error) => {
        if (error instanceof TargetExistsError || error instanceof LoginRequiredError) {
          return error;
        }
        return new UnexpectedError(`Failed to create/edit page: ${String(error)}`);
      }
    );
  }
}

export { SearchPagesQuery };
