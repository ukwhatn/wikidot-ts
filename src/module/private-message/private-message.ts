import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import {
  ForbiddenError,
  LoginRequiredError,
  NoElementError,
  UnexpectedError,
  WikidotError,
} from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { requireBody } from '../../connector';
import { parseOdate, parseUser } from '../../util/parser';
import type { Client } from '../client';
import type { AbstractUser } from '../user';
import type { User } from '../user/user';

/**
 * Run an action requiring login, wrapping the result/error into a WikidotResultAsync
 * @param client - Client instance
 * @param action - Async action to run once login is confirmed
 * @param wrapError - Maps a caught error to a WikidotError (WikidotError instances pass through unchanged)
 * @returns Result of the action
 */
function withLogin<T>(
  client: Client,
  action: () => Promise<T>,
  wrapError: (error: unknown) => WikidotError
): WikidotResultAsync<T> {
  const loginResult = client.requireLogin();
  if (loginResult.isErr()) {
    return fromPromise(
      Promise.reject(loginResult.error),
      () => new LoginRequiredError('Login required')
    );
  }
  return fromPromise(action(), (error) =>
    error instanceof WikidotError ? error : wrapError(error)
  );
}

/**
 * Private message data
 */
export interface PrivateMessageData {
  client: Client;
  id: number;
  sender: AbstractUser;
  recipient: AbstractUser;
  subject: string;
  body: string;
  createdAt: Date;
}

/**
 * Private message
 */
export class PrivateMessage {
  public readonly client: Client;
  public readonly id: number;
  public readonly sender: AbstractUser;
  public readonly recipient: AbstractUser;
  public readonly subject: string;
  public readonly body: string;
  public readonly createdAt: Date;

  constructor(data: PrivateMessageData) {
    this.client = data.client;
    this.id = data.id;
    this.sender = data.sender;
    this.recipient = data.recipient;
    this.subject = data.subject;
    this.body = data.body;
    this.createdAt = data.createdAt;
  }

  /**
   * Get message by message ID
   * @param client - Client instance
   * @param messageId - Message ID
   * @returns Private message
   */
  static fromId(client: Client, messageId: number): WikidotResultAsync<PrivateMessage> {
    return fromPromise(
      (async () => {
        const result = await PrivateMessageCollection.fromIds(client, [messageId]);
        if (result.isErr()) {
          throw result.error;
        }
        const message = result.value[0];
        if (!message) {
          // fromIds is partial-success: a single-message failure comes back
          // recorded on the collection, not as Err, so surface it here
          const failure = result.value.failures.find((f) => f.id === messageId);
          if (failure) {
            throw failure.error;
          }
          throw new NoElementError(`Message not found: ${messageId}`);
        }
        return message;
      })(),
      (error) => {
        if (error instanceof WikidotError) {
          return error;
        }
        return new UnexpectedError(`Failed to get message: ${String(error)}`);
      }
    );
  }

  /**
   * Send private message
   * @param client - Client instance
   * @param recipient - Recipient
   * @param subject - Subject
   * @param body - Body
   */
  static send(
    client: Client,
    recipient: User,
    subject: string,
    body: string
  ): WikidotResultAsync<void> {
    // withLogin so WikidotError subclasses pass through unchanged: callers
    // distinguishing a definitive rejection (FormErrorsError etc.) from an
    // unknown transport outcome need the original error type, and the sibling
    // wikidot.py raises typed exceptions here
    return withLogin(
      client,
      async () => {
        const result = await client.amcClient.request([
          {
            source: body,
            subject,
            to_user_id: recipient.id,
            action: 'DashboardMessageAction',
            event: 'send',
            moduleName: 'Empty',
          },
        ]);
        if (result.isErr()) throw result.error;
      },
      (error) => new UnexpectedError(`Failed to send message: ${String(error)}`)
    );
  }

