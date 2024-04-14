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
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
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
let SiteApplication = (() => {
    var _a;
    let _instanceExtraInitializers = [];
    let __process_decorators;
    return _a = class SiteApplication {
            constructor(site, user, text) {
                this.site = (__runInitializers(this, _instanceExtraInitializers), site);
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
                    applications.push(new _a(site, user, text));
                }
                return applications;
            }
            async _process(action) {
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
        },
        (() => {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __process_decorators = [loginRequired];
            __esDecorate(_a, null, __process_decorators, { kind: "method", name: "_process", static: false, private: false, access: { has: obj => "_process" in obj, get: obj => obj._process }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
})();
exports.SiteApplication = SiteApplication;
//# sourceMappingURL=siteApplication.js.map