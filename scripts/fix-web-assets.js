// Expo's web export puts library assets (the SQLite WebAssembly, icon fonts) under
// assets/node_modules/, and Cloudflare Pages does not upload any folder called node_modules.
// This moves them to assets/vendor/ and rewrites the paths in the built files.
//   node scripts/fix-web-assets.js [dist=dist-web]
const fs = require('fs');
const path = require('path');

const dist = path.resolve(process.argv[2] || 'dist-web');
const from = path.join(dist, 'assets', 'node_modules');
const to = path.join(dist, 'assets', 'vendor');

if (!fs.existsSync(from)) {
  console.log('No assets/node_modules folder; nothing to move.');
  process.exit(0);
}
fs.rmSync(to, { recursive: true, force: true });
fs.renameSync(from, to);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|html|json|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

let files = 0;
for (const file of walk(dist)) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('/assets/node_modules/')) continue;
  fs.writeFileSync(file, text.split('/assets/node_modules/').join('/assets/vendor/'));
  files++;
}
console.log(`Moved assets/node_modules to assets/vendor and rewrote ${files} file(s).`);
