/**
 * Fixture Loader
 *
 * テストフィクスチャを読み込むユーティリティ
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * HTMLフィクスチャを読み込む
 */
export function loadHtmlFixture(filename: string): string {
  const path = join(__dirname, 'html_samples', filename);
  return readFileSync(path, 'utf-8').trim();
}

/**
 * JSONフィクスチャを読み込む
 */
export function loadJsonFixture<T = Record<string, unknown>>(subdir: string, filename: string): T {
  const path = join(__dirname, 'amc_responses', subdir, filename);
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content) as T;
}

// HTMLフィクスチャローダー
export const htmlFixtures = {
  // Printuser
  printuserRegular: () => loadHtmlFixture('printuser_regular.html'),
  printuserDeleted: () => loadHtmlFixture('printuser_deleted.html'),
  printuserDeletedNoId: () => loadHtmlFixture('printuser_deleted_no_id.html'),
  printuserAnonymous: () => loadHtmlFixture('printuser_anonymous.html'),
  printuserAnonymousNoIp: () => loadHtmlFixture('printuser_anonymous_no_ip.html'),
  printuserGuest: () => loadHtmlFixture('printuser_guest.html'),
  printuserWikidot: () => loadHtmlFixture('printuser_wikidot.html'),

  // Odate
  odateNoTime: () => loadHtmlFixture('odate_no_time.html'),
  odateMultipleClasses: () => loadHtmlFixture('odate_multiple_classes.html'),

  // Site
  siteHomepage: () => loadHtmlFixture('site_homepage.html'),

  // User
  userProfile: () => loadHtmlFixture('user_profile.html'),
  userProfileNotFound: () => loadHtmlFixture('user_profile_notfound.html'),
};

// AMCレスポンスフィクスチャローダー
export const amcFixtures = {
  // Page
  page: {
    listpagesSingle: () => loadJsonFixture('page', 'listpages_single.json'),
    listpagesMultiple: () => loadJsonFixture('page', 'listpages_multiple.json'),
    listpagesEmpty: () => loadJsonFixture('page', 'listpages_empty.json'),
    listpagesMissingFields: () => loadJsonFixture('page', 'listpages_missing_fields.json'),
    listpagesInvalid: () => loadJsonFixture('page', 'listpages_invalid.json'),
    listpagesPmRating: () => loadJsonFixture('page', 'listpages_pm_rating.json'),
    viewsource: () => loadJsonFixture('page', 'viewsource.json'),
    revisionlist: () => loadJsonFixture('page', 'revisionlist.json'),
    whorated: () => loadJsonFixture('page', 'whorated.json'),
    pageeditLocked: () => loadJsonFixture('page', 'pageedit_locked.json'),
    pageeditSuccess: () => loadJsonFixture('page', 'pageedit_success.json'),
    pageeditExisting: () => loadJsonFixture('page', 'pageedit_existing.json'),
    savepageSuccess: () => loadJsonFixture('page', 'savepage_success.json'),
    savetagsSuccess: () => loadJsonFixture('page', 'savetags_success.json'),
    setparentSuccess: () => loadJsonFixture('page', 'setparent_success.json'),
    renameSuccess: () => loadJsonFixture('page', 'rename_success.json'),
    deleteSuccess: () => loadJsonFixture('page', 'delete_success.json'),
    ratepageSuccess: () => loadJsonFixture('page', 'ratepage_success.json'),
    ratepagePmSuccess: () => loadJsonFixture('page', 'ratepage_pm_success.json'),
    cancelvoteSuccess: () => loadJsonFixture('page', 'cancelvote_success.json'),
  },

  // Forum
  forum: {
    forumStart: () => loadJsonFixture('forum', 'forum_start.json'),
    forumStartEmpty: () => loadJsonFixture('forum', 'forum_start_empty.json'),
    newthreadSuccess: () => loadJsonFixture('forum', 'newthread_success.json'),
    threadsInCategory: () => loadJsonFixture('forum', 'threads_in_category.json'),
    threadDetail: () => loadJsonFixture('forum', 'thread_detail.json'),
    postsInThread: () => loadJsonFixture('forum', 'posts_in_thread.json'),
    postsNested: () => loadJsonFixture('forum', 'posts_nested.json'),
    editpostForm: () => loadJsonFixture('forum', 'editpost_form.json'),
    savepostSuccess: () => loadJsonFixture('forum', 'savepost_success.json'),
  },

  // QuickModule
  quickmodule: {
    memberLookup: () => loadJsonFixture('quickmodule', 'member_lookup.json'),
    memberLookupEmpty: () => loadJsonFixture('quickmodule', 'member_lookup_empty.json'),
    userLookup: () => loadJsonFixture('quickmodule', 'user_lookup.json'),
    userLookupEmpty: () => loadJsonFixture('quickmodule', 'user_lookup_empty.json'),
    pageLookup: () => loadJsonFixture('quickmodule', 'page_lookup.json'),
    pageLookupEmpty: () => loadJsonFixture('quickmodule', 'page_lookup_empty.json'),
  },

  // Site
  site: {
    inviteMemberSuccess: () => loadJsonFixture('site', 'invite_member_success.json'),
    inviteMemberAlreadyInvited: () => loadJsonFixture('site', 'invite_member_already_invited.json'),
    inviteMemberAlreadyMember: () => loadJsonFixture('site', 'invite_member_already_member.json'),
    siteChanges: () => loadJsonFixture('site', 'site_changes.json'),
    siteChangesEmpty: () => loadJsonFixture('site', 'site_changes_empty.json'),
    applications: () => loadJsonFixture('site', 'applications.json'),
    applicationsEmpty: () => loadJsonFixture('site', 'applications_empty.json'),
  },
};

/**
 * odate HTMLファクトリ
 */
export function createOdateHtml(unixTimestamp: number): string {
  return `<span class="odate time_${unixTimestamp} format_%25e%20%25b%20%25Y%2C%20%25H%3A%25M%7Cagohover" style="cursor: help; display: inline;">17 Dec 2025, 12:00</span>`;
}
