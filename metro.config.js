// Metro config: Expo defaults plus WebAssembly assets, which expo-sqlite's web build (wa-sqlite) loads.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');

// expo-sqlite on the web needs SharedArrayBuffer, which browsers only allow on a cross-origin
// isolated page. The dev server needs the same headers that public/_headers sets in production.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  return middleware(req, res, next);
};

module.exports = config;
