/**
 * Common interface definitions to avoid circular dependencies
 */

import type { WikidotResultAsync } from '../common/types';
import type { AMCRequestBody, AMCResponse } from '../connector';

/**
 * Client reference interface
 * Used to avoid direct dependency on Client type
 */
export interface ClientRef {
  /**
   * Call before operations that require login
   * @returns Error if not logged in
   */
  requireLogin(): { isErr(): boolean; error?: Error };

  /**
   * Whether logged in
   */
  isLoggedIn(): boolean;
}

/**
 * Minimal AMCHeader interface
 */
export interface AMCHeaderRef {
  getHeaders(): Record<string, string>;
  setCookie(name: string, value: string): void;
  deleteCookie(name: string): void;
}

/**
 * Minimal AMCClient interface
 */
export interface AMCClientRef {
  header: AMCHeaderRef;
  request(bodies: AMCRequestBody[]): WikidotResultAsync<AMCResponse[]>;
}

/**
 * Client context required for authentication
 * Used to avoid auth.ts directly depending on client.ts
 */
export interface AuthClientContext {
  amcClient: AMCClientRef;
}

/**
 * Site reference interface
 * Used to avoid direct dependency on Site type
 */
export interface SiteRef {
  /**
   * Site ID
   */
  readonly id: number;

  /**
   * UNIX name (e.g., scp-jp)
   */
  readonly unixName: string;

  /**
   * Domain
   */
  readonly domain: string;

  /**
   * SSL support flag
   */
  readonly sslSupported: boolean;

  /**
   * Client reference
   */
  readonly client: ClientRef;

  /**
   * Execute AMC request
   */
  amcRequest(bodies: AMCRequestBody[]): WikidotResultAsync<AMCResponse[]>;

  /**
   * Execute single AMC request
   */
  amcRequestSingle(body: AMCRequestBody): WikidotResultAsync<AMCResponse>;
}

/**
 * Forum category reference interface
 */
export interface ForumCategoryRef {
  /**
   * Category ID
   */
  readonly id: number;

  /**
   * Category title
   */
  readonly title: string;

  /**
   * Site reference
   */
  readonly site: SiteRef;
}

/**
 * Forum thread reference interface
 * Used to avoid direct dependency on ForumThread type
 */
export interface ForumThreadRef {
  /**
   * Thread ID
   */
  readonly id: number;

  /**
   * Thread title
   */
  readonly title: string;

  /**
   * Site reference
   */
  readonly site: SiteRef;

  /**
   * Category reference (if exists)
   */
  readonly category?: ForumCategoryRef | null;
}

/**
 * Forum post reference interface
 * Used to avoid direct dependency on ForumPost type
 */
export interface ForumPostRef {
  /**
   * Post ID
   */
  readonly id: number;

  /**
   * Post title
   */
  readonly title: string;

  /**
   * Thread reference
   */
  readonly thread: ForumThreadRef;
}

/**
 * Page reference interface
 * Used to avoid direct dependency on Page type
 */
export interface PageRef {
  /**
   * Page ID (set after retrieval)
   */
  readonly id: number | null;

  /**
   * Fullname (category:name format)
   */
  readonly fullname: string;

  /**
   * Page name
   */
  readonly name: string;

  /**
   * Category
   */
  readonly category: string;

  /**
   * Site reference
   */
  readonly site: SiteRef;
}
