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
exports.PageRevision = exports.PageRevisionCollection = void 0;
const pageSource_1 = require("./pageSource");
const util_1 = require("../util");
const cheerio = __importStar(require("cheerio"));
class PageRevisionCollection extends Array {
    constructor(page, revisions) {
        super(...revisions);
        this.page = page;
    }
    static async _acquireSources(page, revisions) {
        const targetRevisions = [...revisions].filter((revision) => !revision.isSourceAcquired());
        if (targetRevisions.length === 0) {
            return revisions;
        }
        const responses = await page.site.amcRequest(targetRevisions.map((revision) => ({
            moduleName: 'history/PageSourceModule',
            revision_id: revision.id,
        })));
        for (let i = 0; i < targetRevisions.length; i++) {
            const revision = targetRevisions[i];
            const response = responses[i];
            revision.source = new pageSource_1.PageSource(page, cheerio.load(response.data.body)('div.page-source').text().trim());
        }
        return revisions;
    }
    async getSources() {
        return await PageRevisionCollection._acquireSources(this.page, this);
    }
    static async _acquireHTMLs(page, revisions) {
        const targetRevisions = [...revisions].filter((revision) => !revision.isHTMLAcquired());
        if (targetRevisions.length === 0) {
            return revisions;
        }
        const responses = await page.site.amcRequest(targetRevisions.map((revision) => ({
            moduleName: 'history/PageVersionModule',
            revision_id: revision.id,
        })));
        for (let i = 0; i < targetRevisions.length; i++) {
            const revision = targetRevisions[i];
            const response = responses[i];
            const source = response.data.body;
            const _source = util_1.StringUtil.split(source, "onclick=\"document.getElementById('page-version-info').style.display='none'\">", 1)[1];
            revision._html = util_1.StringUtil.split(_source, '</a>\n\t</div>\n\n\n\n', 1)[1].trim();
        }
        return revisions;
    }
    async getHTMLs() {
        return await PageRevisionCollection._acquireHTMLs(this.page, this);
    }
}
exports.PageRevisionCollection = PageRevisionCollection;
class PageRevision {
    constructor(page, id, revNo, createdBy, createdAt, comment, _source = null, _html = null) {
        this.page = page;
        this.id = id;
        this.revNo = revNo;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
        this.comment = comment;
        this._source = _source;
        this._html = _html;
    }
    isSourceAcquired() {
        return this._source !== null;
    }
    isHTMLAcquired() {
        return this._html !== null;
    }
    get source() {
        if (!this.isSourceAcquired()) {
            return PageRevisionCollection._acquireSources(this.page, [this]).then(() => this._source);
        }
        return Promise.resolve(this._source);
    }
    set source(value) {
        this._source = value;
    }
    get html() {
        if (!this.isHTMLAcquired()) {
            return PageRevisionCollection._acquireHTMLs(this.page, [this]).then(() => this._html);
        }
        return Promise.resolve(this._html);
    }
    set html(value) {
        this._html = value;
    }
}
exports.PageRevision = PageRevision;
//# sourceMappingURL=pageRevision.js.map