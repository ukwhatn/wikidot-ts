import type { WikidotResultAsync } from '../../../common/types';
import {
  PrivateMessage,
  PrivateMessageCollection,
  PrivateMessageInbox,
  PrivateMessageSentBox,
} from '../../private-message';
import type { User } from '../../user/user';
import type { Client } from '../client';

/**
 * プライベートメッセージ操作アクセサ
 */
export class PrivateMessageAccessor {
  public readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * メッセージIDからメッセージを取得する
   * @param id - メッセージID
   * @returns メッセージオブジェクト
   */
  get(id: number): WikidotResultAsync<PrivateMessage> {
    return PrivateMessage.fromId(this.client, id);
  }

  /**
   * 複数のメッセージIDからメッセージを取得する
   * @param ids - メッセージID配列
   * @returns メッセージコレクション
   */
  getMessages(ids: number[]): WikidotResultAsync<PrivateMessageCollection> {
    return PrivateMessageCollection.fromIds(this.client, ids);
  }

  /**
   * 受信箱のメッセージ一覧を取得する
   * @returns 受信箱
   */
  inbox(): WikidotResultAsync<PrivateMessageInbox> {
    return PrivateMessageInbox.acquire(this.client);
  }

  /**
   * 送信箱のメッセージ一覧を取得する
   * @returns 送信箱
   */
  sentBox(): WikidotResultAsync<PrivateMessageSentBox> {
    return PrivateMessageSentBox.acquire(this.client);
  }

  /**
   * プライベートメッセージを送信する
   * @param recipient - 受信者
   * @param subject - 件名
   * @param body - 本文
   */
  send(recipient: User, subject: string, body: string): WikidotResultAsync<void> {
    return PrivateMessage.send(this.client, recipient, subject, body);
  }
}

export { PrivateMessage, PrivateMessageCollection, PrivateMessageInbox, PrivateMessageSentBox };
