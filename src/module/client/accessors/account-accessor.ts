import { AccountProfile, AccountRecentActivity, AccountSettings } from '../../account/account';
import type { Client } from '../client';

/**
 * Account-level (Dashboard) settings/profile operations accessor
 *
 * Associated with a client instance, provides access to the sub-accessors covering
 * the /account/settings and /account/recent dashboards. Access through the
 * `client.account` property.
 *
 * @example
 * ```typescript
 * const result = await client.account.settings.setLanguage('ja');
 * ```
 */
export class AccountAccessor {
  public readonly client: Client;
  public readonly settings: AccountSettings;
  public readonly profile: AccountProfile;
  public readonly recent: AccountRecentActivity;

  constructor(client: Client) {
    this.client = client;
    this.settings = new AccountSettings(client);
    this.profile = new AccountProfile(client);
    this.recent = new AccountRecentActivity(client);
  }
}

export { AccountProfile, AccountRecentActivity, AccountSettings };
