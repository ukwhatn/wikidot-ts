import type { WikidotResultAsync } from '../../../common/types';
import { Site } from '../../site';
import type { Client } from '../client';

/**
 * サイト操作アクセサ
 */
export class SiteAccessor {
  public readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * UNIX名からサイトを取得する
   * @param unixName - サイトのUNIX名（例: 'scp-jp'）
   * @returns サイトオブジェクト
   */
  get(unixName: string): WikidotResultAsync<Site> {
    return Site.fromUnixName(this.client, unixName);
  }
}

export { Site };
