import type { AbstractUser } from '../user';

/**
 * Page search query parameters
 */
export interface SearchPagesQueryParams {
  /** Page type (e.g., 'normal', 'admin') */
  pagetype?: string;
  /** Category name */
  category?: string;
  /** Tags to search (AND condition) */
  tags?: string | string[];
  /** Parent page name */
  parent?: string;
  /** Linked page name */
  linkTo?: string;
  /** Created date condition */
  createdAt?: string;
  /** Updated date condition */
  updatedAt?: string;
  /** Creator */
  createdBy?: AbstractUser | string;
  /** Rating condition */
  rating?: string;
  /** Vote count condition */
  votes?: string;
  /** Page name condition */
  name?: string;
  /** Fullname (exact match) */
  fullname?: string;
  /** Range specification */
  range?: string;
  /** Sort order (e.g., 'created_at desc') */
  order?: string;
  /** Start offset */
  offset?: number;
  /** Result limit */
  limit?: number;
  /** Items per page */
  perPage?: number;
  /** Separate display */
  separate?: string;
  /** Wrapper display */
  wrapper?: string;
}

/**
 * Default items per page
 */
export const DEFAULT_PER_PAGE = 250;

/**
 * Default module body fields
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
 * Page search query
 */
export class SearchPagesQuery {
  /** Page type */
  pagetype: string;
  /** Category */
  category: string;
  /** Tags */
  tags: string | string[] | null;
  /** Parent page */
  parent: string | null;
  /** Link target */
  linkTo: string | null;
  /** Created date condition */
  createdAt: string | null;
  /** Updated date condition */
  updatedAt: string | null;
  /** Creator */
  createdBy: AbstractUser | string | null;
  /** Rating condition */
  rating: string | null;
  /** Vote count condition */
  votes: string | null;
  /** Page name condition */
  name: string | null;
  /** Fullname condition */
  fullname: string | null;
  /** Range */
  range: string | null;
  /** Sort order */
  order: string;
  /** Offset */
  offset: number;
  /** Result limit */
  limit: number | null;
  /** Items per page */
  perPage: number;
  /** Separate display */
  separate: string;
  /** Wrapper display */
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
   * Convert to dictionary format
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