  /**
   * Save a private message draft
   * @param client - Client instance
   * @param subject - Draft subject
   * @param body - Draft body
   * @param recipient - Intended recipient. May be omitted (the real form allows a draft with no recipient selected yet)
   */
  static saveDraft(
    client: Client,
    subject: string,
    body: string,
    recipient?: User
  ): WikidotResultAsync<void> {
    return withLogin(
      client,
      async () => {
        const result = await client.amcClient.request([
          {
            action: 'DashboardMessageAction',
            event: 'saveDraft',
            source: body,
            subject,
            moduleName: 'Empty',
            ...(recipient ? { to_user_id: recipient.id } : {}),
          },
        ]);
        if (result.isErr()) throw result.error;
      },
      (error) => new UnexpectedError(`Failed to save draft: ${String(error)}`)
    );
  }

  /**
   * Check whether the account is allowed to send a private message to a user.
   *
   * Wraps DashboardMessageAction/checkCan. Does not return a boolean: only the
   * generic no_permission rejection path was confirmed during the investigation,
   * so other rejection reasons (e.g. the recipient's receive-messages setting) may
   * surface as a plain WikidotStatusError instead of ForbiddenError. Treat a
   * successful (isOk) result as "allowed".
   * @param client - Client instance
   * @param user - Prospective recipient
   */
  static checkCanSend(client: Client, user: AbstractUser): WikidotResultAsync<void> {
    return withLogin(
      client,
      async () => {
        const result = await client.amcClient.request([
          {
            action: 'DashboardMessageAction',
            event: 'checkCan',
            userId: user.id,
            moduleName: 'Empty',
          },
        ]);
        if (result.isErr()) throw result.error;
      },
      (error) => new UnexpectedError(`Failed to check send permission: ${String(error)}`)
    );
  }

  /**
   * Render a preview of a private message without sending it. Wraps the
   * dashboard/messages/DMPreviewModule module.
   * @param client - Client instance
   * @param subject - Message subject
   * @param body - Message body
   * @param recipient - Intended recipient
   * @returns Rendered HTML preview
   */
  static preview(
    client: Client,
    subject: string,
    body: string,
    recipient?: User
  ): WikidotResultAsync<string> {
    return withLogin(
      client,
      async () => {
        const result = await client.amcClient.request([
          {
            moduleName: 'dashboard/messages/DMPreviewModule',
            source: body,
            subject,
            ...(recipient ? { to_user_id: recipient.id } : {}),
          },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'dashboard/messages/DMPreviewModule');
      },
      (error) => new UnexpectedError(`Failed to render preview: ${String(error)}`)
    );
  }

  /**
   * Fetch the pre-filled "new message" form HTML for replying to a message.
   *
   * Wraps the dashboard/messages/DMNewMessageModule module with replyMessageId
   * set, which renders the form with the original sender pre-filled as recipient
   * (toUserId/toUserName in the rendered HTML). Returns the raw body since the
   * investigation captured the request/response shape but not the specific
   * markup used to extract those pre-filled values.
   * @param client - Client instance
   * @param replyMessageId - ID of the message being replied to
   * @returns Raw rendered HTML body
   */
  static fetchReplyFormHtml(client: Client, replyMessageId: number): WikidotResultAsync<string> {
    return withLogin(
      client,
      async () => {
        const result = await client.amcClient.request([
          { moduleName: 'dashboard/messages/DMNewMessageModule', replyMessageId },
        ]);
        if (result.isErr()) throw result.error;
        return requireBody(result.value[0], 'dashboard/messages/DMNewMessageModule');
      },
      (error) => new UnexpectedError(`Failed to fetch reply form: ${String(error)}`)
    );
  }

  /**
   * Mark this message as read
   */
  markAsRead(): WikidotResultAsync<void> {
    return PrivateMessageCollection.markAsRead(this.client, [this.id]);
  }

  /**
   * Mark this message as unread
   */
  markAsUnread(): WikidotResultAsync<void> {
    return PrivateMessageCollection.markAsUnread(this.client, [this.id]);
  }

  /**
   * Delete this message
   */
  delete(): WikidotResultAsync<void> {
    return PrivateMessageCollection.removeMessages(this.client, [this.id]);
  }

  toString(): string {
    return `PrivateMessage(id=${this.id}, sender=${this.sender}, recipient=${this.recipient}, subject=${this.subject})`;
  }
}

/**
 * A message that could not be fetched, with the ID it was requested by
 */
export interface PrivateMessageFetchFailure {
  /** Requested message ID */
  id: number;
  /** The error that made this message unfetchable (transport or parse failure) */
  error: WikidotError;
}

/**
 * Private message collection
 */
export class PrivateMessageCollection extends Array<PrivateMessage> {
  public readonly client: Client;

