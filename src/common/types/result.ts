import { err, errAsync, ok, okAsync, type Result, ResultAsync } from 'neverthrow';
import type { WikidotError } from '../errors';

/** 同期Result型エイリアス */
export type WikidotResult<T> = Result<T, WikidotError>;

/** 非同期Result型エイリアス */
export type WikidotResultAsync<T> = ResultAsync<T, WikidotError>;

/** 成功Resultを生成 */
export const wdOk = <T>(value: T): WikidotResult<T> => ok(value);

/** エラーResultを生成 */
export const wdErr = <E extends WikidotError>(error: E): WikidotResult<never> => err(error);

/** 成功ResultAsyncを生成 */
export const wdOkAsync = <T>(value: T): WikidotResultAsync<T> => okAsync(value);

/** エラーResultAsyncを生成 */
export const wdErrAsync = <E extends WikidotError>(error: E): WikidotResultAsync<never> =>
  errAsync(error);

/** Promiseからの変換 */
export const fromPromise = <T>(
  promise: Promise<T>,
  errorMapper: (error: unknown) => WikidotError
): WikidotResultAsync<T> => ResultAsync.fromPromise(promise, errorMapper);

/** 複数ResultAsyncの結合 */
export const combineResults = <T>(results: WikidotResultAsync<T>[]): WikidotResultAsync<T[]> =>
  ResultAsync.combine(results);
