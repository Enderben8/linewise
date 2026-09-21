// Lists every translation key used in the source. Dynamic keys (template strings) contain ${...}.
// Run directly to print them, or require() it for extractKeys().
const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.expo', 'android', 'locales'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

function extractKeys() {
  const root = path.join(__dirname, '..');
  const files = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'src'))];
  const keys = new Set();
  const re = /\bt\(\s*(['"`])([^'"`]+)\1/g;
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = re.exec(src))) keys.add(m[2]);
  }
  return [...keys].sort();
}

module.exports = { extractKeys };

if (require.main === module) console.log(extractKeys().join('\n'));
