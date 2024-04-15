import {Page} from "./page";

class PageSource {
    private page: Page;
    public wikiText: string;

    constructor(page: Page, wikiText: string) {
        this.page = page;
        this.wikiText = wikiText;
    }
}

export {PageSource}