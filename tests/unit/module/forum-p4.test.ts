/**
 * Unit tests for P4 forum additions: ForumThread/ForumPost/ForumCategory
 * individual operations, new-thread preview, and page discussion thread
 * creation.
 */
import { describe, expect, test } from 'bun:test';
import { errAsync, okAsync } from 'neverthrow';
import { LoginRequiredError, UnexpectedError } from '../../../src/common/errors';
import type { AMCRequestBody, AMCResponse } from '../../../src/connector';
import { ForumCategory } from '../../../src/module/forum/forum-category';
import { ForumPost } from '../../../src/module/forum/forum-post';
import { ForumThread } from '../../../src/module/forum/forum-thread';
import type { Site } from '../../../src/module/site';
import {
  TEST_FORUM_CATEGORY_DATA,
  TEST_FORUM_POST_DATA,
  TEST_FORUM_THREAD_DATA,
  TEST_SITE_DATA,
} from '../../setup';

type AmcRequestHandler = (bodies: AMCRequestBody[]) => ReturnType<Site['amcRequest']>;

function createMockSite(options: { loggedIn?: boolean; handler?: AmcRequestHandler } = {}): {
  site: Site;
  calls: AMCRequestBody[][];
} {
  const { loggedIn = true, handler } = options;
  const calls: AMCRequestBody[][] = [];
  const site = {
    id: TEST_SITE_DATA.id,
    unixName: TEST_SITE_DATA.unixName,
    domain: TEST_SITE_DATA.domain,
    sslSupported: TEST_SITE_DATA.sslSupported,
    client: {
      requireLogin: () =>
        loggedIn
          ? { isErr: () => false }
          : { isErr: () => true, error: new LoginRequiredError('Login required') },
    },
    amcRequest: (bodies: AMCRequestBody[]) => {
      calls.push(bodies);
      if (handler) return handler(bodies);
      return okAsync([{ status: 'ok', body: '' }] as AMCResponse[]);
    },
  } as unknown as Site;
  return { site, calls };
}

function makeThread(site: Site): ForumThread {
  const category = new ForumCategory({
    site,
    id: TEST_FORUM_CATEGORY_DATA.id,
    title: TEST_FORUM_CATEGORY_DATA.title,
    description: TEST_FORUM_CATEGORY_DATA.description,
    threadsCount: TEST_FORUM_CATEGORY_DATA.threadsCount,
    postsCount: TEST_FORUM_CATEGORY_DATA.postsCount,
  });
  return new ForumThread({
    site,
    id: TEST_FORUM_THREAD_DATA.id,
    title: TEST_FORUM_THREAD_DATA.title,
    description: TEST_FORUM_THREAD_DATA.description,
    createdBy: null,
    createdAt: new Date(),
    postCount: TEST_FORUM_THREAD_DATA.postCount,
    category,
  });
}

function makePost(thread: ForumThread): ForumPost {
  return new ForumPost({
    thread,
    id: TEST_FORUM_POST_DATA.id,
    title: TEST_FORUM_POST_DATA.title,
    text: TEST_FORUM_POST_DATA.text,
    element: { type: 'tag', name: 'div' } as never,
    createdBy: { id: 1, name: 'tester' } as never,
    createdAt: new Date(),
  });
}

describe('ForumThread.saveMeta', () => {
  test('requires login', async () => {
    const { site } = createMockSite({ loggedIn: false });
    const thread = makeThread(site);
    const result = await thread.saveMeta('New title');
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBeInstanceOf(LoginRequiredError);
  });

  test('omitted fields keep the current value (not blanked)', async () => {
    const { site, calls } = createMockSite();
    const thread = makeThread(site);
    const originalTitle = thread.title;
    const originalDescription = thread.description;

    await thread.saveMeta();

    const body = calls[0]?.[0];
    expect(body?.title).toBe(originalTitle);
    expect(body?.description).toBe(originalDescription);
  });

  test('explicit values are sent and cached locally', async () => {
    const { site, calls } = createMockSite();
    const thread = makeThread(site);

    const result = await thread.saveMeta('New title', 'New description');

    expect(result.isOk()).toBe(true);
    const body = calls[0]?.[0];
    expect(body?.action).toBe('ForumAction');
    expect(body?.event).toBe('saveThreadMeta');
    expect(body?.threadId).toBe(thread.id);
    expect(body?.title).toBe('New title');
    expect(thread.title).toBe('New title');
    expect(thread.description).toBe('New description');
  });
});

describe('ForumThread.setSticky', () => {
  test('true sends the "true" flag', async () => {
    const { site, calls } = createMockSite();
    const thread = makeThread(site);
    await thread.setSticky(true);
    const body = calls[0]?.[0];
    expect(body?.event).toBe('saveSticky');
    expect(body?.sticky).toBe('true');
  });

  test('false omits the key', async () => {
    const { site, calls } = createMockSite();
    const thread = makeThread(site);
    await thread.setSticky(false);
    const body = calls[0]?.[0];
    expect(body).not.toHaveProperty('sticky');
  });
});

describe('ForumThread.setBlock', () => {
  test('true sends the "true" flag', async () => {
    const { site, calls } = createMockSite();
    const thread = makeThread(site);
    await thread.setBlock(true);
    const body = calls[0]?.[0];
    expect(body?.event).toBe('saveBlock');
    expect(body?.block).toBe('true');
  });

  test('false omits the key', async () => {
    const { site, calls } = createMockSite();
    const thread = makeThread(site);
    await thread.setBlock(false);
    const body = calls[0]?.[0];
    expect(body).not.toHaveProperty('block');
  });
});

