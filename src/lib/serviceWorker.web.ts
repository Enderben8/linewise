import i18n from '../i18n';
import { confirmAction } from './dialog';

const HOUR = 60 * 60 * 1000;

/**
 * Registers the service worker that `npm run build:web` generates, so the installed web app opens
 * with no connection. Skipped in development, where the dev server has no sw.js.
 *
 * This is also how the web app updates itself: the browser fetches a new sw.js from the site, which
 * installs the new version and takes over the page. The page is still running the old code, so it
 * offers a reload. A tab left open is checked again when it comes back into view, at most hourly.
 */
export function registerServiceWorker(): void {
  if (__DEV__ || !('serviceWorker' in navigator)) return;
  // The first service worker to take control is the app being installed, not updated.
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) {
      controlled = true;
      return;
    }
    confirmAction({
      title: i18n.t('updates.readyTitle'),
      message: i18n.t('updates.readyBody'),
      confirmLabel: i18n.t('updates.reload'),
      cancelLabel: i18n.t('updates.notNow'),
    }).then((reload) => {
      if (reload) window.location.reload();
    });
  });
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      let checkedAt = Date.now();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || Date.now() - checkedAt < HOUR) return;
        checkedAt = Date.now();
        registration.update().catch(() => {});
      });
    })
    .catch(() => {});
}
