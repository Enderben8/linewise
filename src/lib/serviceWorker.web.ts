/**
 * Registers the service worker that `npm run build:web` generates, so the installed web app opens
 * with no connection. Skipped in development, where the dev server has no sw.js.
 */
export function registerServiceWorker(): void {
  if (__DEV__ || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
