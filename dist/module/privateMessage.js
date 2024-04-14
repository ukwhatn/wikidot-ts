"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivateMessage = exports.PrivateMessageSentBox = exports.PrivateMessageInbox = exports.PrivateMessageCollection = void 0;
const exceptions_1 = require("../common/exceptions");
const cheerio = __importStar(require("cheerio"));
const parser_1 = require("../util/parser");
const user_1 = require("../util/parser/user");
class PrivateMessageCollection extends Array {
    toString() {
        return `${this.constructor.name}(${this.length} messages)`;
    }
    static async fromIds(client, messageIds) {
        const bodies = messageIds.map(messageId => ({
            item: messageId,
            moduleName: 'dashboard/messages/DMViewMessageModule'
        }));
        client.loginCheck();
        const responses = await client.amcClient.request(bodies, true);
        const messages = [];
        for (const [index, response] of responses.entries()) {
            if (response instanceof exceptions_1.WikidotStatusCodeException) {
                if (response.statusCode === 'no_message') {
                    throw new exceptions_1.ForbiddenException(`Failed to get message: ${messageIds[index]}`);
                }
            }
            if (response instanceof Error) {
                throw response;
            }
            const html = cheerio.load(response.data.body);
            const [sender, recipient] = html('div.pmessage div.header span.printuser').get();
            messages.push(new PrivateMessage(client, messageIds[index], (0, user_1.userParse)(client, html(sender)), (0, user_1.userParse)(client, html(recipient)), html('div.pmessage div.header span.subject').text(), html('div.pmessage div.body').text(), (0, parser_1.odateParse)(html('div.header span.odate'))));
        }
        return new PrivateMessageCollection(...messages);
    }
    static async _acquire(client, moduleName) {
        client.loginCheck();
        const response = (await client.amcClient.request([{ moduleName }]))[0];
        if (response instanceof Error)
            throw response;
        const html = cheerio.load(response.data.body);
        const pager = html('div.pager span.target');
        const maxPage = pager.length > 2 ? Number(pager.eq(-2).text()) : 1;
        const responses = maxPage > 1
            ? await client.amcClient.request(Array.from({ length: maxPage }, (_, i) => ({ page: i + 1, moduleName })), false)
            : [response];
        const messageIds = [];
        for (const response of responses) {
            if (response instanceof Error)
                throw response;
            const html = cheerio.load(response.data.body);
            // @ts-ignore
            messageIds.push(...html('tr.message').map((_, tr) => Number(html(tr).data('href').split('/').pop())).get());
        }
        return PrivateMessageCollection.fromIds(client, messageIds);
    }
}
exports.PrivateMessageCollection = PrivateMessageCollection;
class PrivateMessageInbox extends PrivateMessageCollection {
    static async fromIds(client, messageIds) {
        return new PrivateMessageInbox(...await PrivateMessageCollection.fromIds(client, messageIds));
    }
    static async acquire(client) {
        return new PrivateMessageInbox(...await PrivateMessageCollection._acquire(client, 'dashboard/messages/DMInboxModule'));
    }
}
exports.PrivateMessageInbox = PrivateMessageInbox;
class PrivateMessageSentBox extends PrivateMessageCollection {
    static async fromIds(client, messageIds) {
        return new PrivateMessageSentBox(...await PrivateMessageCollection.fromIds(client, messageIds));
    }
    static async acquire(client) {
        return new PrivateMessageSentBox(...await PrivateMessageCollection._acquire(client, 'dashboard/messages/DMSentModule'));
    }
}
exports.PrivateMessageSentBox = PrivateMessageSentBox;
class PrivateMessage {
    constructor(client, id, sender, recipient, subject, body, createdAt) {
        this.client = client;
        this.id = id;
        this.sender = sender;
        this.recipient = recipient;
        this.subject = subject;
        this.body = body;
        this.createdAt = createdAt;
    }
    toString() {
        return `PrivateMessage(id=${this.id}, sender=${this.sender}, recipient=${this.recipient}, subject=${this.subject})`;
    }
    static async fromId(client, messageId) {
        return (await PrivateMessageCollection.fromIds(client, [messageId]))[0];
    }
    static async send(client, recipient, subject, body) {
        client.loginCheck();
        await client.amcClient.request([{
                source: body,
                subject: subject,
                to_user_id: recipient.id,
                action: 'DashboardMessageAction',
                event: 'send',
                moduleName: 'Empty'
            }]);
    }
}
exports.PrivateMessage = PrivateMessage;
//# sourceMappingURL=privateMessage.js.map