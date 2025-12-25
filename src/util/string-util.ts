/**
 * String utilities
 */

import { specialCharMap } from './table/char-table';

/**
 * Convert string to Unix format
 *
 * Performs conversion following legacy wikidot implementation.
 * - Converts special characters to ASCII characters
 * - Converts to lowercase
 * - Converts non-ASCII characters to hyphens
 * - Reduces consecutive hyphens/colons to single
 * - Removes leading/trailing hyphens/colons
 *
 * @param targetStr - String to convert
 * @returns Converted string
 */
export function toUnix(targetStr: string): string {
  // Convert special characters
  let result = '';
  for (const char of targetStr) {
    const mapped = specialCharMap[char];
    result += mapped !== undefined ? mapped : char;
  }

  // Convert to lowercase
  result = result.toLowerCase();

  // Remove non-ASCII characters
  result = result.replace(/[^a-z0-9\-:_]/g, '-');
  result = result.replace(/^_/, ':_');
  result = result.replace(/(?<!:)_/g, '-');
  result = result.replace(/^-*/, '');
  result = result.replace(/-*$/, '');
  result = result.replace(/-{2,}/g, '-');
  result = result.replace(/:{2,}/g, ':');
  result = result.replace(/:-/g, ':');
  result = result.replace(/-:/g, ':');
  result = result.replace(/_-/g, '_');
  result = result.replace(/-_/g, '_');

  // Remove leading and trailing colons
  result = result.replace(/^:/, '');
  result = result.replace(/:$/, '');

  return result;
}

/**
 * StringUtil class (Python compatible)
 */
export const StringUtil = {
  toUnix,
};
