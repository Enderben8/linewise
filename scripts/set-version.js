// Stamps a release tag into app.json before building:  node scripts/set-version.js v1.2.3
// versionName = 1.2.3, versionCode = major*10000 + minor*100 + patch (always increases with the tag).
const fs = require('fs');
const path = require('path');

function parseTag(tag) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(tag || '');
  if (!m) throw new Error(`Not a version tag like v1.2.3: "${tag}"`);
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (minor > 99 || patch > 99)
    throw new Error('minor and patch must be 0-99 to fit the version code');
  return { name: `${major}.${minor}.${patch}`, code: major * 10000 + minor * 100 + patch };
}

module.exports = { parseTag };

if (require.main === module) {
  const { name, code } = parseTag(process.argv[2]);
  const file = path.join(__dirname, '..', 'app.json');
  const app = JSON.parse(fs.readFileSync(file, 'utf8'));
  app.expo.version = name;
  app.expo.android.versionCode = code;
  fs.writeFileSync(file, JSON.stringify(app, null, 2) + '\n');
  console.log(`versionName ${name}, versionCode ${code}`);
}
