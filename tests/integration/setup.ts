/**
 * Integration test setup
 */

/**
 * Test configuration
 */
export const TEST_CONFIG = {
  siteUnixName: 'ukwhatn-ci',
  username: process.env.WIKIDOT_USERNAME,
  password: process.env.WIKIDOT_PASSWORD,
} as const;

/**
 * Check if credentials are configured
 */
export function hasCredentials(): boolean {
  return Boolean(TEST_CONFIG.username && TEST_CONFIG.password);
}

/**
 * Require credentials to be set
 * @throws Error if credentials are not configured
 */
export function requireCredentials(): void {
  if (!hasCredentials()) {
    throw new Error('WIKIDOT_USERNAME and WIKIDOT_PASSWORD environment variables are required');
  }
}

/**
 * Check if integration tests should be skipped
 */
export function shouldSkipIntegration(): boolean {
  return !hasCredentials();
}
