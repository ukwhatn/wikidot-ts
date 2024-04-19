import { Client } from './client'
import { ForbiddenException, WikidotStatusCodeException } from '../common/exceptions'
import { AbstractUser, User } from './user'
import { AxiosResponse } from 'axios'
import * as cheerio from 'cheerio'
import { odateParse } from '../util/parser'
import { userParse } from '../util/parser/user'

class PrivateMessageCollection extends Array<PrivateMessage> {
    toString(): string {
        return `${this.constructor.name}(${this.length} messages)`
    }

    static async fromIds(client: Client, messageIds: number[]): Promise<PrivateMessageCollection> {
        const bodies = messageIds.map((messageId) => ({
            item: messageId,
            moduleName: 'dashboard/messages/DMViewMessageModule',
        }))

        client.loginCheck()

        const responses: (AxiosResponse | Error)[] = await client.amcClient.request(bodies, true)

        const messages: PrivateMessage[] = []

        for (const [index, response] of responses.entries()) {
            if (response instanceof WikidotStatusCodeException) {
                if (response.statusCode === 'no_message') {
                    throw new ForbiddenException(`Failed to get message: ${messageIds[index]}`)
                }
            }

            if (response instanceof Error) {
                throw response
            }

            const html = cheerio.load(response.data.body)

            const [sender, recipient] = html('div.pmessage div.header span.printuser').get()

            messages.push(
                new PrivateMessage(
                    client,
                    messageIds[index],
                    userParse(client, html(sender)),
                    userParse(client, html(recipient)),
                    html('div.pmessage div.header span.subject').text(),
                    html('div.pmessage div.body').text(),
                    odateParse(html('div.header span.odate')),
                ),
            )
        }

        return new PrivateMessageCollection(...messages)
    }

    protected static async _acquire(client: Client, moduleName: string): Promise<PrivateMessageCollection> {
        client.loginCheck()

        const response = (await client.amcClient.request([{ moduleName }]))[0]

        if (response instanceof Error) throw response

        const html = cheerio.load(response.data.body)
        const pager = html('div.pager span.target')
        const maxPage: number = pager.length > 2 ? Number(pager.eq(-2).text()) : 1

        const responses: (Error | AxiosResponse)[] =
            maxPage > 1
                ? await client.amcClient.request(
                      Array.from({ length: maxPage }, (_, i) => ({ page: i + 1, moduleName })),
                      false,
                  )
                : [response]

        const messageIds: number[] = []
        for (const response of responses) {
            if (response instanceof Error) throw response
            const html = cheerio.load(response.data.body)
            messageIds.push(
                ...html('tr.message')
                    // @ts-expect-error href属性が存在することを保証
                    .map((_, tr) => Number(html(tr).data('href').split('/').pop()))
                    .get(),
            )
        }

        return PrivateMessageCollection.fromIds(client, messageIds)
    }
}

class PrivateMessageInbox extends PrivateMessageCollection {
    static async fromIds(client: Client, messageIds: number[]): Promise<PrivateMessageInbox> {
        return new PrivateMessageInbox(...(await PrivateMessageCollection.fromIds(client, messageIds)))
    }

    static async acquire(client: Client): Promise<PrivateMessageInbox> {
        return new PrivateMessageInbox(
            ...(await PrivateMessageCollection._acquire(client, 'dashboard/messages/DMInboxModule')),
        )
    }
}

class PrivateMessageSentBox extends PrivateMessageCollection {
    static async fromIds(client: Client, messageIds: number[]): Promise<PrivateMessageSentBox> {
        return new PrivateMessageSentBox(...(await PrivateMessageCollection.fromIds(client, messageIds)))
    }

    static async acquire(client: Client): Promise<PrivateMessageSentBox> {
        return new PrivateMessageSentBox(
            ...(await PrivateMessageCollection._acquire(client, 'dashboard/messages/DMSentModule')),
        )
    }
}

class PrivateMessage {
    constructor(
        public client: Client,
        public id: number,
        public sender: AbstractUser,
        public recipient: AbstractUser,
        public subject: string,
        public body: string,
        public createdAt: Date,
    ) {}

    toString(): string {
        return `PrivateMessage(id=${this.id}, sender=${this.sender}, recipient=${this.recipient}, subject=${this.subject})`
    }

    static async fromId(client: Client, messageId: number): Promise<PrivateMessage> {
        return (await PrivateMessageCollection.fromIds(client, [messageId]))[0]
    }

    static async send(client: Client, recipient: User, subject: string, body: string): Promise<void> {
        client.loginCheck()
        await client.amcClient.request([
            {
                source: body,
                subject: subject,
                to_user_id: recipient.id,
                action: 'DashboardMessageAction',
                event: 'send',
                moduleName: 'Empty',
            },
        ])
    }
}

export { PrivateMessageCollection, PrivateMessageInbox, PrivateMessageSentBox, PrivateMessage }
