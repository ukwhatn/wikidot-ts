"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SitePageMethods = exports.SitePagesMethods = exports.Site = void 0;
const page_1 = require("./page");
const siteApplication_1 = require("./siteApplication");
const axios_1 = __importDefault(require("axios"));
const exceptions_1 = require("../common/exceptions");
class SitePagesMethods {
    constructor(site) {
        this.site = site;
    }
    search(query) {
        const _query = new page_1.SearchPagesQuery(query);
        return page_1.PageCollection.searchPages(this.site, _query);
    }
}
exports.SitePagesMethods = SitePagesMethods;
class SitePageMethods {
    constructor(site) {
        this.site = site;
    }
    get(fullname, raiseWhenNotFound = true) {
        const res = page_1.PageCollection.searchPages(this.site, new page_1.SearchPagesQuery({ fullname }));
        if (res.length === 0) {
            if (raiseWhenNotFound) {
                throw new exceptions_1.NotFoundException(`Page is not found: ${fullname}`);
            }
            return null;
        }
        return res[0];
    }
}
exports.SitePageMethods = SitePageMethods;
class Site {
    constructor(client, id, title, unixName, domain, sslSupported) {
        this.client = client;
        this.id = id;
        this.title = title;
        this.unixName = unixName;
        this.domain = domain;
        this.sslSupported = sslSupported;
        this.pages = new SitePagesMethods(this);
        this.page = new SitePageMethods(this);
    }
    toString() {
        return `Site(id=${this.id}, title=${this.title}, unixName=${this.unixName})`;
    }
    static async fromUnixName(client, unixName) {
        const response = await axios_1.default.get(`http://${unixName}.wikidot.com`, {
            maxRedirects: 5,
            timeout: client.amcClient.config.requestTimeout
        });
        if (response.status === 404) {
            throw new exceptions_1.NotFoundException(`Site is not found: ${unixName}.wikidot.com`);
        }
        const source = response.data;
        const idMatch = source.match(/WIKIREQUEST\.info\.siteId = (\d+);/);
        if (!idMatch) {
            throw new exceptions_1.UnexpectedException(`Cannot find site id: ${unixName}.wikidot.com`);
        }
        const siteId = Number(idMatch[1]);
        const titleMatch = source.match(/<title>(.*?)<\/title>/);
        if (!titleMatch) {
            throw new exceptions_1.UnexpectedException(`Cannot find site title: ${unixName}.wikidot.com`);
        }
        const title = titleMatch[1];
        const unixNameMatch = source.match(/WIKIREQUEST\.info\.siteUnixName = "(.*?)";/);
        if (!unixNameMatch) {
            throw new exceptions_1.UnexpectedException(`Cannot find site unixName: ${unixName}.wikidot.com`);
        }
        unixName = unixNameMatch[1];
        const domainMatch = source.match(/WIKIREQUEST\.info\.domain = "(.*?)";/);
        if (!domainMatch) {
            throw new exceptions_1.UnexpectedException(`Cannot find site domain: ${unixName}.wikidot.com`);
        }
        const domain = domainMatch[1];
        const sslSupported = response.request.protocol === 'https:';
        return new Site(client, siteId, title, unixName, domain, sslSupported);
    }
    amcRequest(bodies, returnExceptions = false) {
        return this.client.amcClient.request(bodies, returnExceptions, this.unixName, this.sslSupported);
    }
    getApplications() {
        return siteApplication_1.SiteApplication.acquireAll(this);
    }
    async inviteUser(user, text) {
        user.client.loginCheck();
        try {
            await this.amcRequest([{
                    action: 'ManageSiteMembershipAction',
                    event: 'inviteMember',
                    user_id: user.id,
                    text: text,
                    moduleName: 'Empty'
                }]);
        }
        catch (error) {
            if (error instanceof exceptions_1.WikidotStatusCodeException) {
                if (error.statusCode === 'already_invited') {
                    throw new exceptions_1.TargetErrorException(`User is already invited to ${this.unixName}: ${user.name}`);
                }
                else if (error.statusCode === 'already_member') {
                    throw new exceptions_1.TargetErrorException(`User is already a member of ${this.unixName}: ${user.name}`);
                }
            }
            throw error;
        }
    }
    getUrl() {
        return `http${this.sslSupported ? 's' : ''}://${this.domain}`;
    }
}
exports.Site = Site;
//# sourceMappingURL=site.js.map