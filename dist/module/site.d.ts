import { Client } from './client';
import { User } from './user';
import { Page, SearchPagesQuery, PageCollection } from './page';
import { SiteApplication } from './siteApplication';
declare class SitePagesMethods {
    private site;
    constructor(site: Site);
    search(query: Partial<SearchPagesQuery>): PageCollection;
}
declare class SitePageMethods {
    private site;
    constructor(site: Site);
    get(fullname: string, raiseWhenNotFound?: boolean): Page | null;
}
declare class Site {
    client: Client;
    id: number;
    title: string;
    unixName: string;
    domain: string;
    sslSupported: boolean;
    pages: SitePagesMethods;
    page: SitePageMethods;
    constructor(client: Client, id: number, title: string, unixName: string, domain: string, sslSupported: boolean);
    toString(): string;
    static fromUnixName(client: Client, unixName: string): Promise<Site>;
    amcRequest(bodies: object[], returnExceptions?: boolean): Promise<any[]>;
    getApplications(): Promise<SiteApplication[]>;
    inviteUser(user: User, text: string): Promise<void>;
    getUrl(): string;
}
export { Site, SitePagesMethods, SitePageMethods };
