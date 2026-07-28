import * as cheerio from 'cheerio';
import ky, { isHTTPError, type KyInstance } from 'ky';
import pLimit, { type LimitFunction } from 'p-limit';
import {
  AMCHttpError,
  ForbiddenError,
  FormErrorsError,
  NotFoundException,
  ResponseDataError,
  UnexpectedError,
  WikidotError,
  WikidotStatusError,
} from '../common/errors';
import { fromPromise, type WikidotResultAsync, wdErrAsync, wdOkAsync } from '../common/types';
import { fetchWithRetry } from '../util/http';
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
 * Ensure an AMC response carries a `body` field, throwing `ResponseDataError` if not.
 *
 * An unknown `moduleName` doesn't error at the AMC layer — Wikidot just returns
 * `{"status":"ok"}` with no `body` — so a typo in a module path would otherwise silently
 * produce an empty parse result instead of a clear failure. Callers that need `body`
 * should route through this instead of reading `response.body` directly.
 * @param response - AMC response (or undefined, e.g. a missing array element)
 * @param moduleName - Module name/path (or action/event) used in the request, for the error message
 * @returns The response body
 * @throws ResponseDataError if `response` or `response.body` is missing
 */
export function requireBody(response: AMCResponse | undefined, moduleName: string): string {
  if (response === undefined || response.body === undefined) {
    throw new ResponseDataError(
      `AMC response for "${moduleName}" is missing "body" (module may not exist)`
    );
  }
  return response.body;
}

/**
 * Parse the HTML fragment returned by /default--flow/files__UploadTarget
 *
 * UNVERIFIED AGAINST A LIVE WIKIDOT INSTANCE. This endpoint does not
 * respond with the usual AMC JSON envelope; per 10_transport.md (wire
 * format research based on reading Wikidot's client-side JS, not an
 * observed live upload) it returns an HTML fragment of the shape
 * `<div id="status">ok</div><div id="message">..</div><div id="filename">..</div>`.
 * @param html - Raw response body
 * @returns Values keyed by "status" / "message" / "filename", for
 * whichever of those elements were present in the response
 */
export function parseUploadTargetResponse(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const result: Record<string, string> = {};
  for (const key of ['status', 'message', 'filename']) {
    const elem = $(`#${key}`);
    if (elem.length > 0) {
      result[key] = elem.text().trim();
    }
  }
  return result;
}

/**
 * Resolve the backoff duration for a `try_again` response.
 * Honors the server-supplied `time_to_wait` (seconds) when present, falling back to
 * exponential backoff otherwise. The server value is still capped by `maxBackoff` so a
 * misbehaving/hostile response can't force an unbounded wait.
 * @param response - AMC response with status `try_again`
 * @param retryCount - Current retry count (starts from 1)
 * @param config - AMC configuration
 * @returns Backoff duration in milliseconds
 */
