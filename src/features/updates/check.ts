import { APP } from '../../config';
import { parseRelease, type AvailableUpdate } from './version';

/** The Android app asks GitHub for new releases. The web app updates itself; see check.web.ts. */
export const UPDATE_CHECK_SUPPORTED = true;

/**
 * Asks GitHub for the newest release: the app's only network request (SPEC.md §10). Resolves null
 * when this is the newest version, and rejects when GitHub cannot be reached.
 */
export async function checkForUpdate(current: string): Promise<AvailableUpdate | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 15_000);
  try {
    const res = await fetch(APP.releasesApiUrl, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: abort.signal,
    });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    return parseRelease(await res.json(), current, APP.releasesSite);
  } finally {
    clearTimeout(timer);
  }
}
