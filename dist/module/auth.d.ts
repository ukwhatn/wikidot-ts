import { Client } from './client';
declare class SessionCreateException extends Error {
}
declare class HTTPAuthentication {
    static login(client: Client, username: string, password: string): Promise<void>;
    static logout(client: Client): Promise<void>;
}
export { HTTPAuthentication, SessionCreateException };
