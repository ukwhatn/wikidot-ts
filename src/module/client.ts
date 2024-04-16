import {logger} from '../common';
import {LoginRequiredException} from '../common/exceptions';
import {AjaxModuleConnectorClient, AjaxModuleConnectorConfig} from '../connector/ajax';
import {HTTPAuthentication} from './auth';

import {PrivateMessage, PrivateMessageInbox, PrivateMessageSentBox, PrivateMessageCollection} from './privateMessage';
import {Site} from './site';
import {User, UserCollection} from './user';

class ClientUserMethods {
    constructor(private client: Client) {
    }

    async get(name: string, raiseWhenNotFound: boolean = false): Promise<User | null> {
        return await User.fromName(this.client, name, raiseWhenNotFound);
    }

    async getBulk(names: string[], raiseWhenNotFound: boolean = false): Promise<UserCollection> {
        return await UserCollection.fromNames(this.client, names, raiseWhenNotFound);
    }
}

class ClientPrivateMessageMethods {
    constructor(private client: Client) {
    }

    async send(recipient: User, subject: string, body: string): Promise<void> {
        await PrivateMessage.send(this.client, recipient, subject, body);
    }

    async getInbox(): Promise<PrivateMessageInbox> {
        return await PrivateMessageInbox.acquire(this.client);
    }

    async getSentbox(): Promise<PrivateMessageSentBox> {
        return await PrivateMessageSentBox.acquire(this.client);
    }

    async getMessages(messageIds: number[]): Promise<PrivateMessageCollection> {
        return PrivateMessageCollection.fromIds(this.client, messageIds);
    }

    async getMessage(messageId: number): Promise<PrivateMessage> {
        return PrivateMessage.fromId(this.client, messageId);
    }
}


class ClientSiteMethods {
    constructor(private client: Client) {
    }

    async get(unixName: string): Promise<Site> {
        return await Site.fromUnixName(this.client, unixName);
    }
}


class Client {
    public amcClient: AjaxModuleConnectorClient;
    public isLoggedIn: boolean;
    public username: string | null;

    public user: ClientUserMethods;
    public privateMessage: ClientPrivateMessageMethods;
    public site: ClientSiteMethods;

    private isInitialized: boolean;

    constructor(username?: string, amcConfig?: AjaxModuleConnectorConfig, loggingLevel: string = 'info') {
        logger.level = loggingLevel;

        this.amcClient = new AjaxModuleConnectorClient(null, amcConfig);

        this.isLoggedIn = false;
        this.username = null;

        this.isInitialized = false;

        this.user = new ClientUserMethods(this);
        this.privateMessage = new ClientPrivateMessageMethods(this);
        this.site = new ClientSiteMethods(this);
    }

    static async init(username?: string, password?: string, amcConfig?: AjaxModuleConnectorConfig, loggingLevel: string = 'info'): Promise<Client> {
        const instance = new Client(username, amcConfig, loggingLevel);

        if (username && password) {
            await HTTPAuthentication.login(instance, username, password).then(() => {
                instance.isLoggedIn = true;
                instance.username = username;
                instance.isInitialized = true;
            });
        } else {
            instance.isInitialized = true;
        }

        return instance;
    }

    async logout(): Promise<void> {
        if (this.isLoggedIn) {
            await HTTPAuthentication.logout(this);
            this.isLoggedIn = false;
            this.username = null;
        }
    }

    loginCheck(): void {
        while (!this.isInitialized) {
            // Wait for initialization
            setTimeout(() => {
            }, 1000);
        }

        if (!this.isLoggedIn) {
            throw new LoginRequiredException('Login is required to execute this function');
        }
    }

    toString(): string {
        return `Client(username=${this.username}, isLoggedIn=${this.isLoggedIn})`;
    }
}

export {Client};