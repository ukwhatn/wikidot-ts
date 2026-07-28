import type { AMCResponse } from '../../connector/amc-types';
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

  /** Raw AMC response, when available (e.g. to inspect form_errors payloads) */
  public readonly response?: AMCResponse;

  /**
   * @param message - Error message
   * @param statusCode - Status code (e.g., 'not_ok', 'try_again')
   * @param response - Raw AMC response (optional, keeps existing call sites intact)
   */
  constructor(message: string, statusCode: string, response?: AMCResponse) {
    super(message);
    this.statusCode = statusCode;
    this.response = response;
  }
}

/**
 * Extract a field-name -> message record from an AMC response, absorbing the
 * key naming differences between modules (formErrors / errors / message).
 * @param response - Raw AMC response
 * @returns Field-name -> message record (empty if none of the known keys are present)
 */
function extractFormErrors(response: AMCResponse | undefined): Record<string, string> {
  if (!response) {
    return {};
  }

  for (const key of ['formErrors', 'errors']) {
    const value = response[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const result: Record<string, string> = {};
      for (const [field, message] of Object.entries(value as Record<string, unknown>)) {
        result[field] = String(message);
      }
      return result;
    }
  }

  if (typeof response.message === 'string' && response.message.length > 0) {
    return { message: response.message };
  }

  return {};
}

/**
 * Form validation error
 * Thrown when AMC response status is 'form_errors' or 'form_error'.
 * Absorbs the payload key differences across modules (formErrors / errors / message)
 * behind a single `errors` accessor.
 */
export class FormErrorsError extends WikidotStatusError {
  /** Field-name -> message record, regardless of the underlying payload key */
  get errors(): Record<string, string> {
    return extractFormErrors(this.response);
  }
}

/**
 * Response data error
 * Thrown when response parsing fails
 */
export class ResponseDataError extends AMCError {}