function resolveTryAgainBackoff(
  response: AMCResponse,
  retryCount: number,
  config: AMCConfig
): number {
  const timeToWait = response.time_to_wait;
  if (typeof timeToWait === 'number' && Number.isFinite(timeToWait) && timeToWait >= 0) {
    return Math.min(timeToWait * 1000, config.maxBackoff);
  }
  return calculateBackoff(
    retryCount,
    config.retryInterval,
    config.backoffFactor,
    config.maxBackoff
  );
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
        const response = await fetchWithRetry(`http://${siteName}.${this.domain}`, this.config, {
          method: 'GET',
          redirect: 'manual',
          checkOk: false, // Don't retry on HTTP errors (301 is expected)
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
        // Arrays are expanded to key[]=v1&key[]=v2, matching jQuery.param's bracket
        // notation (the format the Wikidot frontend actually sends).
        const formData = new URLSearchParams();
        for (const [key, value] of Object.entries(requestBody)) {
          if (value === undefined) {
            continue;
          }
          if (Array.isArray(value)) {
            for (const item of value) {
              formData.append(`${key}[]`, String(item));
            }
            continue;
          }
          formData.append(key, String(value));
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
            return wdErrAsync(
              new WikidotStatusError('AMC responded with try_again', 'try_again', amcResponse)
            );
          }
          const backoff = resolveTryAgainBackoff(amcResponse, retryCount, this.config);
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
          // form_errors / form_error carry validation payloads (formErrors / errors / message)
          // that callers need to inspect, so surface them via a dedicated subclass.
          if (amcResponse.status === 'form_errors' || amcResponse.status === 'form_error') {
            return wdErrAsync(
              new FormErrorsError(
                `AMC responded with error status: "${amcResponse.status}"`,
                amcResponse.status,
                amcResponse
              )
            );
          }
          return wdErrAsync(
            new WikidotStatusError(
              `AMC responded with error status: "${amcResponse.status}"`,
              amcResponse.status,
              amcResponse
            )
          );
        }

        return wdOkAsync(amcResponse);
      } catch (error) {
        // Fail fast on an unknown action/event: Wikidot returns HTTP 500 with an empty
        // (0-byte, not even JSON) body when `action` is set but the event doesn't exist
        // server-side. This isn't a transient failure, so retrying just wastes cycles.
        // ky consumes the body while populating `error.data`, so Content-Length is the
        // only reliable way left to check "empty" here.
        if (isHTTPError(error) && error.response.status === 500 && body.action) {
          const contentLength = error.response.headers.get('content-length');
          const isEmptyBody = contentLength === '0' || (contentLength === null && !error.data);
          if (isEmptyBody) {
            return wdErrAsync(
              new AMCHttpError(
                `AMC responded with HTTP 500 and an empty body for action "${body.action}"` +
                  `/"${body.event ?? ''}" (likely an unsupported action/event)`,
                500
              )
            );
          }
        }

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

  /**
   * Upload a file to a page via the multipart upload endpoint
   *
   * UNVERIFIED AGAINST A LIVE WIKIDOT INSTANCE. This is a separate wire
   * path from `request()`: it posts multipart/form-data to
   * `/default--flow/files__UploadTarget` (not ajax-module-connector.php)
   * and gets back an HTML fragment, not the usual AMC JSON envelope, so it
   * cannot go through `request()`'s JSON parsing. The endpoint, parameters
   * (`action=FileAction`, `event=uploadFile`, `page_id`,
   * `source=multiflash`, `multikey?`, file under the `userfile` field),
   * and response shape were all determined by reading Wikidot's
   * client-side JS, not by observing a real upload -- see 30_plan.md D8
   * and 32_tasks.md Task 3-5b in the sibling wikidot.py repo's memory
   * directory. Confirm against a real site before relying on this for
   * anything important.
   * @param options - pageId: target page. filename: file name as it will
   * appear on the page. content: file content. siteName: target site
   * (default: this client's configured site). siteSslSupported: whether
   * the site supports SSL. multikey: multi-file upload session key,
   * required by FileAction/multiUploadComplete when uploading more than
   * one file in the same batch
   * @returns Parsed response fields among "status" / "message" / "filename"
   */
  uploadFile(options: {
    pageId: number;
    filename: string;
    content: Uint8Array | Blob;
    siteName?: string;
    siteSslSupported?: boolean;
    multikey?: string;
  }): WikidotResultAsync<Record<string, string>> {
    return fromPromise(
      (async () => {
        const siteSslSupported = options.siteSslSupported ?? true;
        const protocol = siteSslSupported ? 'https' : 'http';
        const siteName = options.siteName ?? 'www';
        const url = `${protocol}://${siteName}.${this.domain}/default--flow/files__UploadTarget`;

        const formData = new FormData();
        formData.append('action', 'FileAction');
        formData.append('event', 'uploadFile');
        formData.append('page_id', String(options.pageId));
        formData.append('source', 'multiflash');
        formData.append('wikidot_token7', WIKIDOT_TOKEN7);
        if (options.multikey !== undefined) {
          formData.append('multikey', options.multikey);
        }
        const blob =
          options.content instanceof Blob ? options.content : new Blob([options.content]);
        formData.append('userfile', blob, options.filename);

        // Content-Type must come from FormData's own multipart boundary,
        // not the AMC header's form-urlencoded default.
        const { 'Content-Type': _omitted, ...headers } = this.header.getHeaders();

        const response = await this.ky.post(url, {
          headers,
          body: formData,
        });
        const text = await response.text();
        return parseUploadTargetResponse(text);
      })(),
      (error) =>
        error instanceof WikidotError
          ? error
          : new UnexpectedError(`Upload failed: ${String(error)}`)
    );
  }
}
