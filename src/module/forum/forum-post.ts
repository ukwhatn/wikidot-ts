import * as cheerio from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import { RequireLogin } from '../../common/decorators';
import { LoginRequiredError, NoElementError, UnexpectedError } from '../../common/errors';
import { type WikidotResultAsync, fromPromise } from '../../common/types';
import { parseOdate, parseUser } from '../../util/parser';
import type { Client } from '../client';
import type { ForumThreadRef } from '../types';
import type { AbstractUser } from '../user';

/**
 * フォーラム投稿データ
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
 * フォーラム投稿
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
  private _source: string | null = null;

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
   * 親投稿ID
   */
  get parentId(): number | null {
    return this._parentId;
  }

  /**
   * ソースコード（Wikidot記法）を取得
   */
  getSource(): WikidotResultAsync<string> {
    if (this._source !== null) {
      return fromPromise(Promise.resolve(this._source), (e) => new UnexpectedError(String(e)));
    }

    return fromPromise(
      (async () => {
        const result = await this.thread.site.amcRequest([
          {
            moduleName: 'forum/sub/ForumEditPostFormModule',
            threadId: this.thread.id,
            postId: this.id,
          },
        ]);

        if (result.isErr()) {
          throw result.error;
        }

        const response = result.value[0];
        if (!response) {
          throw new NoElementError('Empty response');
        }

        const $ = cheerio.load(String(response.body ?? ''));
        const sourceElem = $("textarea[name='source']");
        if (sourceElem.length === 0) {
          throw new NoElementError('Source textarea not found');
        }
        this._source = sourceElem.text();
        return this._source;
      })(),
      (error) => {
        if (error instanceof NoElementError) return error;
        return new UnexpectedError(`Failed to get post source: ${String(error)}`);
      }
    );
  }

  /**
   * 投稿を編集する
   * @param source - 新しいソース（Wikidot記法）
   * @param title - 新しいタイトル（省略時は現在のタイトルを維持）
   */
  @RequireLogin
  edit(source: string, title?: string): WikidotResultAsync<void> {
    return fromPromise(
      (async () => {
        // 現在のリビジョンIDを取得
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

        // 編集を保存
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

        // ローカル状態を更新
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

  toString(): string {
    return `ForumPost(id=${this.id}, title=${this.title})`;
  }
}

/**
 * フォーラム投稿コレクション
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
   * IDで検索
   * @param id - 投稿ID
   * @returns 投稿（存在しない場合はundefined）
   */
  findById(id: number): ForumPost | undefined {
    return this.find((post) => post.id === id);
  }

  /**
   * HTMLから投稿をパースする（内部メソッド）
   */
  private static _parse(thread: ForumThreadRef, $: CheerioAPI): ForumPost[] {
    const posts: ForumPost[] = [];

    $('div.post').each((_i, postElem) => {
      const $post = $(postElem);
      const postIdAttr = $post.attr('id');
      if (!postIdAttr) return;

      const postId = Number.parseInt(postIdAttr.replace('post-', ''), 10);
      if (Number.isNaN(postId)) return;

      // 親投稿IDの取得
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

      // タイトルと本文の取得
      const $wrapper = $post.find('div.long');
      if ($wrapper.length === 0) return;

      const $head = $wrapper.find('div.head');
      if ($head.length === 0) return;

      const $title = $head.find('div.title');
      const title = $title.text().trim();

      const $content = $wrapper.find('div.content');
      const text = $content.html() ?? '';

      // 投稿者と日時
      const $info = $head.find('div.info');
      if ($info.length === 0) return;

      const $userElem = $info.find('span.printuser');
      if ($userElem.length === 0) return;

      const createdBy = parseUser(thread.site.client as Client, $userElem as Cheerio<AnyNode>);

      const $odateElem = $info.find('span.odate');
      if ($odateElem.length === 0) return;

      const createdAt = parseOdate($odateElem as Cheerio<AnyNode>) ?? new Date();

      // 編集情報（存在する場合）
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
   * スレッド内の全投稿を取得
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

        // ページネーション確認
        const $pager = $first('div.pager');
        if ($pager.length === 0) {
          return new ForumPostCollection(thread, posts);
        }

        const $pagerTargets = $pager.find('span.target');
        if ($pagerTargets.length < 2) {
          return new ForumPostCollection(thread, posts);
        }

        // 最後から2番目のページリンクから最終ページ番号を取得
        const lastPageText = $pagerTargets
          .eq($pagerTargets.length - 2)
          .text()
          .trim();
        const lastPage = Number.parseInt(lastPageText, 10);
        if (Number.isNaN(lastPage) || lastPage <= 1) {
          return new ForumPostCollection(thread, posts);
        }

        // 残りのページを取得
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
}
