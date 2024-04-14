import axios, {AxiosError, AxiosResponse} from 'axios';
import {Client} from './client';

class SessionCreateException extends Error {
}

class HTTPAuthentication {
    static async login(client: Client, username: string, password: string): Promise<void> {

        await axios.post(
            'https://www.wikidot.com/default--flow/login__LoginPopupScreen',
            {
                login: username,
                password: password,
                action: 'Login2Action',
                event: 'login',
            },
            {
                headers: client.amcClient.header.getHeader(),
                timeout: 20000,
            }
        ).then((response) => {
                if (response.status !== 200) {
                    throw new SessionCreateException(
                        'Login attempt is failed due to HTTP status code: ' + response.status
                    );
                }

                if (response.data.includes('The login and password do not match')) {
                    throw new SessionCreateException('Login attempt is failed due to invalid username or password');
                }

                const wikidotSessionId = response.headers['set-cookie']?.find((cookie: string) =>
                    cookie.startsWith('WIKIDOT_SESSION_ID=')
                );

                if (!wikidotSessionId) {
                    throw new SessionCreateException('Login attempt is failed due to invalid cookies');
                }

                client.amcClient.header.setCookie('WIKIDOT_SESSION_ID', wikidotSessionId.split(';')[0].split('=')[1]);
            }
        ).catch((error) => {
            if (error instanceof AxiosError) {
                throw new SessionCreateException('Login attempt is failed due to HTTP error: ' + error.message);
            }
            throw error;
        });
    }

    static async logout(client: Client): Promise<void> {
        try {
            await client.amcClient.request([
                {
                    action: 'Login2Action',
                    event: 'logout',
                    moduleName: 'Empty',
                },
            ]);
        } catch (error) {
            // Ignore error
        }

        client.amcClient.header.deleteCookie('WIKIDOT_SESSION_ID');
    }
}

export {HTTPAuthentication, SessionCreateException};