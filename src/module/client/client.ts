import { LoginRequiredError } from '../../common/errors';
import {
  fromPromise,
  type WikidotResult,
  type WikidotResultAsync,
  wdErr,
  wdOk,
  wdOkAsync,
} from '../../common/types';
import { AMCClient, type AMCConfig, login, logout } from '../../connector';
import { User } from '../user/user';
import { PrivateMessageAccessor } from './accessors/pm-accessor';
import { SiteAccessor } from './accessors/site-accessor';
import { UserAccessor } from './accessors/user-accessor';

/**
 * Client creation options
 */
export interface ClientOptions {
  /** Wikidot username */
  username?: string;

  /** Wikidot password */
  password?: string;

  /** Base domain (default: wikidot.com) */
  domain?: string;

  /** AMC configuration override */
  amcConfig?: Partial<AMCConfig>;
}

/**
 * Wikidot client
 * Main entry point of the library
 */
export class Client {
  /** AMC client */
  public readonly amcClient: AMCClient;

  /** Base domain */
  public readonly domain: string;

  /** User operations accessor */
  public readonly user: UserAccessor;

  /** Site operations accessor */
  public readonly site: SiteAccessor;

  /** Private message operations accessor */
  public readonly privateMessage: PrivateMessageAccessor;

  /** Username of the logged-in user */
  private _username: string | null;

  /** Logged-in user */
  private _me: User | null = null;

  /**
   * Private constructor
   * Use the create method to create an instance
   */
  private constructor(amcClient: AMCClient, domain: string, username: string | null = null) {
    this.amcClient = amcClient;
    this.domain = domain;
    this._username = username;

    // Initialize accessors
    this.user = new UserAccessor(this);
    this.site = new SiteAccessor(this);
    this.privateMessage = new PrivateMessageAccessor(this);
  }

  /**
   * Get the username of the logged-in user
   */
  get username(): string | null {
    return this._username;
  }

  /**
   * Get the logged-in user
   * Returns null if not logged in
   */
  get me(): User | null {
    return this._me;
  }

  /**
   * Create a client
   *
   * @param options - Client options
   * @returns Client instance wrapped in Result type
   *
   * @example
   * ```typescript
   * import { Client } from '@ukwhatn/wikidot';
   *
   * // Create a client
   * const clientResult = await Client.create({
   *   username: 'your_username',
   *   password: 'your_password',
   * });
   *
   * // Result type requires isOk() check before accessing .value
   * if (!clientResult.isOk()) {
   *   throw new Error('Failed to create client');
   * }
   * const client = clientResult.value;
   *
   * // Now you can access client.site, etc.
   * const siteResult = await client.site.get('scp-jp');
   * ```
   */
  static create(options: ClientOptions = {}): WikidotResultAsync<Client> {
    const { username, password, domain = 'wikidot.com', amcConfig = {} } = options;

    // Create AMC client
    const amcClient = new AMCClient(amcConfig, domain);

    // Login if credentials are provided
    if (username && password) {
      return fromPromise(
        (async () => {
          const client = new Client(amcClient, domain, username);
          const loginResult = await login(client, username, password);
          if (loginResult.isErr()) {
            throw loginResult.error;
          }

          // Get logged-in user information
          const userResult = await User.fromName(client, username);
          if (userResult.isOk() && userResult.value) {
            client._me = userResult.value;
          }

          return client;
        })(),
        (error) => {
          if (error instanceof LoginRequiredError) {
            return error;
          }
          return new LoginRequiredError(`Failed to create client: ${String(error)}`);
        }
      );
    }

    // Return unauthenticated client
    return wdOkAsync(new Client(amcClient, domain));
  }

  /**
   * Create an unauthenticated client
   * @param options - Client options (excluding credentials)
   * @returns Client instance
   */
  static createAnonymous(options: Omit<ClientOptions, 'username' | 'password'> = {}): Client {
    const { domain = 'wikidot.com', amcConfig = {} } = options;
    const amcClient = new AMCClient(amcConfig, domain);
    return new Client(amcClient, domain);
  }

  /**
   * Check login status
   * @returns true if logged in
   */
  isLoggedIn(): boolean {
    return this._username !== null;
  }

  /**
   * Require login
   * Returns LoginRequiredError if not logged in
   * @returns void on success
   */
  requireLogin(): WikidotResult<void> {
    if (!this.isLoggedIn()) {
      return wdErr(new LoginRequiredError());
    }
    return wdOk(undefined);
  }

  /**
   * Close the client
   * Attempts to logout if a session exists
   */
  close(): WikidotResultAsync<void> {
    if (this.isLoggedIn()) {
      return logout(this).map(() => {
        this._username = null;
        return undefined;
      });
    }
    return wdOkAsync(undefined);
  }
}
