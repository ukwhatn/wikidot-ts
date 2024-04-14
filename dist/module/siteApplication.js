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
exports.SiteApplication = void 0;
const exceptions_1 = require("../common/exceptions");
const user_1 = require("../util/parser/user");
const cheerio = __importStar(require("cheerio"));
class SiteApplication {
    constructor(site, user, text) {
        this.site = site;
        this.user = user;
        this.text = text;
    }
    toString() {
        return `SiteApplication(user=${this.user}, site=${this.site}, text=${this.text})`;
    }
    static async acquireAll(site) {
        site.client.loginCheck();
        const response = (await site.amcRequest([{
                moduleName: 'managesite/ManageSiteMembersApplicationsModule'
            }]))[0];
        const body = response.data.body;
        if (body.includes('WIKIDOT.page.listeners.loginClick(event)')) {
            throw new exceptions_1.ForbiddenException('You are not allowed to access this page');
        }
        const html = cheerio.load(body);
        const applications = [];
        const userElements = html('h3 span.printuser');
        const textWrapperElements = html('table');
        if (userElements.length !== textWrapperElements.length) {
            throw new exceptions_1.UnexpectedException('Length of userElements and textWrapperElements are different');
        }
        for (let i = 0; i < userElements.length; i++) {
            const userElement = userElements.eq(i);
            const textWrapperElement = textWrapperElements.eq(i);
            const user = (0, user_1.userParse)(site.client, userElement);
            const text = textWrapperElement.find('td').eq(1).text().trim();
            applications.push(new SiteApplication(site, user, text));
        }
        return applications;
    }
    async _process(action) {
        this.site.client.loginCheck();
        if (action !== 'accept' && action !== 'decline') {
            throw new Error(`Invalid action: ${action}`);
        }
        try {
            await this.site.amcRequest([{
                    action: 'ManageSiteMembershipAction',
                    event: 'acceptApplication',
                    user_id: this.user.id,
                    text: `your application has been ${action}ed`,
                    type: action,
                    moduleName: 'Empty'
                }]);
        }
        catch (error) {
            if (error instanceof exceptions_1.WikidotStatusCodeException && error.statusCode === 'no_application') {
                throw new exceptions_1.NotFoundException(`Application not found: ${this.user}`);
            }
            else {
                throw error;
            }
        }
    }
    async accept() {
        await this._process('accept');
    }
    async decline() {
        await this._process('decline');
    }
}
exports.SiteApplication = SiteApplication;
//# sourceMappingURL=siteApplication.js.map