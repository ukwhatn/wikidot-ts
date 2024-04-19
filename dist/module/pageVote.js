"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageVoteCollection = exports.PageVote = void 0;
class PageVoteCollection extends Array {
    constructor(page, votes) {
        super(...votes);
        this.page = page;
        this.votes = votes;
    }
}
exports.PageVoteCollection = PageVoteCollection;
class PageVote {
    constructor(page, user, value) {
        this.page = page;
        this.user = user;
        this.value = value;
    }
}
exports.PageVote = PageVote;
//# sourceMappingURL=pageVote.js.map