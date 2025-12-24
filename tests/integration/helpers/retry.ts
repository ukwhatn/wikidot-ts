/**
 * リトライ付き検証ヘルパー
 *
 * Wikidot APIのeventual consistencyを考慮し、
 * 期待する条件が満たされるまでリトライを行うためのヘルパー
 */

/**
 * 条件が満たされるまでリトライする
 * @param fn - 値を取得する関数
 * @param predicate - 条件を判定する関数
 * @param maxRetries - 最大リトライ回数（デフォルト: 10）
 * @param interval - リトライ間隔（ミリ秒、デフォルト: 2000）
 * @returns 条件を満たした値
 * @throws 条件を満たさないままリトライ上限に達した場合
 */
export async function waitForCondition<T>(
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  maxRetries = 10,
  interval = 2000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((resolve) => setTimeout(resolve, interval));
    const value = await fn();
    if (predicate(value)) {
      return value;
    }
  }
  throw new Error(`Condition not met after ${maxRetries} retries`);
}