  /**
   * Messages that could not be fetched when this collection was built.
   * A single unfetchable message no longer fails the whole fetch: it is
   * skipped and reported here instead, so callers processing the successful
   * messages must check this to know the fetch was partial.
   */
  public readonly failures: PrivateMessageFetchFailure[];

  constructor(
    client: Client,
    messages?: PrivateMessage[],
    failures?: PrivateMessageFetchFailure[]
  ) {
    super();
    this.client = client;
    this.failures = failures ? [...failures] : [];
    if (messages) {
      this.push(...messages);
    }
  }

  /**
   * Find by ID
   */
  findById(id: number): PrivateMessage | undefined {
    return this.find((message) => message.id === id);
  }

  /**
   * Get messages from list of message IDs.
   *
   * Partial-success contract: a message that fails to fetch (per-request
   * transport error, missing body, or unparseable markup) is skipped and
   * reported in the returned collection's `failures`, in request order, so
   * one broken message cannot block the rest. Successful messages keep the
   * input ID order. If every message fails, the result is still Ok with an
   * empty collection and all IDs in `failures`. Only systemic failures
   * (login missing, SSL/site resolution) return Err.
   */
  static fromIds(
    client: Client,
    messageIds: number[]
  ): WikidotResultAsync<PrivateMessageCollection> {
    const loginResult = client.requireLogin();
    if (loginResult.isErr()) {
      return fromPromise(
        Promise.reject(loginResult.error),
        () => new LoginRequiredError('Login required to get messages')
      );
    }

    return fromPromise(
      (async () => {
        const bodies = messageIds.map((messageId) => ({
          item: messageId,
          moduleName: 'dashboard/messages/DMViewMessageModule',
        }));

        const result = await client.amcClient.requestWithOptions(bodies, {
          returnExceptions: true,
        });
        if (result.isErr()) {
          throw result.error;
        }

        const messages: PrivateMessage[] = [];
        const failures: PrivateMessageFetchFailure[] = [];

        for (let i = 0; i < messageIds.length; i++) {
          const messageId = messageIds[i];
          if (messageId === undefined) continue;
          const response = result.value[i];

          try {
            if (response === undefined) {
              throw new NoElementError(`Empty response for message: ${messageId}`);
            }
            if (response instanceof WikidotError) {
              throw response;
            }

            const html = requireBody(response, 'dashboard/messages/DMViewMessageModule');
            const $ = cheerio.load(html);

            // Get user information
            const printuserElems = $('div.pmessage div.header span.printuser');
            if (printuserElems.length < 2) {
              throw new ForbiddenError(`Failed to get message: ${messageId}`);
            }

            const senderElem = $(printuserElems[0]);
            const recipientElem = $(printuserElems[1]);

            const sender = parseUser(client, senderElem);
            const recipient = parseUser(client, recipientElem);

            // Subject
            const subjectElem = $('div.pmessage div.header span.subject');
            const subject = subjectElem.text().trim();

            // The rendered div.body embeds the reply/delete action buttons
            // (div.message-actions) before the message text (markup measured
            // 2026-08-05), so drop them before extracting the text
            const bodyElem = $('div.pmessage div.body').clone();
            bodyElem.find('div.message-actions').remove();
            const body = bodyElem.text().trim();

            // Timestamp
            const odateElem = $('div.header span.odate');
            const createdAt =
              odateElem.length > 0 ? (parseOdate(odateElem) ?? new Date(0)) : new Date(0);

            messages.push(
              new PrivateMessage({
                client,
                id: messageId,
                sender,
                recipient,
                subject,
                body,
                createdAt,
              })
            );
          } catch (error) {
            failures.push({
              id: messageId,
              error:
                error instanceof WikidotError
                  ? error
                  : new UnexpectedError(`Failed to parse message ${messageId}: ${String(error)}`),
            });
          }
        }

        return new PrivateMessageCollection(client, messages, failures);
      })(),
      (error) => {
        if (error instanceof ForbiddenError || error instanceof LoginRequiredError) {
          return error;
        }
        return new UnexpectedError(`Failed to get messages: ${String(error)}`);
      }
    );
  }

