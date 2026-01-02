import ky, { type KyInstance } from 'ky';
import pLimit, { type LimitFunction } from 'p-limit';
import {
  AMCHttpError,
  ForbiddenError,
  NotFoundException,
  ResponseDataError,
  UnexpectedError,
  WikidotError,
  WikidotStatusError,
} from '../common/errors';
import { fromPromise, type WikidotResultAsync, wdErrAsync, wdOkAsync } from '../common/types';
import {
  type AMCConfig,
  DEFAULT_AMC_CONFIG,
  DEFAULT_HTTP_STATUS_CODE,
  WIKIDOT_TOKEN7,
} from './amc-config';
import { AMCHeader } from './amc-header';
import { type AMCRequestBody, type AMCResponse, amcResponseSchema } from './amc-types';

/**
 * Mask sensitive information (for logging)
 * @param body - Request body to mask
 * @returns Masked body
 */
export function maskSensitiveData(body: AMCRequestBody): Record<string, unknown> {
  const masked = { ...body };
  const sensitiveKeys = ['password', 'login', 'WIKIDOT_SESSION_ID', 'wikidot_token7'];
  for (const key of sensitiveKeys) {
    if (key in masked) {
      masked[key] = '***MASKED***';
    }
  }
  return masked;
}

/**
 * Calculate exponential backoff interval (with jitter)
 * @param retryCount - Current retry count (starts from 1)
 * @param baseInterval - Base interval (milliseconds)
 * @param backoffFactor - Backoff factor
 * @param maxBackoff - Maximum backoff interval (milliseconds)
 * @returns Calculated backoff interval (milliseconds)
 */
