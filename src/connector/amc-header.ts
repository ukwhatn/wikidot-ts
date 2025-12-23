/**
 * AMCリクエストヘッダーを管理するクラス
 */
export class AMCHeader {
  private cookies: Map<string, string>;
  private contentType: string;
  private userAgent: string;
  private referer: string;

  /**
   * @param options - ヘッダー初期化オプション
   */
  constructor(options?: { contentType?: string; userAgent?: string; referer?: string }) {
    this.contentType = options?.contentType ?? 'application/x-www-form-urlencoded; charset=UTF-8';
    this.userAgent = options?.userAgent ?? 'WikidotTS';
    this.referer = options?.referer ?? 'https://www.wikidot.com/';
    this.cookies = new Map([['wikidot_token7', '123456']]);
  }

  /**
   * Cookieを設定する
   * @param name - Cookie名
   * @param value - Cookie値
   */
  setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  /**
   * Cookieを削除する
   * @param name - Cookie名
   */
  deleteCookie(name: string): void {
    this.cookies.delete(name);
  }

  /**
   * Cookieを取得する
   * @param name - Cookie名
   * @returns Cookie値、存在しない場合はundefined
   */
  getCookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  /**
   * HTTPヘッダーオブジェクトを取得する
   * @returns ヘッダー辞書
   */
  getHeaders(): Record<string, string> {
    const cookieString = Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

    return {
      'Content-Type': this.contentType,
      'User-Agent': this.userAgent,
      Referer: this.referer,
      Cookie: cookieString,
    };
  }
}
