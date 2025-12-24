/**
 * Random page name generation for testing
 */

/**
 * Generate random page name for testing
 * Format: {prefix}-{timestamp}-{random6chars}
 * Example: test-1703404800000-abc123
 */
export function generatePageName(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}
