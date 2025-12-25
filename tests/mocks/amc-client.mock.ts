/**
 * AMCClient Mock
 *
 * Mock implementation for AMCClient (no HTTP requests)
 */

import { err, ok, type ResultAsync } from 'neverthrow';
import type { WikidotError } from '../../src/common/errors';
import type { AMCConfig } from '../../src/connector/amc-config';
import { AMCHeader } from '../../src/connector/amc-header';
import type { AMCRequestBody, AMCResponse } from '../../src/connector/amc-types';
import { TEST_AMC_CONFIG } from '../setup';

/**
 * Mock response handler type
 */
export type MockResponseHandler = (body: AMCRequestBody) => AMCResponse | WikidotError;

/**
 * AMCClient mock
 */
export class MockAMCClient {
  public readonly header: AMCHeader;
  public readonly config: AMCConfig;
  public readonly domain: string;

  private responseHandlers: MockResponseHandler[] = [];
  private requestHistory: AMCRequestBody[] = [];

  constructor(config: Partial<AMCConfig> = {}, domain = 'wikidot.com') {
    this.config = { ...TEST_AMC_CONFIG, ...config };
    this.domain = domain;
    this.header = new AMCHeader();
  }

  /**
   * Add mock response handler
   */
  addResponseHandler(handler: MockResponseHandler): void {
    this.responseHandlers.push(handler);
  }

  /**
   * Clear response handlers
   */
  clearResponseHandlers(): void {
    this.responseHandlers = [];
  }

  /**
   * Get request history
   */
  getRequestHistory(): AMCRequestBody[] {
    return [...this.requestHistory];
  }

  /**
   * Clear request history
   */
  clearRequestHistory(): void {
    this.requestHistory = [];
  }

  /**
   * Check SSL support (always returns true)
   */
  checkSiteSSL(_siteName: string): ResultAsync<boolean, WikidotError> {
    return ok(true) as unknown as ResultAsync<boolean, WikidotError>;
  }

  /**
   * Execute mock request
   */
  request(
    bodies: AMCRequestBody[],
    _siteName = 'www',
    _sslSupported?: boolean
  ): ResultAsync<AMCResponse[], WikidotError> {
    this.requestHistory.push(...bodies);

    const responses: AMCResponse[] = [];

    for (const body of bodies) {
      let response: AMCResponse | WikidotError | null = null;

      // Try handlers in order
      for (const handler of this.responseHandlers) {
        const result = handler(body);
        if (result) {
          response = result;
          break;
        }
      }

      // Default response if no handler matches
      if (!response) {
        response = {
          status: 'ok',
          body: '',
          CURRENT_TIMESTAMP: Date.now(),
        };
      }

      // If error
      if (response instanceof Error) {
        return err(response as WikidotError) as unknown as ResultAsync<AMCResponse[], WikidotError>;
      }

      responses.push(response);
    }

    return ok(responses) as unknown as ResultAsync<AMCResponse[], WikidotError>;
  }
}

/**
 * Create success response
 */
export function createOkResponse(body = ''): AMCResponse {
  return {
    status: 'ok',
    body,
    CURRENT_TIMESTAMP: Date.now(),
  };
}

/**
 * Create error response
 */
export function createErrorResponse(status: string, message = ''): AMCResponse {
  return {
    status,
    message,
    CURRENT_TIMESTAMP: Date.now(),
  };
}

/**
 * Create try_again response
 */
export function createTryAgainResponse(): AMCResponse {
  return {
    status: 'try_again',
    CURRENT_TIMESTAMP: Date.now(),
  };
}

/**
 * Create no_permission response
 */
export function createNoPermissionResponse(): AMCResponse {
  return {
    status: 'no_permission',
    CURRENT_TIMESTAMP: Date.now(),
  };
}
