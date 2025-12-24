/**
 * Ajax Module Connector configuration
 */
export interface AMCConfig {
  /** Request timeout (milliseconds) */
  timeout: number;

  /** Maximum retry count */
  retryLimit: number;

  /** Base retry interval (milliseconds) */
  retryInterval: number;

  /** Maximum backoff (milliseconds) */
  maxBackoff: number;

  /** Backoff factor */
  backoffFactor: number;

  /** Maximum concurrent requests */
  semaphoreLimit: number;
}

/** Default AMC configuration */
export const DEFAULT_AMC_CONFIG: AMCConfig = {
  timeout: 20000,
  retryLimit: 5,
  retryInterval: 1000,
  maxBackoff: 60000,
  backoffFactor: 2.0,
  semaphoreLimit: 10,
};

/**
 * Fixed token value required by Wikidot
 * This is a fixed value obtained from Wikidot's frontend,
 * used as an identifier rather than a security token
 */
export const WIKIDOT_TOKEN7 = '123456';

/**
 * Fallback HTTP status code for HTTP errors
 * Used when status code cannot be retrieved from response
 */
export const DEFAULT_HTTP_STATUS_CODE = 999;
