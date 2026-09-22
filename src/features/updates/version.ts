/** Version numbers and GitHub release data for the update check. No network access here. */

/** Parses "v1.2.3" or "1.2.3" into [1, 2, 3]. A pre-release suffix ("-rc.1") is ignored. */
export function parseVersion(text: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(text.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** True when `candidate` is a later version than `current`. False if either cannot be read. */
export function isNewer(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

export interface AvailableUpdate {
  /** For example "1.2.0". */
  version: string;
  /** The release's APK, or its page on GitHub when it has none. */
  url: string;
}

/** The parts of GitHub's "latest release" reply that the check reads. */
export interface Release {
  tag_name?: unknown;
  html_url?: unknown;
  assets?: { name?: unknown; browser_download_url?: unknown }[];
}

/**
 * Returns the release as an update when it is newer than `current`. `site` is where downloads must
 * come from, so a reply can never make the app open some other address.
 */
export function parseRelease(
  release: Release,
  current: string,
  site: string,
): AvailableUpdate | null {
  const version = typeof release.tag_name === 'string' ? parseVersion(release.tag_name) : null;
  if (!version || !isNewer(release.tag_name as string, current)) return null;
  const apk = release.assets?.find((a) => typeof a.name === 'string' && a.name.endsWith('.apk'));
  const url = apk?.browser_download_url ?? release.html_url;
  if (typeof url !== 'string' || !url.startsWith(site)) return null;
  return { version: version.join('.'), url };
}