  /**
   * Internal method to get messages from module
   */
  protected static acquireFromModule(
    client: Client,
    moduleName: string
  ): WikidotResultAsync<PrivateMessageCollection> {
    const loginResult = client.requireLogin();
    if (loginResult.isErr()) {
      return fromPromise(
        Promise.reject(loginResult.error),
        () => new LoginRequiredError('Login required to get messages')
      );
    }

    return fromPromise(
      (async () => {
        // Get pager
        const firstResult = await client.amcClient.request([{ moduleName }]);
        if (firstResult.isErr()) {
          throw firstResult.error;
        }

        const firstResponse = firstResult.value[0];
        if (!firstResponse) {
          throw new NoElementError('Empty response');
        }

        const firstHtml = requireBody(firstResponse, moduleName);
        const $first = cheerio.load(firstHtml);

        // Get page count
        const pagerTargets = $first('div.pager span.target');
        let maxPage = 1;
        if (pagerTargets.length > 2) {
          const lastPageText = $first(pagerTargets[pagerTargets.length - 2])
            .text()
            .trim();
          maxPage = Number.parseInt(lastPageText, 10) || 1;
        }

        // Get message IDs from all pages
        const messageIds: number[] = [];

        if (maxPage > 1) {
          const bodies = [];
          for (let page = 1; page <= maxPage; page++) {
            bodies.push({ page, moduleName });
          }
          const additionalResults = await client.amcClient.request(bodies);
          if (additionalResults.isErr()) {
            throw additionalResults.error;
          }

          for (const response of additionalResults.value) {
            const html = requireBody(response, moduleName);
            const $ = cheerio.load(html);
            $('tr.message').each((_i, elem) => {
              const dataHref = $(elem).attr('data-href') ?? '';
              const idMatch = dataHref.match(/\/(\d+)$/);
              if (idMatch?.[1]) {
                messageIds.push(Number.parseInt(idMatch[1], 10));
              }
            });
          }
        } else {
          $first('tr.message').each((_i, elem) => {
            const dataHref = $first(elem).attr('data-href') ?? '';
            const idMatch = dataHref.match(/\/(\d+)$/);
            if (idMatch?.[1]) {
              messageIds.push(Number.parseInt(idMatch[1], 10));
            }
          });
        }

        // Get messages
        const messagesResult = await PrivateMessageCollection.fromIds(client, messageIds);
        if (messagesResult.isErr()) {
          throw messagesResult.error;
        }

        return messagesResult.value;
      })(),
      (error) => {
        if (
          error instanceof ForbiddenError ||
          error instanceof LoginRequiredError ||
          error instanceof NoElementError
        ) {
          return error;
        }
        return new UnexpectedError(`Failed to acquire messages: ${String(error)}`);
      }
    );
  }

  /**
   * Mark messages as read.
   *
   * Wraps DashboardMessageAction/setAsReaded (the misspelling is Wikidot's own
   * event name on the wire and is intentionally kept as-is here; only this method
   * name uses correct spelling).
   * @param client - Client instance
   * @param messageIds - IDs of the messages to mark as read
   */
  static markAsRead(client: Client, messageIds: number[]): WikidotResultAsync<void> {
    return withLogin(
      client,
      async () => {
        const result = await client.amcClient.request([
          {
            action: 'DashboardMessageAction',
            event: 'setAsReaded',
            selected: messageIds,
            moduleName: 'Empty',
          },
        ]);
        if (result.isErr()) throw result.error;
      },
      (error) => new UnexpectedError(`Failed to mark messages as read: ${String(error)}`)
    );
  }

