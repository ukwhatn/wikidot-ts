/**
 * HTTP utilities with retry mechanism
 */
import type { AMCConfig } from '../connector/amc-config';
import { DEFAULT_AMC_CONFIG } from '../connector/amc-config';

/**
 * Calculate backoff time with exponential backoff and jitter
 * @param retryCount - Current retry count (1-based)
 * @param baseInterval - Base interval in milliseconds
 * @param backoffFactor - Exponential backoff factor
 * @param maxBackoff - Maximum backoff time in milliseconds
 * @returns Backoff time in milliseconds
 */
export function calculateBackoff(
  retryCount: number,
  baseInterval: number,
  backoffFactor: number,
  maxBackoff: number
): number {
  const backoff = baseInterval * backoffFactor ** (retryCount - 1);
  const jitter = Math.random() * backoff * 0.1;
  return Math.min(backoff + jitter, maxBackoff);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Options for fetchWithRetry
 */
export interface FetchWithRetryOptions extends Omit<RequestInit, 'signal'> {
  /** Whether to check response.ok (default: true) */
  checkOk?: boolean;
}

/**
 * Fetch with automatic retry on timeout/network errors
 * @param url - URL to fetch
 * @param config - AMC configuration (uses timeout, retryLimit, retryInterval, maxBackoff, backoffFactor)
 * @param options - Fetch options (RequestInit without signal)
 * @returns Response
 * @throws Error on all retries exhausted
 */
export async function fetchWithRetry(
  url: string,
  config: AMCConfig = DEFAULT_AMC_CONFIG,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { checkOk = true, ...fetchOptions } = options;

  for (let attempt = 0; attempt < config.retryLimit; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: AbortSignal.timeout(config.timeout),
      });
      if (checkOk && !response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      if (attempt >= config.retryLimit - 1) {
        throw error;
      }
      const backoff = calculateBackoff(
        attempt + 1,
        config.retryInterval,
        config.backoffFactor,
        config.maxBackoff
      );
      await sleep(backoff);
    }
  }
  throw new Error('Unreachable');
}
