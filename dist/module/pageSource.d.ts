import { Page } from './page';
declare class PageSource {
    private page;
    wikiText: string;
    constructor(page: Page, wikiText: string);
}
export { PageSource };
