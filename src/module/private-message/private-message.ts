import * as cheerio from 'cheerio';
import {
  ForbiddenError,
  LoginRequiredError,
  NoElementError,
  UnexpectedError,
} from '../../common/errors';
import { fromPromise, type WikidotResultAsync } from '../../common/types';
import { parseOdate, parseUser } from '../../util/parser';
import type { Client } from '../client';
import type { AbstractUser } from '../user';
import type { User } from '../user/user';

/**
 * プライベートメッセージデータ
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
 * プライベートメッセージ
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
   * メッセージIDからメッセージを取得する
   * @param client - クライアント
   * @param messageId - メッセージID
   * @returns プライベートメッセージ
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
          throw new NoElementError(`Message not found: ${messageId}`);
        }
        return message;
      })(),
      (error) => {
        if (error instanceof ForbiddenError || error instanceof NoElementError) {
          return error;
        }
        return new UnexpectedError(`Failed to get message: ${String(error)}`);
      }
    );
  }

  /**
   * プライベートメッセージを送信する
   * @param client - クライアント
   * @param recipient - 受信者
   * @param subject - 件名
   * @param body - 本文
   */
  static send(
    client: Client,
    recipient: User,
    subject: string,
    body: string
  ): WikidotResultAsync<void> {
    const loginResult = client.requireLogin();
    if (loginResult.isErr()) {
      return fromPromise(
        Promise.reject(loginResult.error),
        () => new LoginRequiredError('Login required to send message')
      );
    }

    return fromPromise(
      (async () => {
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
        if (result.isErr()) {
          throw result.error;
        }
      })(),
      (error) => new UnexpectedError(`Failed to send message: ${String(error)}`)
    );
  }

  toString(): string {
    return `PrivateMessage(id=${this.id}, sender=${this.sender}, recipient=${this.recipient}, subject=${this.subject})`;
  }
}

/**
 * プライベートメッセージコレクション
 */
export class PrivateMessageCollection extends Array<PrivateMessage> {
  public readonly client: Client;

  constructor(client: Client, messages?: PrivateMessage[]) {
    super();
    this.client = client;
    if (messages) {
      this.push(...messages);
    }
  }

  /**
   * IDで検索
   */
  findById(id: number): PrivateMessage | undefined {
    return this.find((message) => message.id === id);
  }

  /**
   * メッセージIDのリストからメッセージを取得する
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

        const result = await client.amcClient.request(bodies);
        if (result.isErr()) {
          throw result.error;
        }

        const messages: PrivateMessage[] = [];

        for (let i = 0; i < messageIds.length; i++) {
          const response = result.value[i];
          const messageId = messageIds[i];
          if (!response || messageId === undefined) continue;

          const html = String(response.body ?? '');
          const $ = cheerio.load(html);

          // ユーザー情報を取得
          const printuserElems = $('div.pmessage div.header span.printuser');
          if (printuserElems.length < 2) {
            throw new ForbiddenError(`Failed to get message: ${messageId}`);
          }

          const senderElem = $(printuserElems[0]);
          const recipientElem = $(printuserElems[1]);

          const sender = parseUser(client, senderElem);
          const recipient = parseUser(client, recipientElem);

          // 件名
          const subjectElem = $('div.pmessage div.header span.subject');
          const subject = subjectElem.text().trim();

          // 本文
          const bodyElem = $('div.pmessage div.body');
          const body = bodyElem.text().trim();

          // 日時
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
        }

        return new PrivateMessageCollection(client, messages);
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
   * モジュールからメッセージを取得する内部メソッド
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
        // ページャー取得
        const firstResult = await client.amcClient.request([{ moduleName }]);
        if (firstResult.isErr()) {
          throw firstResult.error;
        }

        const firstResponse = firstResult.value[0];
        if (!firstResponse) {
          throw new NoElementError('Empty response');
        }

        const firstHtml = String(firstResponse.body ?? '');
        const $first = cheerio.load(firstHtml);

        // ページ数を取得
        const pagerTargets = $first('div.pager span.target');
        let maxPage = 1;
        if (pagerTargets.length > 2) {
          const lastPageText = $first(pagerTargets[pagerTargets.length - 2])
            .text()
            .trim();
          maxPage = Number.parseInt(lastPageText, 10) || 1;
        }

        // 全ページからメッセージIDを取得
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
            const html = String(response?.body ?? '');
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

        // メッセージを取得
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
}

/**
 * 受信箱
 */
export class PrivateMessageInbox extends PrivateMessageCollection {
  /**
   * 受信箱のメッセージをすべて取得する
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
        const inbox = new PrivateMessageInbox(client);
        inbox.push(...result.value);
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
 * 送信箱
 */
export class PrivateMessageSentBox extends PrivateMessageCollection {
  /**
   * 送信箱のメッセージをすべて取得する
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
        const sentBox = new PrivateMessageSentBox(client);
        sentBox.push(...result.value);
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
