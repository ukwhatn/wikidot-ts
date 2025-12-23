import type { AbstractUser } from '../user';

/**
 * ページ検索クエリのパラメータ
 */
export interface SearchPagesQueryParams {
  /** ページタイプ（例: 'normal', 'admin'） */
  pagetype?: string;
  /** カテゴリ名 */
  category?: string;
  /** 検索対象タグ（AND条件） */
  tags?: string | string[];
  /** 親ページ名 */
  parent?: string;
  /** リンク先ページ名 */
  linkTo?: string;
  /** 作成日時条件 */
  createdAt?: string;
  /** 更新日時条件 */
  updatedAt?: string;
  /** 作成者 */
  createdBy?: AbstractUser | string;
  /** レーティング条件 */
  rating?: string;
  /** 投票数条件 */
  votes?: string;
  /** ページ名条件 */
  name?: string;
  /** フルネーム（完全一致） */
  fullname?: string;
  /** 範囲指定 */
  range?: string;
  /** ソート順（例: 'created_at desc'） */
  order?: string;
  /** 取得開始位置 */
  offset?: number;
  /** 取得件数制限 */
  limit?: number;
  /** 1ページあたり件数 */
  perPage?: number;
  /** 個別表示 */
  separate?: string;
  /** ラッパー表示 */
  wrapper?: string;
}

/**
 * デフォルトの1ページあたり件数
 */
export const DEFAULT_PER_PAGE = 250;

/**
 * デフォルトのモジュールボディフィールド
 */
export const DEFAULT_MODULE_BODY = [
  'fullname',
  'category',
  'name',
  'title',
  'created_at',
  'created_by_linked',
  'updated_at',
  'updated_by_linked',
  'commented_at',
  'commented_by_linked',
  'parent_fullname',
  'comments',
  'size',
  'children',
  'rating_votes',
  'rating',
  'rating_percent',
  'revisions',
  'tags',
  '_tags',
] as const;

/**
 * ページ検索クエリ
 */
export class SearchPagesQuery {
  /** ページタイプ */
  pagetype: string;
  /** カテゴリ */
  category: string;
  /** タグ */
  tags: string | string[] | null;
  /** 親ページ */
  parent: string | null;
  /** リンク先 */
  linkTo: string | null;
  /** 作成日時条件 */
  createdAt: string | null;
  /** 更新日時条件 */
  updatedAt: string | null;
  /** 作成者 */
  createdBy: AbstractUser | string | null;
  /** レーティング条件 */
  rating: string | null;
  /** 投票数条件 */
  votes: string | null;
  /** ページ名条件 */
  name: string | null;
  /** フルネーム条件 */
  fullname: string | null;
  /** 範囲 */
  range: string | null;
  /** ソート順 */
  order: string;
  /** オフセット */
  offset: number;
  /** 取得件数制限 */
  limit: number | null;
  /** 1ページあたり件数 */
  perPage: number;
  /** 個別表示 */
  separate: string;
  /** ラッパー表示 */
  wrapper: string;

  constructor(params: SearchPagesQueryParams = {}) {
    this.pagetype = params.pagetype ?? '*';
    this.category = params.category ?? '*';
    this.tags = params.tags ?? null;
    this.parent = params.parent ?? null;
    this.linkTo = params.linkTo ?? null;
    this.createdAt = params.createdAt ?? null;
    this.updatedAt = params.updatedAt ?? null;
    this.createdBy = params.createdBy ?? null;
    this.rating = params.rating ?? null;
    this.votes = params.votes ?? null;
    this.name = params.name ?? null;
    this.fullname = params.fullname ?? null;
    this.range = params.range ?? null;
    this.order = params.order ?? 'created_at desc';
    this.offset = params.offset ?? 0;
    this.limit = params.limit ?? null;
    this.perPage = params.perPage ?? DEFAULT_PER_PAGE;
    this.separate = params.separate ?? 'no';
    this.wrapper = params.wrapper ?? 'no';
  }

  /**
   * 辞書形式に変換
   */
  asDict(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (this.pagetype !== '*') result.pagetype = this.pagetype;
    if (this.category !== '*') result.category = this.category;
    if (this.tags !== null) {
      result.tags = Array.isArray(this.tags) ? this.tags.join(' ') : this.tags;
    }
    if (this.parent !== null) result.parent = this.parent;
    if (this.linkTo !== null) result.link_to = this.linkTo;
    if (this.createdAt !== null) result.created_at = this.createdAt;
    if (this.updatedAt !== null) result.updated_at = this.updatedAt;
    if (this.createdBy !== null) {
      result.created_by = typeof this.createdBy === 'string' ? this.createdBy : this.createdBy.name;
    }
    if (this.rating !== null) result.rating = this.rating;
    if (this.votes !== null) result.votes = this.votes;
    if (this.name !== null) result.name = this.name;
    if (this.fullname !== null) result.fullname = this.fullname;
    if (this.range !== null) result.range = this.range;

    result.order = this.order;
    result.offset = this.offset;
    if (this.limit !== null) result.limit = this.limit;
    result.perPage = this.perPage;
    result.separate = this.separate;
    result.wrapper = this.wrapper;

    return result;
  }
}
