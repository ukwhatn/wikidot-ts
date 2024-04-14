"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const common_1 = require("../common");
const exceptions_1 = require("../common/exceptions");
const ajax_1 = require("../connector/ajax");
const auth_1 = require("./auth");
const privateMessage_1 = require("./privateMessage");
// import { Site } from './module/site';
// import { User, UserCollection } from './module/user';
//
// class ClientUserMethods {
//   constructor(private client: Client) {}
//
//   get(name: string, raiseWhenNotFound: boolean = false): User {
//     return User.fromName(this.client, name, raiseWhenNotFound);
//   }
//
//   getBulk(names: string[], raiseWhenNotFound: boolean = false): User[] {
//     return UserCollection.fromNames(this.client, names, raiseWhenNotFound);
//   }
// }
class ClientPrivateMessageMethods {
    constructor(client) {
        this.client = client;
    }
    async send(recipient, subject, body) {
        await privateMessage_1.PrivateMessage.send(this.client, recipient, subject, body);
    }
    async getInbox() {
        return await privateMessage_1.PrivateMessageInbox.acquire(this.client);
    }
    async getSentbox() {
        return await privateMessage_1.PrivateMessageSentBox.acquire(this.client);
    }
    async getMessages(messageIds) {
        return privateMessage_1.PrivateMessageCollection.fromIds(this.client, messageIds);
    }
    async getMessage(messageId) {
        return privateMessage_1.PrivateMessage.fromId(this.client, messageId);
    }
}
//
// class ClientSiteMethods {
//   constructor(private client: Client) {}
//
//   get(unixName: string): Site {
//     return Site.fromUnixName(this.client, unixName);
//   }
// }
class Client {
    constructor(username, amcConfig, loggingLevel = 'WARNING') {
        common_1.logger.level = loggingLevel;
        this.amcClient = new ajax_1.AjaxModuleConnectorClient(null, amcConfig);
        this.isLoggedIn = false;
        this.username = null;
        this.isInitialized = false;
        // this.user = new ClientUserMethods(this);
        this.privateMessage = new ClientPrivateMessageMethods(this);
        // this.site = new ClientSiteMethods(this);
    }
    static async init(username, password, amcConfig, loggingLevel = 'WARNING') {
        const instance = new Client(username, amcConfig, loggingLevel);
        if (username && password) {
            console.log('Logging in');
            await auth_1.HTTPAuthentication.login(instance, username, password).then(() => {
                console.log('Logged in');
                instance.isLoggedIn = true;
                instance.username = username;
                instance.isInitialized = true;
            });
        }
        else {
            instance.isInitialized = true;
        }
        return instance;
    }
    async logout() {
        if (this.isLoggedIn) {
            await auth_1.HTTPAuthentication.logout(this);
            this.isLoggedIn = false;
            this.username = null;
        }
    }
    loginCheck() {
        while (!this.isInitialized) {
            // Wait for initialization
            setTimeout(() => {
            }, 1000);
        }
        if (!this.isLoggedIn) {
            throw new exceptions_1.LoginRequiredException('Login is required to execute this function');
        }
    }
    toString() {
        return `Client(username=${this.username}, isLoggedIn=${this.isLoggedIn})`;
    }
}
exports.Client = Client;
//# sourceMappingURL=client.js.map