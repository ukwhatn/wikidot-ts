/**
 * Class for managing AMC request headers
 */
export class AMCHeader {
  private cookies: Map<string, string>;
  private contentType: string;
  private userAgent: string;
  private referer: string;

  /**
   * @param options - Header initialization options
   */
  constructor(options?: { contentType?: string; userAgent?: string; referer?: string }) {
    this.contentType = options?.contentType ?? 'application/x-www-form-urlencoded; charset=UTF-8';
    this.userAgent = options?.userAgent ?? 'WikidotTS';
    this.referer = options?.referer ?? 'https://www.wikidot.com/';
    this.cookies = new Map([['wikidot_token7', '123456']]);
  }

  /**
   * Set a cookie
   * @param name - Cookie name
   * @param value - Cookie value
   */
  setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  /**
   * Delete a cookie
   * @param name - Cookie name
   */
  deleteCookie(name: string): void {
    this.cookies.delete(name);
  }

  /**
   * Get a cookie
   * @param name - Cookie name
   * @returns Cookie value, undefined if not exists
   */
  getCookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  /**
   * Get HTTP headers object
   * @returns Headers dictionary
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
