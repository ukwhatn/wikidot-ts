import {Page} from "./page";
import {AbstractUser} from "./user";

class PageVoteCollection extends Array<PageVote> {
    constructor(
        public page: Page,
        public votes: PageVote[],
    ) {
        super(...votes);
    }
}


class PageVote {
    constructor(
        public page: Page,
        public user: AbstractUser,
        public value: number,
    ) {
    }
}

export {PageVote, PageVoteCollection};