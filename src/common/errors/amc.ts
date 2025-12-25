import { WikidotError } from './base';

/**
 * Base error for Ajax Module Connector related issues
 */
export class AMCError extends WikidotError {}

/**
 * HTTP status code error
 * Thrown when an AMC request fails with an HTTP error
 */
export class AMCHttpError extends AMCError {
  /** HTTP status code */
  public readonly statusCode: number;

  /**
   * @param message - Error message
   * @param statusCode - HTTP status code
   */
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Wikidot status code error
 * Thrown when AMC response status is not ok
 */
export class WikidotStatusError extends AMCError {
  /** Wikidot status code string */
  public readonly statusCode: string;

  /**
   * @param message - Error message
   * @param statusCode - Status code (e.g., 'not_ok', 'try_again')
   */
  constructor(message: string, statusCode: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Response data error
 * Thrown when response parsing fails
 */
export class ResponseDataError extends AMCError {}
