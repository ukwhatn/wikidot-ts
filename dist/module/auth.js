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
exports.SessionCreateException = exports.HTTPAuthentication = void 0;
const axios_1 = __importStar(require("axios"));
class SessionCreateException extends Error {
}
exports.SessionCreateException = SessionCreateException;
class HTTPAuthentication {
    static async login(client, username, password) {
        await axios_1.default.post('https://www.wikidot.com/default--flow/login__LoginPopupScreen', {
            login: username,
            password: password,
            action: 'Login2Action',
            event: 'login',
        }, {
            headers: client.amcClient.header.getHeader(),
            timeout: 20000,
        }).then((response) => {
            if (response.status !== 200) {
                throw new SessionCreateException('Login attempt is failed due to HTTP status code: ' + response.status);
            }
            if (response.data.includes('The login and password do not match')) {
                throw new SessionCreateException('Login attempt is failed due to invalid username or password');
            }
            const wikidotSessionId = response.headers['set-cookie']?.find((cookie) => cookie.startsWith('WIKIDOT_SESSION_ID='));
            if (!wikidotSessionId) {
                throw new SessionCreateException('Login attempt is failed due to invalid cookies');
            }
            client.amcClient.header.setCookie('WIKIDOT_SESSION_ID', wikidotSessionId.split(';')[0].split('=')[1]);
        }).catch((error) => {
            if (error instanceof axios_1.AxiosError) {
                throw new SessionCreateException('Login attempt is failed due to HTTP error: ' + error.message);
            }
            throw error;
        });
    }
    static async logout(client) {
        try {
            await client.amcClient.request([
                {
                    action: 'Login2Action',
                    event: 'logout',
                    moduleName: 'Empty',
                },
            ]);
        }
        catch (error) {
            // Ignore error
        }
        client.amcClient.header.deleteCookie('WIKIDOT_SESSION_ID');
    }
}
exports.HTTPAuthentication = HTTPAuthentication;
//# sourceMappingURL=auth.js.map