  /**
   * Mark messages as unread. Wraps DashboardMessageAction/setAsUnreaded.
   * @param client - Client instance
   * @param messageIds - IDs of the messages to mark as unread
   */
  static markAsUnread(client: Client, messageIds: number[]): WikidotResultAsync<void> {
    return withLogin(
      client,
      async () => {
        const result = await client.amcClient.request([
          {
            action: 'DashboardMessageAction',
            event: 'setAsUnreaded',
            selected: messageIds,
            moduleName: 'Empty',
          },
        ]);
        if (result.isErr()) throw result.error;
      },
      (error) => new UnexpectedError(`Failed to mark messages as unread: ${String(error)}`)
    );
  }

  /**
   * Delete messages. Wraps DashboardMessageAction/removeMessages.
   * @param client - Client instance
   * @param messageIds - IDs of the messages to delete
   */
  static removeMessages(client: Client, messageIds: number[]): WikidotResultAsync<void> {
    return withLogin(
      client,
      async () => {
        const result = await client.amcClient.request([
          {
            action: 'DashboardMessageAction',
            event: 'removeMessages',
            messages: messageIds,
            moduleName: 'Empty',
          },
        ]);
        if (result.isErr()) throw result.error;
      },
      (error) => new UnexpectedError(`Failed to delete messages: ${String(error)}`)
    );
  }
}

/**
 * Inbox
 */
export class PrivateMessageInbox extends PrivateMessageCollection {
  /**
   * Get all messages in inbox
   */
  static acquire(client: Client): WikidotResultAsync<PrivateMessageInbox> {
    return fromPromise(
      (async () => {
        const result = await PrivateMessageCollection.acquireFromModule(
          client,
          'dashboard/messages/DMInboxModule'
        );
        if (result.isErr()) {
          throw result.error;
        }
        const inbox = new PrivateMessageInbox(client, [...result.value], result.value.failures);
        return inbox;
      })(),
      (error) => {
        if (error instanceof ForbiddenError || error instanceof LoginRequiredError) {
          return error;
        }
        return new UnexpectedError(`Failed to acquire inbox: ${String(error)}`);
      }
    );
  }
}

/**
 * Sent box
 */
export class PrivateMessageSentBox extends PrivateMessageCollection {
  /**
   * Get all messages in sent box
   */
  static acquire(client: Client): WikidotResultAsync<PrivateMessageSentBox> {
    return fromPromise(
      (async () => {
        const result = await PrivateMessageCollection.acquireFromModule(
          client,
          'dashboard/messages/DMSentModule'
        );
        if (result.isErr()) {
          throw result.error;
        }
        const sentBox = new PrivateMessageSentBox(client, [...result.value], result.value.failures);
        return sentBox;
      })(),
      (error) => {
        if (error instanceof ForbiddenError || error instanceof LoginRequiredError) {
          return error;
        }
        return new UnexpectedError(`Failed to acquire sent box: ${String(error)}`);
      }
    );
  }
}

// ----------------------------------------------------------------------
// Site invitations / applications / contacts (/account/messages tabs)
//
// These represent the account's own outgoing/incoming relationships to sites and
// other users, rendered by dashboard/messages/DM*Module. Row markup for
// DMApplicationsModule/DMContactsModule was measured 2026-07-29 and is parsed
// into SiteJoinApplication/Contact below (DMApplicationsModule rows follow the
// same tr.message[data-href] pattern as inbox/sent). Row markup for
// DMInvitationsModule was not captured (no invitations existed on the
// investigation account), so its listing function still returns raw rendered
// HTML.
// ----------------------------------------------------------------------

/**
 * Fetch a page of the account's pending site invitations (raw HTML).
 * Wraps dashboard/messages/DMInvitationsModule.
 * @param client - Client instance
 * @param page - Page number
 * @returns Raw rendered HTML body
 */
export function getInvitationsHtml(client: Client, page = 1): WikidotResultAsync<string> {
  return withLogin(
    client,
    async () => {
      const result = await client.amcClient.request([
        { moduleName: 'dashboard/messages/DMInvitationsModule', page },
      ]);
      if (result.isErr()) throw result.error;
      return requireBody(result.value[0], 'dashboard/messages/DMInvitationsModule');
    },
    (error) => new UnexpectedError(`Failed to fetch invitations: ${String(error)}`)
  );
}

/**
 * Fetch the detail HTML of a single site invitation.
 * Wraps dashboard/messages/DMViewInvitationModule.
 * @param client - Client instance
 * @param item - Invitation ID
 * @returns Raw rendered HTML body
 */
export function getInvitationDetailHtml(client: Client, item: number): WikidotResultAsync<string> {
  return withLogin(
    client,
    async () => {
      const result = await client.amcClient.request([
        { moduleName: 'dashboard/messages/DMViewInvitationModule', item },
      ]);
      if (result.isErr()) throw result.error;
      return requireBody(result.value[0], 'dashboard/messages/DMViewInvitationModule');
    },
    (error) => new UnexpectedError(`Failed to fetch invitation detail: ${String(error)}`)
  );
}

/** Data backing a {@link SiteJoinApplication} */
export interface SiteJoinApplicationData {
  client: Client;
  itemId: number;
  fromSite: string;
  subject: string;
  preview: string;
  submittedAt: Date;
}

/**
 * A row of the account's own outgoing site-join applications
 * (dashboard/messages/DMApplicationsModule)
 *
 * Distinct from SiteApplication (site-application.ts), which is a site admin's
 * view of incoming applications to their own site.
 *
 * Row markup was measured 2026-07-29 (see the sibling wikidot.py repo's
 * `.local/memory/260728_wikidot-ajax-modules/70_account.md`, "一覧モジュールの
 * 行マークアップ" / "行の属性"): each row is `tr.message` with
 * `data-href="#/applications/<itemId>"` (the same pattern as the inbox/sent
 * `tr.message[data-href]`), plus `span.from` / `span.subject` /
 * `span.preview` / `span.date > span.odate`. The row does not carry a siteId,
 * so this object cannot drive `DashboardSitesAction/removeApplication` (which
 * takes a siteId, not this itemId) directly; use
 * `SiteAccessor.removeApplication(siteId)` with a siteId obtained elsewhere if
 * you need to withdraw an application. Extracting a siteId from
 * `DMViewApplicationModule`'s response was not attempted since that
 * response's structure is unmeasured.
 */
export class SiteJoinApplication {
  public readonly client: Client;
  /** Application ID (tail of tr.message's data-href), usable as the `item` parameter of DMViewApplicationModule */
  public readonly itemId: number;
  /** Text of span.from (the site the application was submitted to) */
  public readonly fromSite: string;
  /** Text of span.subject */
  public readonly subject: string;
  /** Text of span.preview */
  public readonly preview: string;
  /** Submission date and time (span.date > span.odate) */
  public readonly submittedAt: Date;