describe('ForumThread.move', () => {
  test('sends categoryId and updates local state', async () => {
    const { site, calls } = createMockSite();
    const thread = makeThread(site);
    const destination = new ForumCategory({
      site,
      id: 2002,
      title: 'Other category',
      description: '',
      threadsCount: 0,
      postsCount: 0,
    });

    const result = await thread.move(destination);

    expect(result.isOk()).toBe(true);
    const body = calls[0]?.[0];
    expect(body?.event).toBe('moveThread');
    expect(body?.categoryId).toBe(2002);
    expect(thread.category).toBe(destination);
  });
});

describe('ForumThread.watch', () => {
  test('sends WatchAction/watchThread', async () => {
    const { site, calls } = createMockSite();
    const thread = makeThread(site);
    const result = await thread.watch();
    expect(result.isOk()).toBe(true);
    const body = calls[0]?.[0];
    expect(body?.action).toBe('WatchAction');
    expect(body?.event).toBe('watchThread');
    expect(body?.threadId).toBe(thread.id);
  });
});

describe('ForumThread.createForPage', () => {
  test('requires login', async () => {
    const { site } = createMockSite({ loggedIn: false });
    const result = await ForumThread.createForPage(site, 999);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBeInstanceOf(LoginRequiredError);
  });

  test('returns null when threadId is absent (unconfirmed response schema)', async () => {
    const { site } = createMockSite({
      handler: () => okAsync([{ status: 'ok' }] as AMCResponse[]),
    });
    const result = await ForumThread.createForPage(site, 999);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBeNull();
  });

  test('returns the thread when threadId is present', async () => {
    let callCount = 0;
    const { site, calls } = createMockSite({
      handler: (bodies) => {
        callCount++;
        if (callCount === 1) {
          return okAsync([{ status: 'ok', threadId: TEST_FORUM_THREAD_DATA.id }] as AMCResponse[]);
        }
        // second call: ForumThread.getFromId -> forum/ForumViewThreadModule
        expect(bodies[0]?.moduleName).toBe('forum/ForumViewThreadModule');
        return okAsync([
          {
            status: 'ok',
            body: `
              <div class="forum-breadcrumbs">» Test Thread Title</div>
              <div class="description-block"></div>
              <div class="statistics"><span class="printuser">tester</span><span class="odate"></span><br><br><br>5 posts</div>
              <script>WIKIDOT.forumThreadId = ${TEST_FORUM_THREAD_DATA.id};</script>
            `,
          },
        ] as AMCResponse[]);
      },
    });

    const result = await ForumThread.createForPage(site, 999);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value?.id).toBe(TEST_FORUM_THREAD_DATA.id);
    }
    expect(calls[0]?.[0]?.event).toBe('createPageDiscussionThread');
    expect(calls[0]?.[0]?.page_id).toBe(999);
  });
});

describe('ForumPost.delete', () => {
  test('requires confirm=true', () => {
    const { site } = createMockSite();
    const thread = makeThread(site);
    const post = makePost(thread);
    expect(() => post.delete(false)).toThrow();
  });

  test('requires login', async () => {
    const { site } = createMockSite({ loggedIn: false });
    const thread = makeThread(site);
    const post = makePost(thread);
    const result = await post.delete(true);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBeInstanceOf(LoginRequiredError);
  });

  test('sends deletePost with confirm=true', async () => {
    const { site, calls } = createMockSite();
    const thread = makeThread(site);
    const post = makePost(thread);

    const result = await post.delete(true);

    expect(result.isOk()).toBe(true);
    const body = calls[0]?.[0];
    expect(body?.action).toBe('ForumAction');
    expect(body?.event).toBe('deletePost');
    expect(body?.postId).toBe(post.id);
  });
});

describe('ForumCategory.previewThread', () => {
  test('sends new-thread-form fields and returns the rendered body', async () => {
    const { site, calls } = createMockSite({
      handler: () => okAsync([{ status: 'ok', body: '<div>preview</div>' }] as AMCResponse[]),
    });
    const category = new ForumCategory({
      site,
      id: TEST_FORUM_CATEGORY_DATA.id,
      title: TEST_FORUM_CATEGORY_DATA.title,
      description: TEST_FORUM_CATEGORY_DATA.description,
      threadsCount: TEST_FORUM_CATEGORY_DATA.threadsCount,
      postsCount: TEST_FORUM_CATEGORY_DATA.postsCount,
    });

    const result = await category.previewThread(
      'Preview Title',
      'Preview description',
      'Preview source'
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe('<div>preview</div>');
    const body = calls[0]?.[0];
    expect(body?.moduleName).toBe('forum/ForumPreviewPostModule');
    expect(body?.category_id).toBe(TEST_FORUM_CATEGORY_DATA.id);
    expect(body?.title).toBe('Preview Title');
    expect(body?.description).toBe('Preview description');
    expect(body?.source).toBe('Preview source');
  });
});

// Sanity check that neverthrow's errAsync path is usable in this file's helpers too
describe('createMockSite handler contract', () => {
  test('handler can return an error result', async () => {
    const { site } = createMockSite({ handler: () => errAsync(new UnexpectedError('boom')) });
    const thread = makeThread(site);
    const result = await thread.watch();
    expect(result.isErr()).toBe(true);
  });
});
