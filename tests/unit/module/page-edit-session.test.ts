/**
 * PageEditSession / withEditLock unit tests
 */
import { describe, expect, test } from 'bun:test';
import { errAsync, okAsync } from 'neverthrow';
import { ForbiddenError, TargetError, UnexpectedError } from '../../../src/common/errors';
import type { AMCRequestBody, AMCResponse } from '../../../src/connector';
import { PageEditSession, withEditLock } from '../../../src/module/page/page-edit-session';
import type { Site } from '../../../src/module/site';
import { TEST_SITE_DATA } from '../../setup';

type AmcRequestHandler = (bodies: AMCRequestBody[]) => ReturnType<Site['amcRequest']>;

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

describe('PageEditSession.open', () => {
  test('acquires the lock for a new page', async () => {
    const { site } = createMockSite(
      queuedResponses([{ status: 'ok', lock_id: 'L1', lock_secret: 'S1', timeLeft: 900 }])
    );
    const session = new PageEditSession({ site, fullname: 'new-page' });

    const result = await session.open();

    expect(result.isOk()).toBe(true);
    expect(session.lockId).toBe('L1');
    expect(session.lockSecret).toBe('S1');
    expect(session.isExistingPage).toBe(false);
    expect(session.revisionId).toBe('');
  });

  test('acquires the lock for an existing page', async () => {
    const { site } = createMockSite(
      queuedResponses([{ status: 'ok', lock_id: 'L1', lock_secret: 'S1', page_revision_id: 100 }])
    );
    const session = new PageEditSession({ site, fullname: 'existing-page', pageId: 1 });

    await session.open();

    expect(session.isExistingPage).toBe(true);
    expect(session.revisionId).toBe('100');
  });

  test('returns TargetError when the page is locked', async () => {
    const { site } = createMockSite(queuedResponses([{ status: 'ok', locked: true }]));
    const session = new PageEditSession({ site, fullname: 'locked-page' });

    const result = await session.open();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(TargetError);
    }
  });

  test('omits page_id when not specified', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([{ status: 'ok', lock_id: 'L1', lock_secret: 'S1' }])
    );
    const session = new PageEditSession({ site, fullname: 'new-page' });

    await session.open();

    expect(calls[0]?.[0]?.page_id).toBeUndefined();
  });

  test('sends force_lock=yes when forceLock is set', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([{ status: 'ok', lock_id: 'L1', lock_secret: 'S1' }])
    );
    const session = new PageEditSession({ site, fullname: 'p', forceLock: true });

    await session.open();

    expect(calls[0]?.[0]?.force_lock).toBe('yes');
  });

  test('throws synchronously when mode is section without section number', () => {
    const { site } = createMockSite(queuedResponses([]));
    expect(() => new PageEditSession({ site, fullname: 'p', mode: 'section' })).toThrow();
  });
});

describe('PageEditSession.save', () => {
  test('marks the session saved on success', async () => {
    const { site } = createMockSite(
      queuedResponses([
        { status: 'ok', lock_id: 'L1', lock_secret: 'S1' },
        { status: 'ok', revisionId: 999 },
      ])
    );
    const session = new PageEditSession({ site, fullname: 'p' });
    await session.open();

    const result = await session.save({ title: 't', source: 's' });

    expect(result.isOk()).toBe(true);
    expect(session.saved).toBe(true);
  });

  test('returns an error when status is not ok', async () => {
    const { site } = createMockSite(
      queuedResponses([
        { status: 'ok', lock_id: 'L1', lock_secret: 'S1' },
        { status: 'no_permission' },
      ])
    );
    const session = new PageEditSession({ site, fullname: 'p' });
    await session.open();

    const result = await session.save();

    expect(result.isErr()).toBe(true);
    expect(session.saved).toBe(false);
  });

  test('returns TargetError when noLockError is set', async () => {
    const { site } = createMockSite(
      queuedResponses([
        { status: 'ok', lock_id: 'L1', lock_secret: 'S1' },
        { status: 'ok', noLockError: true, body: 'lost' },
      ])
    );
    const session = new PageEditSession({ site, fullname: 'p' });
    await session.open();

    const result = await session.save();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(TargetError);
    }
  });

  test('omits optional falsy params', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([{ status: 'ok', lock_id: 'L1', lock_secret: 'S1' }, { status: 'ok' }])
    );
    const session = new PageEditSession({ site, fullname: 'p' });
    await session.open();

    await session.save();

    const saveBody = calls[1]?.[0];
    expect(saveBody?.and_continue).toBeUndefined();
    expect(saveBody?.range_start).toBeUndefined();
    expect(saveBody?.tags).toBeUndefined();
  });
});

