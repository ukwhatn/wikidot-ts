import { Page } from './page';
import { AbstractUser } from './user';
import { PageSource } from './pageSource';
declare class PageRevisionCollection extends Array<PageRevision> {
    page: Page;
    constructor(page: Page, revisions: PageRevision[]);
    static _acquireSources(page: Page, revisions: PageRevision[]): Promise<PageRevision[]>;
    getSources(): Promise<PageRevision[]>;
    static _acquireHTMLs(page: Page, revisions: PageRevision[]): Promise<PageRevision[]>;
    getHTMLs(): Promise<PageRevision[]>;
}
declare class PageRevision {
    page: Page;
    id: number;
    revNo: number;
    createdBy: AbstractUser;
    createdAt: Date;
    comment: string;
    _source: PageSource | null;
    _html: string | null;
    constructor(page: Page, id: number, revNo: number, createdBy: AbstractUser, createdAt: Date, comment: string, _source?: PageSource | null, _html?: string | null);
    isSourceAcquired(): boolean;
    isHTMLAcquired(): boolean;
    get source(): Promise<PageSource>;
    set source(value: PageSource);
    get html(): Promise<string>;
    set html(value: string);
}
export { PageRevisionCollection, PageRevision };
