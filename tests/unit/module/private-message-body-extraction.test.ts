/**
 * DMViewMessageModule の本文抽出テスト
 *
 * 実機で採取した markup（2026-08-05）では div.body の内側に
 * 返信/削除ボタン（div.message-actions）が含まれる。本文テキストに
 * ボタンのラベルが混入しないことを固定する（bug-triggering input）
 */
import { describe, expect, test } from 'bun:test';
import type { Client } from '../../../src/module/client';
import { PrivateMessageCollection } from '../../../src/module/private-message/private-message';
import { createOkResponse, MockAMCClient } from '../../mocks/amc-client.mock';

const VIEW_MODULE = 'dashboard/messages/DMViewMessageModule';

function createFullMockClient(mockAmc: MockAMCClient): Client {
  return {
    requireLogin: () => ({ isErr: () => false }),
    isLoggedIn: () => true,
    amcClient: mockAmc,
  } as unknown as Client;
}

/** 実機採取 markup の縮約版（div.body 内に message-actions を含む） */
const REAL_MARKUP = `
<div class="pmessage">
    <div class="header">
        <span class="printuser"><a href="http://www.wikidot.com/user:info/alice" onclick="WIKIDOT.page.listeners.userInfo(111); return false;">alice</a></span>
        <span class="printuser"><a href="http://www.wikidot.com/user:info/staff" onclick="WIKIDOT.page.listeners.userInfo(999); return false;">staff</a></span>
        <span class="subject">hello</span>
        <span class="odate time_1700000000">01 Jan 2024</span>
    </div>
    <div class="body">
        <div class="message-actions text-center">
            <div class="btn-group">
                <a href="javascript:;" class="awesome btn btn-default btn-xs" onclick="WIKIDOT.modules.DMViewMessageModule.replyMessage(1)"><i class="icon-reply"></i> 返信</a>
                <a href="javascript:;" class="awesome btn btn-default btn-xs" onclick="WIKIDOT.modules.DMViewMessageModule.removeMessage(1, '#/inbox/p1')"><i class="icon-trash"></i> 削除</a>
            </div>
        </div>
<p>1行目の本文です。<br />
2行目の本文です。</p>
    </div>
</div>`;

describe('DMViewMessageModule body extraction', () => {
  test('本文に返信/削除ボタンのラベルが混入しない', async () => {
    const mockAmc = new MockAMCClient();
    mockAmc.addResponseHandler((body) =>
      body.moduleName === VIEW_MODULE ? createOkResponse(REAL_MARKUP) : createOkResponse()
    );
    const client = createFullMockClient(mockAmc);

    const result = await PrivateMessageCollection.fromIds(client, [1]);

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) throw new Error('expected ok');
    const message = result.value[0];
    expect(message?.body).toBe('1行目の本文です。\n2行目の本文です。');
    expect(message?.body).not.toContain('返信');
    expect(message?.body).not.toContain('削除');
    expect(message?.subject).toBe('hello');
  });
});
