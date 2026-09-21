/**
 * Text shared from another app arrives as linewise://dataUrl=... Route it to the home redirect;
 * the root layout reads the shared text through expo-share-intent and opens the Add screen.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.includes('dataUrl=')) return '/';
  return path;
}
