// Serves a built web app the way Cloudflare Pages will: the headers from public/_headers (cross-origin
// isolation for expo-sqlite, the Content-Security-Policy) and index.html for unknown paths.
//   node scripts/serve-web.js [dir=dist-web] [port=8081]
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || 'dist-web');
const port = Number(process.argv[3] || 8081);

/** Parses Cloudflare's _headers format: a path pattern line, then indented `Name: value` lines. */
function readHeaderRules(file) {
  const rules = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) rules.push({ pattern: line.trim(), headers: {} });
    else if (rules.length) {
      const i = line.indexOf(':');
      rules[rules.length - 1].headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return rules;
}

function matches(pattern, url) {
  return pattern.endsWith('*') ? url.startsWith(pattern.slice(0, -1)) : url === pattern;
}

const headerRules = readHeaderRules(path.join(__dirname, '..', 'public', '_headers'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.traineddata': 'application/octet-stream',
  '.gz': 'application/gzip',
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.join(root, url);
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const asIndex = path.join(file, 'index.html');
      file = fs.existsSync(asIndex) ? asIndex : path.join(root, 'index.html');
    }
    const headers = {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    };
    for (const rule of headerRules) {
      if (matches(rule.pattern, url)) Object.assign(headers, rule.headers);
    }
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`));
