/**
 * Forum post revision integration tests
 */
import { describe, expect, test } from 'bun:test';
import { getSite } from './helpers/client';
import { shouldSkipIntegration } from './setup';

describe.skipIf(shouldSkipIntegration())('Forum Post Revision Integration Tests', () => {
  test('1. Get revisions from edited post', async () => {
    const site = await getSite();
    const categoriesResult = await site.forum.getCategories();
    expect(categoriesResult.isOk()).toBe(true);

    const categories = categoriesResult.value!;
    if (categories.length === 0) {
      console.log('No forum categories found, skipping test');
      return;
    }

    // Find a category with threads
    for (const category of categories) {
      const threadsResult = await category.getThreads();
      if (threadsResult.isErr()) continue;

      const threads = threadsResult.value;
      if (threads.length === 0) continue;

      // Find a thread with posts
      for (const thread of threads) {
        const postsResult = await thread.getPosts();
        if (postsResult.isErr()) continue;

        const posts = postsResult.value;
        // Find an edited post
        const editedPost = posts.find((p) => p.hasRevisions);

        if (editedPost) {
          const revisionsResult = await editedPost.getRevisions();
          expect(revisionsResult.isOk()).toBe(true);

          const revisions = revisionsResult.value!;
          expect(revisions.length).toBeGreaterThan(1);
          expect(revisions[0].revNo).toBe(0);
          expect(revisions[revisions.length - 1].revNo).toBe(revisions.length - 1);

          // Verify revision properties
          for (const revision of revisions) {
            expect(revision.id).toBeDefined();
            expect(revision.revNo).toBeGreaterThanOrEqual(0);
            expect(revision.createdBy).toBeDefined();
            expect(revision.createdAt).toBeInstanceOf(Date);
          }

          return; // Test passed
        }
      }
    }

    console.log('No edited posts found in forum, skipping test');
  });

  test('2. Get revisions from unedited post', async () => {
    const site = await getSite();
    const categoriesResult = await site.forum.getCategories();
    expect(categoriesResult.isOk()).toBe(true);

    const categories = categoriesResult.value!;
    if (categories.length === 0) {
      console.log('No forum categories found, skipping test');
      return;
    }

    // Find a category with threads
    for (const category of categories) {
      const threadsResult = await category.getThreads();
      if (threadsResult.isErr()) continue;

      const threads = threadsResult.value;
      if (threads.length === 0) continue;

      // Find a thread with posts
      for (const thread of threads) {
        const postsResult = await thread.getPosts();
        if (postsResult.isErr()) continue;

        const posts = postsResult.value;
        // Find an unedited post
        const uneditedPost = posts.find((p) => !p.hasRevisions);

        if (uneditedPost) {
          const revisionsResult = await uneditedPost.getRevisions();
          expect(revisionsResult.isOk()).toBe(true);

          const revisions = revisionsResult.value!;
          expect(revisions.length).toBe(1);
          expect(revisions[0].revNo).toBe(0);

          return; // Test passed
        }
      }
    }

    console.log('No unedited posts found in forum, skipping test');
  });

  test('3. Get revision HTML content', async () => {
    const site = await getSite();
    const categoriesResult = await site.forum.getCategories();
    expect(categoriesResult.isOk()).toBe(true);

    const categories = categoriesResult.value!;
    if (categories.length === 0) {
      console.log('No forum categories found, skipping test');
      return;
    }

    // Find a category with threads
    for (const category of categories) {
      const threadsResult = await category.getThreads();
      if (threadsResult.isErr()) continue;

      const threads = threadsResult.value;
      if (threads.length === 0) continue;

      // Find a thread with posts
      for (const thread of threads) {
        const postsResult = await thread.getPosts();
        if (postsResult.isErr()) continue;

        const posts = postsResult.value;
        if (posts.length === 0) continue;

        const post = posts[0];
        const revisionsResult = await post.getRevisions();
        if (revisionsResult.isErr()) continue;

        const revisions = revisionsResult.value;
        if (revisions.length === 0) continue;

        // Get HTML for first revision
        const htmlResult = await revisions[0].getHtml();
        expect(htmlResult.isOk()).toBe(true);

        const html = htmlResult.value;
        expect(typeof html).toBe('string');
        expect(html.length).toBeGreaterThan(0);

        return; // Test passed
      }
    }

    console.log('No posts found in forum, skipping test');
  });

  test('4. Verify revision collection methods', async () => {
    const site = await getSite();
    const categoriesResult = await site.forum.getCategories();
    expect(categoriesResult.isOk()).toBe(true);

    const categories = categoriesResult.value!;
    if (categories.length === 0) {
      console.log('No forum categories found, skipping test');
      return;
    }

    // Find a category with threads
    for (const category of categories) {
      const threadsResult = await category.getThreads();
      if (threadsResult.isErr()) continue;

      const threads = threadsResult.value;
      if (threads.length === 0) continue;

      // Find a thread with posts
      for (const thread of threads) {
        const postsResult = await thread.getPosts();
        if (postsResult.isErr()) continue;

        const posts = postsResult.value;
        // Find a post with multiple revisions
        const editedPost = posts.find((p) => p.hasRevisions);

        if (editedPost) {
          const revisionsResult = await editedPost.getRevisions();
          expect(revisionsResult.isOk()).toBe(true);

          const revisions = revisionsResult.value!;
          if (revisions.length < 2) continue;

          // Test findById
          const firstRevision = revisions[0];
          const found = revisions.findById(firstRevision.id);
          expect(found).toBeDefined();
          expect(found?.id).toBe(firstRevision.id);

          // Test findByRevNo
          const foundByRevNo = revisions.findByRevNo(0);
          expect(foundByRevNo).toBeDefined();
          expect(foundByRevNo?.revNo).toBe(0);

          return; // Test passed
        }
      }
    }

    console.log('No edited posts found in forum, skipping test');
  });
});
