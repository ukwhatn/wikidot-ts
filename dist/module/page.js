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
exports.Page = exports.PageCollection = exports.SearchPagesQuery = void 0;
const exceptions_1 = require("../common/exceptions");
const user_1 = require("../util/parser/user");
const parser_1 = require("../util/parser");
const util_1 = require("../util");
const cheerio = __importStar(require("cheerio"));
const DEFAULT_MODULE_BODY = [
    "fullname",
    "category",
    "name",
    "title",
    "created_at",
    "created_by_linked",
    "updated_at",
    "updated_by_linked",
    "commented_at",
    "commented_by_linked",
    "parent_fullname",
    "comments",
    "size",
    "children",
    "rating_votes",
    "rating",
    "rating_percent",
    "revisions",
    "tags",
    "_tags"
];
class SearchPagesQuery {
    constructor() {
        this.pagetype = "*";
        this.category = "*";
        this.tags = undefined;
        this.parent = undefined;
        this.linkTo = undefined;
        this.createdAt = undefined;
        this.updatedAt = undefined;
        this.createdBy = undefined;
        this.rating = undefined;
        this.votes = undefined;
        this.name = undefined;
        this.fullname = undefined;
        this.range = undefined;
        this.order = "created_at desc";
        this.offset = 0;
        this.limit = undefined;
        this.perPage = 250;
        this.separate = "no";
        this.wrapper = "no";
    }
    asDict() {
        const res = {};
        for (const [key, value] of Object.entries(this)) {
            if (value !== undefined) {
                res[key] = value;
            }
        }
        if (res.tags && Array.isArray(res.tags)) {
            res.tags = res.tags.join(" ");
        }
        return res;
    }
}
exports.SearchPagesQuery = SearchPagesQuery;
class PageCollection extends Array {
    static _parse(site, htmlBody) {
        const pages = new PageCollection();
        for (const _pageElement of htmlBody("span.page").toArray()) {
            const pageElement = cheerio.load(_pageElement);
            const pageParams = {};
            const is5starRating = pageElement("span.rating span.page-rate-list-pages-start").length > 0;
            for (const setElement of pageElement("span.set").toArray()) {
                let key = cheerio.load(setElement)("span.name").text().trim();
                const valueElement = cheerio.load(setElement)("span.value");
                let value = undefined;
                if (valueElement.length === 0) {
                    value = undefined;
                }
                else if (["created_at", "updated_at", "commented_at"].includes(key)) {
                    const odateElement = valueElement.find("span.odate");
                    value = odateElement.length > 0 ? (0, parser_1.odateParse)(odateElement) : undefined;
                }
                else if (["created_by_linked", "updated_by_linked", "commented_by_linked"].includes(key)) {
                    const printuserElement = valueElement.find("span.printuser");
                    value = printuserElement.length > 0 ? (0, user_1.userParse)(site.client, printuserElement) : undefined;
                }
                else if (["tags", "_tags"].includes(key)) {
                    value = valueElement.text().split(/\s+/);
                }
                else if (["rating_votes", "comments", "size", "revisions"].includes(key)) {
                    value = parseInt(valueElement.text().trim(), 10);
                }
                else if (key === "rating") {
                    value = is5starRating ? parseFloat(valueElement.text().trim()) : parseInt(valueElement.text().trim(), 10);
                }
                else if (key === "rating_percent") {
                    value = is5starRating ? parseFloat(valueElement.text().trim()) / 100 : undefined;
                }
                else {
                    value = valueElement.text().trim();
                }
                if (key.endsWith("_linked")) {
                    key = key.slice(0, -7);
                }
                else if (["comments", "children"].includes(key)) {
                    key = `${key}_count`;
                }
                else if (key === "rating_votes") {
                    key = "votes";
                }
                pageParams[key] = value;
            }
            for (const key of ["tags", "_tags"]) {
                if (!pageParams[key]) {
                    pageParams[key] = [];
                }
            }
            pageParams.tags = [...pageParams.tags, ...pageParams._tags];
            delete pageParams._tags;
            // @ts-ignore
            pages.push(new Page(site, pageParams));
        }
        return pages;
    }
    static async searchPages(site, query = new SearchPagesQuery()) {
        const queryDict = query.asDict();
        queryDict.moduleName = "list/ListPagesModule";
        queryDict.module_body = '[[span class="page"]]' + DEFAULT_MODULE_BODY.map(key => `[[span class="set ${key}"]]` +
            `[[span class="name"]] ${key} [[/span]]` +
            `[[span class="value"]] %%${key}%% [[/span]]` +
            `[[/span]]`).join("") + "[[/span]]";
        let response;
        try {
            response = (await site.amcRequest([queryDict]))[0];
        }
        catch (error) {
            if (error instanceof exceptions_1.WikidotStatusCodeException) {
                if (error.statusCode === "not_ok") {
                    throw new exceptions_1.ForbiddenException("Failed to get pages, target site may be private");
                }
            }
            throw error;
        }
        const body = response.data.body;
        const firstPageHtmlBody = cheerio.load(body);
        let total = 1;
        const htmlBodies = [firstPageHtmlBody];
        if (firstPageHtmlBody("div.pager").length > 0) {
            total = parseInt(firstPageHtmlBody("div.pager span.target").eq(-2).find("a").text(), 10);
        }
        if (total > 1) {
            const requestBodies = [];
            for (let i = 1; i < total; i++) {
                const _queryDict = { ...queryDict };
                _queryDict.offset = i * query.perPage;
                requestBodies.push(_queryDict);
            }
            const responses = await site.amcRequest(requestBodies);
            htmlBodies.push(...responses.map(response => cheerio.load(response.data.body)));
        }
        const pages = new PageCollection();
        for (const htmlBody of htmlBodies) {
            pages.push(...PageCollection._parse(site, htmlBody));
        }
        return pages;
    }
    static async _acquirePageIds(pages) {
        const targetPages = pages.filter(page => !page.isIdAcquired());
        if (targetPages.length === 0) {
            return pages;
        }
        const responses = await util_1.RequestUtil.request(targetPages[0].site.client, "GET", targetPages.map(page => `${page.getUrl()}/norender/true/noredirect/true`));
        for (const [index, response] of responses.entries()) {
            // @ts-ignore
            const idMatch = response?.data.match(/WIKIREQUEST\.info\.pageId = (\d+);/);
            if (!idMatch) {
                throw new exceptions_1.UnexpectedException(`Cannot find page id: ${targetPages[index].fullname}`);
            }
            targetPages[index].id = parseInt(idMatch[1], 10);
        }
        return pages;
    }
    async getPageIds() {
        return await PageCollection._acquirePageIds(this);
    }
}
exports.PageCollection = PageCollection;
class Page {
    constructor(site, { fullname, name, category, title, children_count, comments_count, size, rating, votes, rating_percent, revisions, parent_fullname, tags, created_by, created_at, updated_by, updated_at, commented_by, commented_at }) {
        this.site = site;
        this.fullname = fullname;
        this.name = name;
        this.category = category;
        this.title = title;
        this.childrenCount = children_count;
        this.commentsCount = comments_count;
        this.size = size;
        this.rating = rating ?? undefined;
        this.votes = votes;
        this.ratingPercent = rating_percent ?? undefined;
        this.revisions = revisions;
        this.parentFullname = parent_fullname ?? undefined;
        this.tags = tags;
        this.createdBy = created_by;
        this.createdAt = created_at;
        this.updatedBy = updated_by ?? undefined;
        this.updatedAt = updated_at ?? undefined;
        this.commentedBy = commented_by ?? undefined;
        this.commentedAt = commented_at ?? undefined;
    }
    getUrl() {
        return `${this.site.getUrl()}/${this.fullname}`;
    }
    async get id() {
        if (this._id === undefined) {
            await PageCollection._acquirePageIds([this]);
        }
        return this._id;
    }
    set id(value) {
        this._id = value;
    }
    isIdAcquired() {
        return this._id !== undefined;
    }
    destroy() {
        this.site.client.loginCheck();
        this.site.amcRequest([{
                action: "WikiPageAction",
                event: "deletePage",
                page_id: this.id,
                moduleName: "Empty"
            }]);
    }
}
exports.Page = Page;
//# sourceMappingURL=page.js.map