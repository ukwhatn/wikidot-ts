import { AjaxModuleConnectorClient, AjaxModuleConnectorConfig } from '../connector/ajax';
import { PrivateMessage, PrivateMessageInbox, PrivateMessageSentBox, PrivateMessageCollection } from './privateMessage';
import { User } from "./user";
declare class ClientPrivateMessageMethods {
    private client;
    constructor(client: Client);
    send(recipient: User, subject: string, body: string): Promise<void>;
    getInbox(): Promise<PrivateMessageInbox>;
    getSentbox(): Promise<PrivateMessageSentBox>;
    getMessages(messageIds: number[]): Promise<PrivateMessageCollection>;
    getMessage(messageId: number): Promise<PrivateMessage>;
}
declare class Client {
    amcClient: AjaxModuleConnectorClient;
    isLoggedIn: boolean;
    username: string | null;
    privateMessage: ClientPrivateMessageMethods;
    private isInitialized;
    constructor(username?: string, amcConfig?: AjaxModuleConnectorConfig, loggingLevel?: string);
    static init(username?: string, password?: string, amcConfig?: AjaxModuleConnectorConfig, loggingLevel?: string): Promise<Client>;
    logout(): Promise<void>;
    loginCheck(): void;
    toString(): string;
}
export { Client };
