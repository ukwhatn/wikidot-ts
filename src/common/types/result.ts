import { err, errAsync, ok, okAsync, type Result, ResultAsync } from 'neverthrow';
import type { WikidotError } from '../errors';

/** Synchronous Result type alias */
export type WikidotResult<T> = Result<T, WikidotError>;

/** Asynchronous Result type alias */
export type WikidotResultAsync<T> = ResultAsync<T, WikidotError>;

/** Create success Result */
export const wdOk = <T>(value: T): WikidotResult<T> => ok(value);

/** Create error Result */
export const wdErr = <E extends WikidotError>(error: E): WikidotResult<never> => err(error);

/** Create success ResultAsync */
export const wdOkAsync = <T>(value: T): WikidotResultAsync<T> => okAsync(value);

/** Create error ResultAsync */
export const wdErrAsync = <E extends WikidotError>(error: E): WikidotResultAsync<never> =>
  errAsync(error);

/** Convert from Promise */
export const fromPromise = <T>(
  promise: Promise<T>,
  errorMapper: (error: unknown) => WikidotError
): WikidotResultAsync<T> => ResultAsync.fromPromise(promise, errorMapper);

/** Combine multiple ResultAsync */
export const combineResults = <T>(results: WikidotResultAsync<T>[]): WikidotResultAsync<T[]> =>
  ResultAsync.combine(results);
