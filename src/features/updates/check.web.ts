import type { AvailableUpdate } from './version';

/**
 * The web app does not ask GitHub: its service worker fetches each new version from the site and
 * then offers a reload (src/lib/serviceWorker.web.ts).
 */
export const UPDATE_CHECK_SUPPORTED = false;

export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  return null;
}
