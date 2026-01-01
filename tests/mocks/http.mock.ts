/**
 * HTTP Mock
 *
 * Mock implementation for fetch/ky
 */

/**
 * Mock response definition
 */
export interface MockResponse {
  status: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string | object;
  ok?: boolean;
}

/**
 * Mock request matcher
 */
export interface MockRequestMatcher {
  url?: string | RegExp;
  method?: string;
}

/**
 * Mock entry
 */
interface MockEntry {
  matcher: MockRequestMatcher;
  response: MockResponse;
  once?: boolean;
  used?: boolean;
}

/**
 * Sequential mock entry (for retry testing)
 */
interface SequentialMockEntry {
  matcher: MockRequestMatcher;
  responses: MockResponse[];
  currentIndex: number;
}

/**
 * HTTP mock class
 */
export class HttpMock {
  private mocks: MockEntry[] = [];
  private sequentialMocks: SequentialMockEntry[] = [];
  private requestHistory: { url: string; options?: RequestInit }[] = [];
  private originalFetch: typeof fetch;

  constructor() {
    this.originalFetch = globalThis.fetch;
  }

  /**
   * Add mock
   */
  addMock(matcher: MockRequestMatcher, response: MockResponse): void {
    this.mocks.push({ matcher, response });
  }

  /**
   * Add sequential mock (returns responses in order for retry testing)
   */
  addSequentialMock(matcher: MockRequestMatcher, responses: MockResponse[]): void {
    this.sequentialMocks.push({ matcher, responses, currentIndex: 0 });
  }

  /**
   * Clear mocks
   */
  clearMocks(): void {
    this.mocks = [];
    this.sequentialMocks = [];
  }

  /**
   * Get request history
   */
  getRequestHistory(): { url: string; options?: RequestInit }[] {
    return [...this.requestHistory];
  }

  /**
   * Clear request history
   */
  clearRequestHistory(): void {
    this.requestHistory = [];
  }

  /**
   * Replace fetch with mock
   */
  install(): void {
    const self = this;
    globalThis.fetch = async function mockFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      self.requestHistory.push({ url, options: init });

      // Check sequential mocks first (for retry testing)
      for (const seqMock of self.sequentialMocks) {
        const urlMatch =
          !seqMock.matcher.url ||
          (typeof seqMock.matcher.url === 'string'
            ? url === seqMock.matcher.url || url.includes(seqMock.matcher.url)
            : seqMock.matcher.url.test(url));

        const methodMatch =
          !seqMock.matcher.method || seqMock.matcher.method.toUpperCase() === method.toUpperCase();

        if (urlMatch && methodMatch && seqMock.currentIndex < seqMock.responses.length) {
          const response = seqMock.responses[seqMock.currentIndex];
          seqMock.currentIndex++;
          return self.createResponse(response);
        }
      }

      // Search for matching mock
      for (const mock of self.mocks) {
        const urlMatch =
          !mock.matcher.url ||
          (typeof mock.matcher.url === 'string'
            ? url === mock.matcher.url || url.includes(mock.matcher.url)
            : mock.matcher.url.test(url));

        const methodMatch =
          !mock.matcher.method || mock.matcher.method.toUpperCase() === method.toUpperCase();

        if (urlMatch && methodMatch) {
          return self.createResponse(mock.response);
        }
      }

      // Default: 404
      return self.createResponse({ status: 404, body: 'Not Found' });
    } as typeof fetch;
  }

  /**
   * Restore original fetch
   */
  restore(): void {
    globalThis.fetch = this.originalFetch;
  }

  /**
   * Create Response object
   */
  private createResponse(mock: MockResponse): Response {
    const body = typeof mock.body === 'object' ? JSON.stringify(mock.body) : (mock.body ?? '');

    const headers = new Headers(mock.headers ?? {});
    if (typeof mock.body === 'object' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    return new Response(body, {
      status: mock.status,
      statusText: mock.statusText ?? '',
      headers,
    });
  }
}

/**
 * Create and configure HTTP mock instance
 */
export function createHttpMock(): HttpMock {
  const mock = new HttpMock();
  mock.install();
  return mock;
}