  constructor(data: SiteJoinApplicationData) {
    this.client = data.client;
    this.itemId = data.itemId;
    this.fromSite = data.fromSite;
    this.subject = data.subject;
    this.preview = data.preview;
    this.submittedAt = data.submittedAt;
  }

  /**
   * Fetch the detail HTML of this application (DMViewApplicationModule)
   */
  fetchDetailHtml(): WikidotResultAsync<string> {
    return getApplicationDetailHtml(this.client, this.itemId);
  }

  toString(): string {
    return `SiteJoinApplication(itemId=${this.itemId}, fromSite=${this.fromSite}, subject=${this.subject})`;
  }
}

/**
 * Internal helper to parse a single DMApplicationsModule row
 * @param client - Client instance
 * @param $ - Loaded cheerio document
 * @param elem - `tr.message` element to parse
 * @returns Parsed row, or null if a required element is missing
 */
function parseApplicationRow(
  client: Client,
  $: cheerio.CheerioAPI,
  elem: AnyNode
): SiteJoinApplication | null {
  const $row = $(elem);
  const dataHref = $row.attr('data-href');
  const fromElem = $row.find('span.from').first();
  if (dataHref === undefined || fromElem.length === 0) {
    return null;
  }

  const itemIdMatch = dataHref.match(/(\d+)$/);
  if (!itemIdMatch?.[1]) {
    return null;
  }

  const subjectElem = $row.find('span.subject').first();
  const previewElem = $row.find('span.preview').first();
  const odateElem = $row.find('span.date span.odate').first();

  return new SiteJoinApplication({
    client,
    itemId: Number.parseInt(itemIdMatch[1], 10),
    fromSite: fromElem.text().trim(),
    subject: subjectElem.text().trim(),
    preview: previewElem.text().trim(),
    submittedAt: odateElem.length > 0 ? (parseOdate(odateElem) ?? new Date(0)) : new Date(0),
  });
}

/**
 * Get all of the account's pending outgoing site join applications.
 *
 * Wraps dashboard/messages/DMApplicationsModule, fetching all pages.
 * @param client - Client instance
 * @returns All pending applications
 */
export function getApplications(client: Client): WikidotResultAsync<SiteJoinApplication[]> {
  return withLogin(
    client,
    async () => {
      const moduleName = 'dashboard/messages/DMApplicationsModule';

      const firstResult = await client.amcClient.request([{ moduleName }]);
      if (firstResult.isErr()) throw firstResult.error;
      const firstHtml = requireBody(firstResult.value[0], moduleName);
      const $first = cheerio.load(firstHtml);

      const pagerTargets = $first('div.pager span.target');
      let maxPage = 1;
      if (pagerTargets.length > 2) {
        const lastPageText = $first(pagerTargets[pagerTargets.length - 2])
          .text()
          .trim();
        maxPage = Number.parseInt(lastPageText, 10) || 1;
      }

      const applications: SiteJoinApplication[] = [];
      $first('tr.message').each((_i, elem) => {
        const application = parseApplicationRow(client, $first, elem);
        if (application) applications.push(application);
      });

      if (maxPage > 1) {
        const bodies = [];
        for (let page = 2; page <= maxPage; page++) {
          bodies.push({ page, moduleName });
        }
        const results = await client.amcClient.request(bodies);
        if (results.isErr()) throw results.error;
        for (const response of results.value) {
          const html = requireBody(response, moduleName);
          const $ = cheerio.load(html);
          $('tr.message').each((_i, elem) => {
            const application = parseApplicationRow(client, $, elem);
            if (application) applications.push(application);
          });
        }
      }

      return applications;
    },
    (error) => new UnexpectedError(`Failed to fetch applications: ${String(error)}`)
  );
}

/**
 * Fetch the detail HTML of a single site join application.
 * Wraps dashboard/messages/DMViewApplicationModule.
 * @param client - Client instance
 * @param item - Application ID
 * @returns Raw rendered HTML body
 */
export function getApplicationDetailHtml(client: Client, item: number): WikidotResultAsync<string> {
  return withLogin(
    client,
    async () => {
      const result = await client.amcClient.request([
        { moduleName: 'dashboard/messages/DMViewApplicationModule', item },
      ]);
      if (result.isErr()) throw result.error;
      return requireBody(result.value[0], 'dashboard/messages/DMViewApplicationModule');
    },
    (error) => new UnexpectedError(`Failed to fetch application detail: ${String(error)}`)
  );
}

/** Data backing a {@link Contact} */
export interface ContactData {
  client: Client;
  user: AbstractUser;
}

/**
 * A row of the account's contact list (dashboard/messages/DMContactsModule)
 *
 * Row markup was measured 2026-07-29 (see the sibling wikidot.py repo's
 * `.local/memory/260728_wikidot-ajax-modules/70_account.md`, "一覧モジュールの
 * 行マークアップ"): each row is a `tr` with
 * `td > span.printuser.avatarhover > a > img.small` and a delete button
 * (`td > a.awesome.red.small`). The user is parsed via the existing printuser
 * parser rather than the delete button, since removal only needs the user ID
 * (ContactsAction/removeContact), which the printuser element already carries.
 */
export class Contact {
  public readonly client: Client;
  /** The contact */
  public readonly user: AbstractUser;

