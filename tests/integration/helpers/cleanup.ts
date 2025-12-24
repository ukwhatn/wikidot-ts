/**
 * Cleanup utilities
 */
import type { Site } from '../../../src';

/**
 * Safely delete page
 */
export async function safeDeletePage(site: Site, fullname: string): Promise<void> {
  try {
    const pageResult = await site.page.get(fullname);
    if (pageResult.isOk() && pageResult.value) {
      await pageResult.value.destroy();
    }
  } catch {
    // Ignore deletion failure (may not exist)
  }
}
