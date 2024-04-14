import { AjaxModuleConnectorClient, AjaxModuleConnectorConfig } from '../connector/ajax';
import { PrivateMessage, PrivateMessageInbox, PrivateMessageSentBox, PrivateMessageCollection } from './privateMessage';
import { Site } from './site';
import { User, UserCollection } from './user';
declare class ClientUserMethods {
    private client;
    constructor(client: Client);
    get(name: string, raiseWhenNotFound?: boolean): Promise<User | null>;
    getBulk(names: string[], raiseWhenNotFound?: boolean): Promise<UserCollection>;
}
declare class ClientPrivateMessageMethods {
    private client;
    constructor(client: Client);
    send(recipient: User, subject: string, body: string): Promise<void>;
    getInbox(): Promise<PrivateMessageInbox>;
    getSentbox(): Promise<PrivateMessageSentBox>;
    getMessages(messageIds: number[]): Promise<PrivateMessageCollection>;
    getMessage(messageId: number): Promise<PrivateMessage>;
}
declare class ClientSiteMethods {
    private client;
    constructor(client: Client);
    get(unixName: string): Promise<Site>;
}
declare class Client {
    amcClient: AjaxModuleConnectorClient;
    isLoggedIn: boolean;
    username: string | null;
    user: ClientUserMethods;
    privateMessage: ClientPrivateMessageMethods;
    site: ClientSiteMethods;
    private isInitialized;
    constructor(username?: string, amcConfig?: AjaxModuleConnectorConfig, loggingLevel?: string);
    static init(username?: string, password?: string, amcConfig?: AjaxModuleConnectorConfig, loggingLevel?: string): Promise<Client>;
    logout(): Promise<void>;
    loginCheck(): void;
    toString(): string;
}
export { Client };
