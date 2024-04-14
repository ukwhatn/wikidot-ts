import { Site } from './site';
import { AbstractUser } from './user';
declare class SiteApplication {
    site: Site;
    user: AbstractUser;
    text: string;
    constructor(site: Site, user: AbstractUser, text: string);
    toString(): string;
    static acquireAll(site: Site): Promise<SiteApplication[]>;
    private _process;
    accept(): Promise<void>;
    decline(): Promise<void>;
}
export { SiteApplication };
