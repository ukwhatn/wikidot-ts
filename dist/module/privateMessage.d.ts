import { Client } from './client';
import { AbstractUser, User } from './user';
declare class PrivateMessageCollection extends Array<PrivateMessage> {
    toString(): string;
    static fromIds(client: Client, messageIds: number[]): Promise<PrivateMessageCollection>;
    protected static _acquire(client: Client, moduleName: string): Promise<PrivateMessageCollection>;
}
declare class PrivateMessageInbox extends PrivateMessageCollection {
    static fromIds(client: Client, messageIds: number[]): Promise<PrivateMessageInbox>;
    static acquire(client: Client): Promise<PrivateMessageInbox>;
}
declare class PrivateMessageSentBox extends PrivateMessageCollection {
    static fromIds(client: Client, messageIds: number[]): Promise<PrivateMessageSentBox>;
    static acquire(client: Client): Promise<PrivateMessageSentBox>;
}
declare class PrivateMessage {
    client: Client;
    id: number;
    sender: AbstractUser;
    recipient: AbstractUser;
    subject: string;
    body: string;
    createdAt: Date;
    constructor(client: Client, id: number, sender: AbstractUser, recipient: AbstractUser, subject: string, body: string, createdAt: Date);
    toString(): string;
    static fromId(client: Client, messageId: number): Promise<PrivateMessage>;
    static send(client: Client, recipient: User, subject: string, body: string): Promise<void>;
}
export { PrivateMessageCollection, PrivateMessageInbox, PrivateMessageSentBox, PrivateMessage };