function calculateBackoff(
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
 * Sleep for specified duration
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * AMC request options
 */
export interface AMCRequestOptions {
  /** Site name (default: www) */
  siteName?: string;
  /** SSL support (auto-detected if omitted) */
  sslSupported?: boolean;
  /** Include errors in results instead of throwing (default: false) */
  returnExceptions?: boolean;
}

/**
 * Ajax Module Connector client
 * Manages requests to Wikidot AMC endpoint
 */
export class AMCClient {
  /** ky instance */
  private readonly ky: KyInstance;

  /** Concurrent request limiter */
  private readonly limit: LimitFunction;

  /** Header manager */
  public readonly header: AMCHeader;

  /** Configuration */
  public readonly config: AMCConfig;

  /** Base domain */
  public readonly domain: string;

  /** SSL support status cache */
  private sslCache: Map<string, boolean> = new Map();

  /**
   * @param config - AMC configuration (uses defaults if omitted)
   * @param domain - Base domain (default: wikidot.com)
   */
  constructor(config: Partial<AMCConfig> = {}, domain = 'wikidot.com') {
    this.config = { ...DEFAULT_AMC_CONFIG, ...config };
    this.domain = domain;
    this.header = new AMCHeader();
    this.limit = pLimit(this.config.semaphoreLimit);

    this.ky = ky.create({
      timeout: this.config.timeout,
      retry: 0, // Manual retry control
    });

    // www always supports SSL
    this.sslCache.set('www', true);
  }

  /**
   * Check site existence and SSL support status
   * @param siteName - Site name
   * @returns SSL support status (true: HTTPS, false: HTTP)
   */
  checkSiteSSL(siteName: string): WikidotResultAsync<boolean> {
    // Return cached value if exists
    const cached = this.sslCache.get(siteName);
    if (cached !== undefined) {
      return wdOkAsync(cached);
    }

    // www always supports SSL
    if (siteName === 'www') {
      return wdOkAsync(true);
    }

    return fromPromise(
      (async () => {
        const response = await fetch(`http://${siteName}.${this.domain}`, {
          method: 'GET',
          redirect: 'manual',
        });

        // 404 means site does not exist
        if (response.status === 404) {
          throw new NotFoundException(`Site is not found: ${siteName}.${this.domain}`);
        }

        // SSL supported if 301 redirect to https
        const isSSL =
          response.status === 301 && response.headers.get('Location')?.startsWith('https') === true;

        // Save to cache
        this.sslCache.set(siteName, isSSL);
        return isSSL;
      })(),
      (error) => {
        if (error instanceof WikidotError) {
          return error;
        }
        return new UnexpectedError(`Failed to check SSL for ${siteName}: ${String(error)}`);
      }
    );
  }

  /**
   * Execute AMC request
   * @param bodies - Request body array
   * @param siteName - Site name (default: www)
   * @param sslSupported - SSL support (auto-detected if omitted)
   * @returns Response array
   */
  request(
    bodies: AMCRequestBody[],
    siteName = 'www',
    sslSupported?: boolean
  ): WikidotResultAsync<AMCResponse[]> {
    return this.requestWithOptions(bodies, {
      siteName,
      sslSupported,
      returnExceptions: false,
    }) as WikidotResultAsync<AMCResponse[]>;
  }

  /**
   * Execute AMC request (with options)
   * @param bodies - Request body array
   * @param options - Request options
   * @returns Response array (includes errors if returnExceptions is true)
   */
  requestWithOptions(
    bodies: AMCRequestBody[],
    options: AMCRequestOptions = {}
  ): WikidotResultAsync<(AMCResponse | WikidotError)[]> {
    const { siteName = 'www', sslSupported, returnExceptions = false } = options;

    return fromPromise(
      (async () => {
        // Get SSL support status
        let ssl = sslSupported;
        if (ssl === undefined) {
          const sslResult = await this.checkSiteSSL(siteName);
          if (sslResult.isErr()) {
            throw sslResult.error;
          }
          ssl = sslResult.value;
        }

        const protocol = ssl ? 'https' : 'http';
        const url = `${protocol}://${siteName}.${this.domain}/ajax-module-connector.php`;

        // Execute requests in parallel
        const results = await Promise.all(
          bodies.map((body) => this.limit(() => this.singleRequest(body, url)))
        );

        if (returnExceptions) {
          // Return all results including errors
          return results.map((r) => {
            if (r.isOk()) {
              return r.value;
            }
            return r.error;
          });
        }

        // Throw first error if any
        const firstError = results.find((r) => r.isErr());
        if (firstError?.isErr()) {
          throw firstError.error;
        }

        return results.map((r) => {
          if (r.isOk()) {
            return r.value;
          }
          throw new UnexpectedError('Unexpected error in result processing');
        });
      })(),
      (error) => {
        if (error instanceof WikidotError) {
          return error;
        }
        return new UnexpectedError(`AMC request failed: ${String(error)}`);
      }
    );
  }

  /**
   * Internal method to execute a single request
   * @param body - Request body
   * @param url - Request URL
   * @returns Response
   */
  private async singleRequest(
    body: AMCRequestBody,
    url: string
  ): Promise<WikidotResultAsync<AMCResponse>> {
    let retryCount = 0;

    while (true) {
      try {
        // Add wikidot_token7
        const requestBody = { ...body, wikidot_token7: WIKIDOT_TOKEN7 };

        // Create URL-encoded body
        const formData = new URLSearchParams();
        for (const [key, value] of Object.entries(requestBody)) {
          if (value !== undefined) {
            formData.append(key, String(value));
          }
        }

        const response = await this.ky.post(url, {
          headers: this.header.getHeaders(),
          body: formData.toString(),
        });

        // Parse as JSON
        let responseData: unknown;
        const responseText = await response.text();
        try {
          responseData = JSON.parse(responseText);
        } catch {
          // Retry on JSON parse error (e.g., empty response)
          retryCount++;
          if (retryCount >= this.config.retryLimit) {
            return wdErrAsync(
              new ResponseDataError(`AMC responded with non-JSON data: ${responseText}`)
            );
          }
          const backoff = calculateBackoff(
            retryCount,
            this.config.retryInterval,
            this.config.backoffFactor,
            this.config.maxBackoff
          );
          await sleep(backoff);
          continue;
        }

        // Validate with zod
        const parseResult = amcResponseSchema.safeParse(responseData);
        if (!parseResult.success) {
          return wdErrAsync(
            new ResponseDataError(`Invalid AMC response format: ${parseResult.error.message}`)
          );
        }

        const amcResponse = parseResult.data;

        // Retry if try_again
        if (amcResponse.status === 'try_again') {
          retryCount++;
          if (retryCount >= this.config.retryLimit) {
            return wdErrAsync(new WikidotStatusError('AMC responded with try_again', 'try_again'));
          }
          const backoff = calculateBackoff(
            retryCount,
            this.config.retryInterval,
            this.config.backoffFactor,
            this.config.maxBackoff
          );
          await sleep(backoff);
          continue;
        }

        // ForbiddenError if no_permission
        if (amcResponse.status === 'no_permission') {
          const targetStr = body.moduleName
            ? `moduleName: ${body.moduleName}`
            : body.action
              ? `action: ${body.action}/${body.event ?? ''}`
              : 'unknown';
          return wdErrAsync(
            new ForbiddenError(
              `Your account has no permission to perform this action: ${targetStr}`
            )
          );
        }

        // Error if status is not ok
        if (amcResponse.status !== 'ok') {
          return wdErrAsync(
            new WikidotStatusError(
              `AMC responded with error status: "${amcResponse.status}"`,
              amcResponse.status
            )
          );
        }

        return wdOkAsync(amcResponse);
      } catch (error) {
        // Retry on all errors (HTTP errors, network errors, timeouts, etc.)
        // Wikidot server has a relatively high error rate, so retry is essential
        retryCount++;
        if (retryCount >= this.config.retryLimit) {
          const statusCode =
            error instanceof Error && 'response' in error
              ? ((error as { response?: { status?: number } }).response?.status ??
                DEFAULT_HTTP_STATUS_CODE)
              : DEFAULT_HTTP_STATUS_CODE;
          return wdErrAsync(new AMCHttpError(`AMC request failed: ${String(error)}`, statusCode));
        }

        const backoff = calculateBackoff(
          retryCount,
          this.config.retryInterval,
          this.config.backoffFactor,
          this.config.maxBackoff
        );
        await sleep(backoff);
      }
    }
  }
}
