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
 * Private message operations accessor
 *
 * @example
 * ```typescript
 * // Get inbox
 * const inboxResult = await client.privateMessage.inbox();
 * if (!inboxResult.isOk()) {
 *   throw new Error('Failed to get inbox');
 * }
 * const inbox = inboxResult.value;
 * ```
 */
export class PrivateMessageAccessor {
  public readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Get message by message ID
   *
   * @param id - Message ID
   * @returns Message object wrapped in Result type
   */
  get(id: number): WikidotResultAsync<PrivateMessage> {
    return PrivateMessage.fromId(this.client, id);
  }

  /**
   * Get messages from multiple message IDs
   * @param ids - Array of message IDs
   * @returns Message collection
   */
  getMessages(ids: number[]): WikidotResultAsync<PrivateMessageCollection> {
    return PrivateMessageCollection.fromIds(this.client, ids);
  }

  /**
   * Get inbox message list
   * @returns Inbox
   */
  inbox(): WikidotResultAsync<PrivateMessageInbox> {
    return PrivateMessageInbox.acquire(this.client);
  }

  /**
   * Get sent box message list
   * @returns Sent box
   */
  sentBox(): WikidotResultAsync<PrivateMessageSentBox> {
    return PrivateMessageSentBox.acquire(this.client);
  }

  /**
   * Send a private message
   * @param recipient - Recipient
   * @param subject - Subject
   * @param body - Body
   */
  send(recipient: User, subject: string, body: string): WikidotResultAsync<void> {
    return PrivateMessage.send(this.client, recipient, subject, body);
  }
}

export { PrivateMessage, PrivateMessageCollection, PrivateMessageInbox, PrivateMessageSentBox };
