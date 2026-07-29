/**
 * PageCollection.createOrEdit edit-lock release unit tests (T0-7)
 *
 * `edit/PageEditModule` locks the target page for up to 15 minutes. Every error path
 * taken after the lock is acquired must release it via WikiPageAction/removePageEditLock,
 * or the page stays locked until the lock naturally expires.
 */
import { describe, expect, test } from 'bun:test';
import { errAsync, okAsync } from 'neverthrow';
import { TargetExistsError, UnexpectedError, WikidotStatusError } from '../../../src/common/errors';
import type { AMCRequestBody, AMCResponse } from '../../../src/connector';
import { PageCollection } from '../../../src/module/page/page';
import type { Site } from '../../../src/module/site';
import { amcFixtures } from '../../fixtures/loader';
import { TEST_SITE_DATA } from '../../setup';

type AmcRequestHandler = (bodies: AMCRequestBody[]) => ReturnType<Site['amcRequest']>;

/**
 * Build a mock Site whose amcRequest() delegates to a caller-supplied handler and
 * records every request body sent (one entry per amcRequest() call).
 */
function createMockSite(handler: AmcRequestHandler): { site: Site; calls: AMCRequestBody[][] } {
  const calls: AMCRequestBody[][] = [];

  const site = {
    id: TEST_SITE_DATA.id,
    unixName: TEST_SITE_DATA.unixName,
    domain: TEST_SITE_DATA.domain,
    sslSupported: TEST_SITE_DATA.sslSupported,
    client: {
      requireLogin: () => ({ isErr: () => false }),
    },
    amcRequest: (bodies: AMCRequestBody[]) => {
      calls.push(bodies);
      return handler(bodies);
    },
  } as unknown as Site;

  return { site, calls };
}

/**
 * Build a handler that returns one canned response per call, in order.
 */
function queuedResponses(responses: AMCResponse[]): AmcRequestHandler {
  let callIndex = 0;
  return () => {
    const response = responses[callIndex];
    callIndex++;
    if (!response) {
      return errAsync(new UnexpectedError('No more mock responses queued'));
    }
    return okAsync([response]);
  };
}

describe('PageCollection.createOrEdit lock release (T0-7)', () => {
  test('releases the lock when raiseOnExists rejects an existing page', async () => {
    const lockResponse = amcFixtures.page.pageeditExisting() as AMCResponse;
    const releaseResponse: AMCResponse = { status: 'ok' };
    const { site, calls } = createMockSite(queuedResponses([lockResponse, releaseResponse]));

    const result = await PageCollection.createOrEdit(site, 'test-page', {
      pageId: 12345,
      title: 'New Title',
      raiseOnExists: true,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(TargetExistsError);
    }

    // First call acquires the lock, second call must be the release.
    expect(calls.length).toBe(2);
    const releaseCall = calls[1]?.[0];
    expect(releaseCall?.action).toBe('WikiPageAction');
    expect(releaseCall?.event).toBe('removePageEditLock');
    expect(releaseCall?.lock_id).toBe('abc123');
    expect(releaseCall?.lock_secret).toBe('secret456');
    expect(releaseCall?.wiki_page).toBe('test-page');
    expect(releaseCall?.page_id).toBe(12345);
  });

  test('releases the lock when editing an existing page without pageId', async () => {
    const lockResponse = amcFixtures.page.pageeditExisting() as AMCResponse;
    const releaseResponse: AMCResponse = { status: 'ok' };
    const { site, calls } = createMockSite(queuedResponses([lockResponse, releaseResponse]));

    const result = await PageCollection.createOrEdit(site, 'test-page', {
      // pageId intentionally omitted while the page already exists.
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(UnexpectedError);
    }
    expect(calls.length).toBe(2);
    expect(calls[1]?.[0]?.event).toBe('removePageEditLock');
  });

  test('releases the lock when the savePage request itself fails', async () => {
    const lockResponse = amcFixtures.page.pageeditSuccess() as AMCResponse;
    const releaseResponse: AMCResponse = { status: 'ok' };
    let callIndex = 0;
    const { site, calls } = createMockSite(() => {
      callIndex++;
      if (callIndex === 1) {
        return okAsync([lockResponse]);
      }
      if (callIndex === 2) {
        return errAsync(new WikidotStatusError('save failed', 'not_ok'));
      }
      return okAsync([releaseResponse]);
    });

    const result = await PageCollection.createOrEdit(site, 'new-page', {
      title: 'New Page',
      source: 'content',
    });

    expect(result.isErr()).toBe(true);
    expect(calls.length).toBe(3);
    expect(calls[1]?.[0]?.event).toBe('savePage');
    expect(calls[2]?.[0]?.event).toBe('removePageEditLock');
  });

  test('does not release the lock when the page is already locked by another user', async () => {
    const lockedResponse = amcFixtures.page.pageeditLocked() as AMCResponse;
    const { site, calls } = createMockSite(queuedResponses([lockedResponse]));

    const result = await PageCollection.createOrEdit(site, 'test-page', {});

    expect(result.isErr()).toBe(true);
    // Only the initial lock-acquisition attempt was made - we never held a lock to release.
    expect(calls.length).toBe(1);
  });

  test('does not release the lock on a successful create/edit', async () => {
    const lockResponse = amcFixtures.page.pageeditSuccess() as AMCResponse;
    const saveResponse = amcFixtures.page.savepageSuccess() as AMCResponse;
    const { site, calls } = createMockSite(queuedResponses([lockResponse, saveResponse]));

    const result = await PageCollection.createOrEdit(site, 'new-page', {
      title: 'New Page',
      source: 'content',
    });

    expect(result.isOk()).toBe(true);
    // Lock acquisition + savePage only - no removePageEditLock call.
    expect(calls.length).toBe(2);
    expect(calls[1]?.[0]?.event).toBe('savePage');
  });
});
