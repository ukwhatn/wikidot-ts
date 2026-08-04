/**
 * PrivateMessage.send error passthrough tests
 *
 * Callers classifying send failures (definitive server rejection vs unknown
 * transport outcome) need the original WikidotError subclass. send() must not
 * flatten errors into UnexpectedError, matching the withLogin-based methods
 * and the typed exceptions of the sibling wikidot.py.
 */
import { describe, expect, test } from 'bun:test';
import { AMCHttpError, FormErrorsError, WikidotStatusError } from '../../../src/common/errors';
import type { Client } from '../../../src/module/client';
import { PrivateMessage } from '../../../src/module/private-message/private-message';
import { MockAMCClient } from '../../mocks/amc-client.mock';

function createFullMockClient(mockAmc: MockAMCClient): Client {
  return {
    requireLogin: () => ({ isErr: () => false }),
    isLoggedIn: () => true,
    amcClient: mockAmc,
  } as unknown as Client;
}

describe('PrivateMessage.send error passthrough', () => {
  test('form error surfaces as FormErrorsError', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler(() => new FormErrorsError('form invalid', 'form_errors'));
    const client = createFullMockClient(mockAmc);

    const result = await PrivateMessage.send(client, { id: 1 } as never, 's', 'b');

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) throw new Error('expected err');
    expect(result.error).toBeInstanceOf(FormErrorsError);
  });

  test('wikidot status error surfaces as WikidotStatusError', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler(() => new WikidotStatusError('not ok', 'not_ok'));
    const client = createFullMockClient(mockAmc);

    const result = await PrivateMessage.send(client, { id: 1 } as never, 's', 'b');

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) throw new Error('expected err');
    expect(result.error).toBeInstanceOf(WikidotStatusError);
  });

  test('transport error surfaces as AMCHttpError', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler(() => new AMCHttpError('http 500', 500));
    const client = createFullMockClient(mockAmc);

    const result = await PrivateMessage.send(client, { id: 1 } as never, 's', 'b');

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) throw new Error('expected err');
    expect(result.error).toBeInstanceOf(AMCHttpError);
  });
});
