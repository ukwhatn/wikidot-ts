import type { WikidotResultAsync } from '../../../common/types';
import {
  addContact,
  addContactViaProfile,
  getApplicationDetailHtml,
  getApplicationsHtml,
  getContactsHtml,
  getContactsListHtml,
  getInvitationDetailHtml,
  getInvitationsHtml,
  PrivateMessage,
  PrivateMessageCollection,
  PrivateMessageInbox,
  PrivateMessageSentBox,
  removeContact,
} from '../../private-message';
import type { AbstractUser } from '../../user';
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

  /**
   * Mark messages as read
   * @param messageIds - IDs of the messages to mark as read
   */
  markAsRead(messageIds: number[]): WikidotResultAsync<void> {
    return PrivateMessageCollection.markAsRead(this.client, messageIds);
  }

  /**
   * Mark messages as unread
   * @param messageIds - IDs of the messages to mark as unread
   */
  markAsUnread(messageIds: number[]): WikidotResultAsync<void> {
    return PrivateMessageCollection.markAsUnread(this.client, messageIds);
  }

  /**
   * Delete messages
   * @param messageIds - IDs of the messages to delete
   */
  removeMessages(messageIds: number[]): WikidotResultAsync<void> {
    return PrivateMessageCollection.removeMessages(this.client, messageIds);
  }

  /**
   * Save a private message draft
   * @param subject - Draft subject
   * @param body - Draft body
   * @param recipient - Intended recipient
   */
  saveDraft(subject: string, body: string, recipient?: User): WikidotResultAsync<void> {
    return PrivateMessage.saveDraft(this.client, subject, body, recipient);
  }

  /**
   * Check whether the account is allowed to message a user
   * @param user - Prospective recipient
   */
  checkCanSend(user: AbstractUser): WikidotResultAsync<void> {
    return PrivateMessage.checkCanSend(this.client, user);
  }

  /**
   * Render a preview of a private message without sending it
   * @param subject - Message subject
   * @param body - Message body
   * @param recipient - Intended recipient
   * @returns Rendered HTML preview
   */
  preview(subject: string, body: string, recipient?: User): WikidotResultAsync<string> {
    return PrivateMessage.preview(this.client, subject, body, recipient);
  }

  /**
   * Fetch the pre-filled "new message" form HTML for replying to a message
   * @param replyMessageId - ID of the message being replied to
   * @returns Raw rendered HTML body
   */
  fetchReplyFormHtml(replyMessageId: number): WikidotResultAsync<string> {
    return PrivateMessage.fetchReplyFormHtml(this.client, replyMessageId);
  }

  /**
   * Fetch a page of the account's pending site invitations (raw HTML)
   * @param page - Page number
   */
  getInvitationsHtml(page = 1): WikidotResultAsync<string> {
    return getInvitationsHtml(this.client, page);
  }

  /**
   * Fetch the detail HTML of a single site invitation
   * @param item - Invitation ID
   */
  getInvitationDetailHtml(item: number): WikidotResultAsync<string> {
    return getInvitationDetailHtml(this.client, item);
  }

  /**
   * Fetch a page of the account's pending site join applications (raw HTML)
   * @param page - Page number
   */
  getApplicationsHtml(page = 1): WikidotResultAsync<string> {
    return getApplicationsHtml(this.client, page);
  }

  /**
   * Fetch the detail HTML of a single site join application
   * @param item - Application ID
   */
  getApplicationDetailHtml(item: number): WikidotResultAsync<string> {
    return getApplicationDetailHtml(this.client, item);
  }

  /**
   * Fetch the account's contact list (raw HTML)
   */
  getContactsHtml(): WikidotResultAsync<string> {
    return getContactsHtml(this.client);
  }

  /**
   * Fetch the contact picker used when composing a new message (raw HTML)
   */
  getContactsListHtml(): WikidotResultAsync<string> {
    return getContactsListHtml(this.client);
  }

  /**
   * Add a user to the account's contact list
   * @param user - User to add
   */
  addContact(user: AbstractUser): WikidotResultAsync<void> {
    return addContact(this.client, user);
  }

  /**
   * Remove a user from the account's contact list
   * @param user - User to remove
   */
  removeContact(user: AbstractUser): WikidotResultAsync<void> {
    return removeContact(this.client, user);
  }

  /**
   * Add a user to the account's contact list from their profile page
   * @param user - User to add
   * @returns Raw rendered HTML body
   */
  addContactViaProfile(user: AbstractUser): WikidotResultAsync<string> {
    return addContactViaProfile(this.client, user);
  }
}

export { PrivateMessage, PrivateMessageCollection, PrivateMessageInbox, PrivateMessageSentBox };
