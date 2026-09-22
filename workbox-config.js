// Service worker for the web app: `npx workbox generateSW workbox-config.js` after `expo export`.
// The app shell is precached so Linewise opens with no connection. Text recognition files (~29 MB)
// are cached the first time the scan screen uses them instead of on every install.
module.exports = {
  globDirectory: 'dist-web/',
  globPatterns: ['**/*.{html,js,wasm,css,png,ico,ttf,json,webmanifest}'],
  globIgnores: ['ocr/**', 'sw.js'],
  // The JavaScript bundle and SQLite's WebAssembly are larger than Workbox's 2 MB default.
  maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
  swDest: 'dist-web/sw.js',
  // Bundle the Workbox runtime into sw.js so nothing is loaded from a CDN.
  inlineWorkboxRuntime: true,
  sourcemap: false,
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/ocr\//],
  clientsClaim: true,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  runtimeCaching: [
    {
      urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/ocr/'),
      handler: 'CacheFirst',
      options: { cacheName: 'linewise-ocr' },
    },
  ],
};
