import { Page } from './page';
import { AbstractUser } from './user';
declare class PageVoteCollection extends Array<PageVote> {
    page: Page;
    votes: PageVote[];
    constructor(page: Page, votes: PageVote[]);
}
declare class PageVote {
    page: Page;
    user: AbstractUser;
    value: number;
    constructor(page: Page, user: AbstractUser, value: number);
}
export { PageVote, PageVoteCollection };
