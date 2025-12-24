/**
 * Retry verification helper
 *
 * Helper for retrying until expected conditions are met,
 * considering Wikidot API's eventual consistency
 */

/**
 * Retry until condition is met
 * @param fn - Function to get value
 * @param predicate - Function to check condition
 * @param maxRetries - Maximum retry count (default: 10)
 * @param interval - Retry interval in milliseconds (default: 2000)
 * @returns Value that satisfies the condition
 * @throws When retry limit reached without satisfying condition
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
