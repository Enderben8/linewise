// Expo's web export puts library assets (the SQLite WebAssembly, icon fonts) under
// assets/node_modules/, and Cloudflare Pages does not upload any folder called node_modules.
// This moves them to assets/vendor/ and rewrites the paths in the built files.
//
// Bundles in _expo/static are named after the md5 of their contents and cached as immutable
// (public/_headers), so a bundle this script edits must get a new name as well. Otherwise a browser
// that cached the old file keeps running it: v1.1.1 kept the SQLite worker's name, and browsers that
// had opened v1.1.0 went on asking for the old wasm path.
//   node scripts/fix-web-assets.js [dist=dist-web]
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** A content-hashed bundle name, e.g. worker-b36109bac7e9563f3516b55579e07737.js. */
const HASHED = /^(.+)-([0-9a-f]{32})\.(js|css)$/;

const md5 = (file) => crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|html|json|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Makes each [from, to] replacement in every built text file. Returns how many files changed. */
function replaceInFiles(dist, pairs) {
  let changed = 0;
  for (const file of walk(dist)) {
    const text = fs.readFileSync(file, 'utf8');
    let next = text;
    for (const [from, to] of pairs) next = next.split(from).join(to);
    if (next === text) continue;
    fs.writeFileSync(file, next);
    changed++;
  }
  return changed;
}

/** Renames every bundle whose contents no longer match its name. Returns the [old, new] names. */
function renameChangedBundles(dist) {
  const renamed = [];
  // Renaming a bundle edits the files that load it, which may be bundles too (the entry loads the
  // SQLite worker), so repeat until every name matches.
  for (let round = 0; round < 10; round++) {
    const pairs = [];
    for (const file of walk(path.join(dist, '_expo'))) {
      const m = HASHED.exec(path.basename(file));
      const hash = m && md5(file);
      if (!m || hash === m[2]) continue;
      const name = `${m[1]}-${hash}.${m[3]}`;
      fs.renameSync(file, path.join(path.dirname(file), name));
      pairs.push([path.basename(file), name]);
    }
    if (!pairs.length) return renamed;
    replaceInFiles(dist, pairs);
    renamed.push(...pairs);
  }
  throw new Error('Bundle names did not settle; do two bundles load each other?');
}

function fixWebAssets(dist) {
  const from = path.join(dist, 'assets', 'node_modules');
  const to = path.join(dist, 'assets', 'vendor');
  if (fs.existsSync(from)) {
    fs.rmSync(to, { recursive: true, force: true });
    fs.renameSync(from, to);
    const files = replaceInFiles(dist, [['/assets/node_modules/', '/assets/vendor/']]);
    console.log(`Moved assets/node_modules to assets/vendor and rewrote ${files} file(s).`);
  } else {
    console.log('No assets/node_modules folder; nothing to move.');
  }
  for (const [before, after] of renameChangedBundles(dist)) {
    console.log(`Renamed ${before} to ${after}.`);
  }
}

module.exports = { fixWebAssets };

if (require.main === module) {
  fixWebAssets(path.resolve(process.argv[2] || 'dist-web'));
}