describe('withEditLock', () => {
  test('releases the lock when the callback fails', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([
        { status: 'ok', lock_id: 'L1', lock_secret: 'S1' },
        { status: 'ok' }, // release
      ])
    );
    const session = new PageEditSession({ site, fullname: 'p' });

    const result = await withEditLock(session, () => errAsync(new ForbiddenError('nope')));

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ForbiddenError);
    }
    expect(calls.length).toBe(2);
    expect(calls[1]?.[0]?.event).toBe('removePageEditLock');
  });

  test('does not release the lock when save() succeeded inside the callback', async () => {
    const { site, calls } = createMockSite(
      queuedResponses([
        { status: 'ok', lock_id: 'L1', lock_secret: 'S1' },
        { status: 'ok' }, // save
      ])
    );
    const session = new PageEditSession({ site, fullname: 'p' });

    const result = await withEditLock(session, (ed) => ed.save({ title: 't', source: 's' }));

    expect(result.isOk()).toBe(true);
    expect(calls.length).toBe(2);
  });

  test('does not attempt release when open() itself fails', async () => {
    const { site, calls } = createMockSite(queuedResponses([{ status: 'ok', locked: true }]));
    const session = new PageEditSession({ site, fullname: 'p' });

    const result = await withEditLock(session, (ed) => ed.save());

    expect(result.isErr()).toBe(true);
    expect(calls.length).toBe(1);
  });
});

describe('PageEditSession.synchronize', () => {
  test('updates lock on lockRecreated', async () => {
    const { site } = createMockSite(
      queuedResponses([
        { status: 'ok', lock_id: 'L1', lock_secret: 'S1' },
        { status: 'ok', lockRecreated: true, lockId: 'L2', lockSecret: 'S2', timeLeft: 900 },
      ])
    );
    const session = new PageEditSession({ site, fullname: 'p' });
    await session.open();

    await session.synchronize();

    expect(session.lockId).toBe('L2');
    expect(session.lockSecret).toBe('S2');
  });

  test('returns TargetError on noLockError', async () => {
    const { site } = createMockSite(
      queuedResponses([
        { status: 'ok', lock_id: 'L1', lock_secret: 'S1' },
        { status: 'ok', noLockError: true },
      ])
    );
    const session = new PageEditSession({ site, fullname: 'p' });
    await session.open();

    const result = await session.synchronize();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(TargetError);
    }
  });
});

describe('PageEditSession.release', () => {
  test('is a no-op when never opened', async () => {
    const { site, calls } = createMockSite(queuedResponses([]));
    const session = new PageEditSession({ site, fullname: 'p' });

    await session.release();

    expect(calls.length).toBe(0);
  });

  test('does not throw when the release request itself fails', async () => {
    const { site } = createMockSite(
      queuedResponses([{ status: 'ok', lock_id: 'L1', lock_secret: 'S1' }])
    );
    const session = new PageEditSession({ site, fullname: 'p' });
    await session.open();
    // Second call (release) has no queued response -> errAsync
    const result = await session.release();

    expect(result.isOk()).toBe(true);
  });
});

describe('PageEditSession.preview / diff', () => {
  test('preview returns body and title', async () => {
    const { site } = createMockSite(
      queuedResponses([
        { status: 'ok', lock_id: 'L1', lock_secret: 'S1' },
        { status: 'ok', body: '<p>preview</p>', title: 'T' },
      ])
    );
    const session = new PageEditSession({ site, fullname: 'p' });
    await session.open();

    const result = await session.preview({ title: 'T', source: 's' });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.body).toBe('<p>preview</p>');
      expect(result.value.title).toBe('T');
    }
  });

  test('diff returns body', async () => {
    const { site } = createMockSite(
      queuedResponses([
        { status: 'ok', lock_id: 'L1', lock_secret: 'S1' },
        { status: 'ok', body: '<div>diff</div>' },
      ])
    );
    const session = new PageEditSession({ site, fullname: 'p' });
    await session.open();

    const result = await session.diff({ source: 's' });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('<div>diff</div>');
    }
  });
});
