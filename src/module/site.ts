import {Client} from './client';
import {User} from './user';
//import {Page, SearchPagesQuery, PageCollection} from './page';
import {SiteApplication} from './siteApplication';
import axios, {AxiosResponse} from 'axios';
import {
    NotFoundException,
    UnexpectedException,
    TargetErrorException,
    WikidotStatusCodeException
} from '../common/exceptions';

// class SitePagesMethods {
//     constructor(private site: Site) {
//     }
//
//     search(query: Partial<SearchPagesQuery>): PageCollection {
//         const _query = new SearchPagesQuery(query);
//         return PageCollection.searchPages(this.site, _query);
//     }
// }
//
// class SitePageMethods {
//     constructor(private site: Site) {
//     }
//
//     get(fullname: string, raiseWhenNotFound: boolean = true): Page | null {
//         const res = PageCollection.searchPages(this.site, new SearchPagesQuery({fullname}));
//         if (res.length === 0) {
//             if (raiseWhenNotFound) {
//                 throw new NotFoundException(`Page is not found: ${fullname}`);
//             }
//             return null;
//         }
//         return res[0];
//     }
// }

class Site {
    // public pages: SitePagesMethods;
    // public page: SitePageMethods;

    constructor(
        public client: Client,
        public id: number,
        public title: string,
        public unixName: string,
        public domain: string,
        public sslSupported: boolean
    ) {
        // this.pages = new SitePagesMethods(this);
        // this.page = new SitePageMethods(this);
    }

    toString(): string {
        return `Site(id=${this.id}, title=${this.title}, unixName=${this.unixName})`;
    }

    static async fromUnixName(client: Client, unixName: string): Promise<Site> {
        const response: AxiosResponse = await axios.get(
            `http://${unixName}.wikidot.com`,
            {
                maxRedirects: 5,
                timeout: client.amcClient.config.requestTimeout * 1000
            }
        );

        if (response.status === 404) {
            throw new NotFoundException(`Site is not found: ${unixName}.wikidot.com`);
        }

        const source = response.data;

        const idMatch = source.match(/WIKIREQUEST\.info\.siteId = (\d+);/);
        if (!idMatch) {
            throw new UnexpectedException(`Cannot find site id: ${unixName}.wikidot.com`);
        }
        const siteId = Number(idMatch[1]);

        const titleMatch = source.match(/<title>(.*?)<\/title>/);
        if (!titleMatch) {
            throw new UnexpectedException(`Cannot find site title: ${unixName}.wikidot.com`);
        }
        const title = titleMatch[1];

        const unixNameMatch = source.match(/WIKIREQUEST\.info\.siteUnixName = "(.*?)";/);
        if (!unixNameMatch) {
            throw new UnexpectedException(`Cannot find site unixName: ${unixName}.wikidot.com`);
        }
        unixName = unixNameMatch[1];

        const domainMatch = source.match(/WIKIREQUEST\.info\.domain = "(.*?)";/);
        if (!domainMatch) {
            throw new UnexpectedException(`Cannot find site domain: ${unixName}.wikidot.com`);
        }
        const domain = domainMatch[1];

        const sslSupported = response.request.protocol === 'https:';

        return new Site(
            client,
            siteId,
            title,
            unixName,
            domain,
            sslSupported
        );
    }

    amcRequest(bodies: object[], returnExceptions: boolean = false): Promise<any[]> {
        return this.client.amcClient.request(bodies, returnExceptions, this.unixName, this.sslSupported);
    }

    async getApplications(): Promise<SiteApplication[]> {
        return await SiteApplication.acquireAll(this);
    }

    async inviteUser(user: User, text: string): Promise<void> {
        user.client.loginCheck();
        try {
            await this.amcRequest([{
                action: 'ManageSiteMembershipAction',
                event: 'inviteMember',
                user_id: user.id,
                text: text,
                moduleName: 'Empty'
            }]);
        } catch (error) {
            if (error instanceof WikidotStatusCodeException) {
                if (error.statusCode === 'already_invited') {
                    throw new TargetErrorException(`User is already invited to ${this.unixName}: ${user.name}`);
                } else if (error.statusCode === 'already_member') {
                    throw new TargetErrorException(`User is already a member of ${this.unixName}: ${user.name}`);
                }
            }
            throw error;
        }
    }

    getUrl(): string {
        return `http${this.sslSupported ? 's' : ''}://${this.domain}`;
    }
}

export {Site};