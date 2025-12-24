import type { WikidotResultAsync } from '../../../common/types';
import { Site } from '../../site';
import type { Client } from '../client';

/**
 * Site operations accessor
 */
export class SiteAccessor {
  public readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Get site by UNIX name
   *
   * @param unixName - Site UNIX name (e.g., 'scp-jp')
   * @returns Site object wrapped in Result type
   *
   * @example
   * ```typescript
   * const siteResult = await client.site.get('scp-jp');
   * if (!siteResult.isOk()) {
   *   throw new Error('Failed to get site');
   * }
   * const site = siteResult.value;
   * ```
   */
  get(unixName: string): WikidotResultAsync<Site> {
    return Site.fromUnixName(this.client, unixName);
  }
}

export { Site };