  constructor(data: ContactData) {
    this.client = data.client;
    this.user = data.user;
  }

  toString(): string {
    return `Contact(user=${this.user})`;
  }

  /**
   * Remove this user from the account's contact list
   */
  remove(): WikidotResultAsync<void> {
    return removeContact(this.client, this.user);
  }
}

/**
 * Get the account's contact list.
 *
 * Wraps dashboard/messages/DMContactsModule (single request; this module is not
 * paginated).
 * @param client - Client instance
 * @returns All contacts
 */
export function getContacts(client: Client): WikidotResultAsync<Contact[]> {
  return withLogin(
    client,
    async () => {
      const moduleName = 'dashboard/messages/DMContactsModule';
      const result = await client.amcClient.request([{ moduleName }]);
      if (result.isErr()) throw result.error;
      const html = requireBody(result.value[0], moduleName);
      const $ = cheerio.load(html);

      const contacts: Contact[] = [];
      $('tr').each((_i, elem) => {
        const printuserElem = $(elem).find('span.printuser').first();
        if (printuserElem.length === 0) return;
        contacts.push(new Contact({ client, user: parseUser(client, printuserElem) }));
      });

      return contacts;
    },
    (error) => new UnexpectedError(`Failed to fetch contacts: ${String(error)}`)
  );
}

/**
 * Fetch the contact picker used when composing a new message (raw HTML).
 * Wraps dashboard/messages/DMContactsListModule.
 * @param client - Client instance
 * @returns Raw rendered HTML body
 */
export function getContactsListHtml(client: Client): WikidotResultAsync<string> {
  return withLogin(
    client,
    async () => {
      const result = await client.amcClient.request([
        { moduleName: 'dashboard/messages/DMContactsListModule' },
      ]);
      if (result.isErr()) throw result.error;
      return requireBody(result.value[0], 'dashboard/messages/DMContactsListModule');
    },
    (error) => new UnexpectedError(`Failed to fetch contacts list: ${String(error)}`)
  );
}

/**
 * Add a user to the account's contact list. Wraps ContactsAction/addContact.
 * @param client - Client instance
 * @param user - User to add
 */
export function addContact(client: Client, user: AbstractUser): WikidotResultAsync<void> {
  return withLogin(
    client,
    async () => {
      const result = await client.amcClient.request([
        { action: 'ContactsAction', event: 'addContact', userId: user.id, moduleName: 'Empty' },
      ]);
      if (result.isErr()) throw result.error;
    },
    (error) => new UnexpectedError(`Failed to add contact: ${String(error)}`)
  );
}

/**
 * Remove a user from the account's contact list. Wraps ContactsAction/removeContact.
 * @param client - Client instance
 * @param user - User to remove
 */
export function removeContact(client: Client, user: AbstractUser): WikidotResultAsync<void> {
  return withLogin(
    client,
    async () => {
      const result = await client.amcClient.request([
        { action: 'ContactsAction', event: 'removeContact', userId: user.id, moduleName: 'Empty' },
      ]);
      if (result.isErr()) throw result.error;
    },
    (error) => new UnexpectedError(`Failed to remove contact: ${String(error)}`)
  );
}

/**
 * Add a user to the account's contact list from their profile page.
 *
 * Wraps userinfo/UserAddToContactsModule, a second (module-render-as-action) path
 * to add a contact distinct from ContactsAction/addContact, used from a user's
 * profile ("user:info") page rather than the messages dashboard.
 * @param client - Client instance
 * @param user - User to add
 * @returns Raw rendered HTML body
 */
export function addContactViaProfile(
  client: Client,
  user: AbstractUser
): WikidotResultAsync<string> {
  return withLogin(
    client,
    async () => {
      const result = await client.amcClient.request([
        { moduleName: 'userinfo/UserAddToContactsModule', userId: user.id },
      ]);
      if (result.isErr()) throw result.error;
      return requireBody(result.value[0], 'userinfo/UserAddToContactsModule');
    },
    (error) => new UnexpectedError(`Failed to add contact via profile: ${String(error)}`)
  );
}
