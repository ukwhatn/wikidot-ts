/**
 * Bun Test Setup
 *
 * テスト全体の共通セットアップを定義
 */

import type { AMCConfig } from '../src/connector/amc-config';

/**
 * テスト用AMC設定（短いタイムアウト）
 */
export const TEST_AMC_CONFIG: AMCConfig = {
  timeout: 5000,
  retryLimit: 2,
  retryInterval: 0,
  backoffFactor: 2,
  maxBackoff: 1000,
  semaphoreLimit: 5,
};

/**
 * テスト用認証情報
 */
export const TEST_CREDENTIALS = {
  username: 'test_user',
  password: 'test_password',
} as const;

/**
 * テスト用サイトデータ
 */
export const TEST_SITE_DATA = {
  id: 123456,
  title: 'Test Site',
  unixName: 'test-site',
  domain: 'test-site.wikidot.com',
  sslSupported: true,
} as const;

/**
 * テスト用ページデータ
 */
export const TEST_PAGE_DATA = {
  fullname: 'test-page',
  name: 'test-page',
  category: '_default',
  title: 'Test Page Title',
  childrenCount: 0,
  commentsCount: 0,
  size: 1000,
  rating: 10,
  votesCount: 5,
  ratingPercent: null,
  revisionsCount: 3,
  parentFullname: null,
  tags: ['tag1', 'tag2'],
} as const;

/**
 * テスト用フォーラムカテゴリデータ
 */
export const TEST_FORUM_CATEGORY_DATA = {
  id: 1001,
  title: 'Test Category',
  description: 'Test category description',
  threadsCount: 10,
  postsCount: 50,
} as const;

/**
 * テスト用フォーラムスレッドデータ
 */
export const TEST_FORUM_THREAD_DATA = {
  id: 3001,
  title: 'Test Thread',
  description: 'Test thread description',
  postCount: 5,
} as const;

/**
 * テスト用フォーラム投稿データ
 */
export const TEST_FORUM_POST_DATA = {
  id: 5001,
  title: 'Test Post Title',
  text: '<p>Test post content</p>',
} as const;
