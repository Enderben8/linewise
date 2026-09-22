// Guards SPEC.md §1 rule 3: the app is fully offline.
//   node scripts/check-offline.js                 static checks on dependencies, source and app.json
//   node scripts/check-offline.js --apk app.apk   also fails if the built APK requests INTERNET
//   node scripts/check-offline.js --web dist-web  also checks the web build and its Content-Security-Policy
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');

// Packages that talk to a server, or exist only to. None may be a dependency.
const DENIED_DEPENDENCIES = [
  /^firebase/,
  /^@react-native-firebase\//,
  /^@sentry\//,
  /^sentry-/,
  /^@supabase\//,
  /^@apollo\//,
  /^axios$/,
  /^socket\.io/,
  /^react-native-purchases/,
  /^react-native-google-mobile-ads/,
  /^expo-ads/,
  /^expo-updates$/,
  /^expo-analytics/,
  /^expo-tracking-transparency$/,
  /amplitude|mixpanel|segment|posthog|appsflyer|onesignal|bugsnag|datadog|instabug/i,
];

// Calls that reach the network.
const DENIED_CODE = [
  { re: /\bfetch\s*\(/, why: 'fetch()' },
  { re: /\bXMLHttpRequest\b/, why: 'XMLHttpRequest' },
  { re: /\bnew\s+WebSocket\b/, why: 'WebSocket' },
  { re: /\bgetExpoPushTokenAsync\b|\bgetDevicePushTokenAsync\b/, why: 'push token registration' },
  {
    re: /File\.downloadFileAsync|createDownloadTask|\.upload\(|createUploadTask/,
    why: 'file download/upload',
  },
  { re: /\bdownloadAsync\b|\buploadAsync\b/, why: 'file download/upload' },
];

// The one place a web address is allowed: the "report a problem" link, opened in the user's browser.
const ALLOWED_URL_FILES = ['src/config.ts'];

// Reviewed exceptions: file -> rule it may use, and why that use stays on the device.
const ALLOWED_CODE = {
  // fetch() of the recorder's own blob: URL (checked in code) to store it in IndexedDB.
  'src/features/recordings/files.web.ts': ['fetch()'],
};

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.expo', 'android', 'locales', 'e2e'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function staticChecks() {
  const problems = [];

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const name of Object.keys(pkg.dependencies || {})) {
    if (DENIED_DEPENDENCIES.some((re) => re.test(name))) {
      problems.push(`dependency "${name}" talks to the network or an online service`);
    }
  }

  const files = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'src'))];
  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    for (const { re, why } of DENIED_CODE) {
      if ((ALLOWED_CODE[rel] || []).includes(why)) continue;
      if (re.test(src)) problems.push(`${rel}: uses ${why}`);
    }
    if (!ALLOWED_URL_FILES.includes(rel) && /['"`]https?:\/\//.test(src)) {
      problems.push(`${rel}: contains a web address`);
    }
  }

  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  const android = app.android || {};
  if (!(android.blockedPermissions || []).includes('android.permission.INTERNET')) {
    problems.push('app.json must list android.permission.INTERNET in android.blockedPermissions');
  }
  if ((android.permissions || []).includes('android.permission.INTERNET')) {
    problems.push('app.json requests android.permission.INTERNET');
  }
  return problems;
}

function findAapt2() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk) throw new Error('Set ANDROID_HOME so aapt2 can be found');
  const tools = path.join(sdk, 'build-tools');
  const versions = fs.readdirSync(tools).sort().reverse();
  for (const v of versions) {
    for (const name of ['aapt2', 'aapt2.exe']) {
      const p = path.join(tools, v, name);
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error(`aapt2 not found under ${tools}`);
}

function apkPermissions(apk) {
  const out = execFileSync(findAapt2(), ['dump', 'permissions', apk], { encoding: 'utf8' });
  return out
    .split('\n')
    .map((l) => /uses-permission(?:-sdk-\d+)?: name='([^']+)'/.exec(l))
    .filter(Boolean)
    .map((m) => m[1]);
}

/** CSP sources that keep the browser on this site. Anything else (a host, https:, *) is a way out. */
const LOCAL_SOURCES = new Set([
  "'self'",
  "'none'",
  "'unsafe-inline'",
  "'wasm-unsafe-eval'",
  'blob:',
  'data:',
]);

/** Checks the Content-Security-Policy in public/_headers: every fetch directive must stay on-site. */
function cspChecks(headersText) {
  const line = headersText.split(/\r?\n/).find((l) => /^\s+Content-Security-Policy:/i.test(l));
  if (!line) return ['public/_headers has no Content-Security-Policy'];
  const policy = line.slice(line.indexOf(':') + 1).trim();
  const directives = new Map(
    policy
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((d) => d[0])
      .map(([name, ...sources]) => [name.toLowerCase(), sources]),
  );
  const problems = [];
  if (!directives.has('default-src')) problems.push('the CSP needs a default-src');
  if (!directives.has('connect-src')) problems.push('the CSP needs a connect-src');
  for (const [name, sources] of directives) {
    if (!name.endsWith('-src') && name !== 'base-uri' && name !== 'form-action') continue;
    for (const src of sources) {
      if (!LOCAL_SOURCES.has(src)) problems.push(`CSP ${name} allows "${src}"`);
    }
  }
  return problems;
}

/** Checks the web build: every file will be uploaded, and nothing is loaded from a CDN. */
function webBuildChecks(dist) {
  const problems = [];
  // Cloudflare Pages skips node_modules folders, so a file there would be missing on the live site.
  const skipped = fs
    .readdirSync(dist, { recursive: true })
    .map((f) => String(f).split(path.sep).join('/'))
    .filter((f) => f.split('/').includes('node_modules'));
  if (skipped.length) {
    problems.push(`${skipped[0]} is under node_modules, which Cloudflare Pages does not upload`);
  }
  const sw = path.join(dist, 'sw.js');
  if (!fs.existsSync(sw)) {
    problems.push(`${sw} is missing; run workbox generateSW`);
  } else if (/importScripts\([^)]*https?:/.test(fs.readFileSync(sw, 'utf8'))) {
    problems.push('sw.js imports a script from another site');
  }
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  if (/<(script|link)[^>]+(src|href)="https?:/i.test(html)) {
    problems.push('index.html loads a file from another site');
  }
  return problems;
}

module.exports = { staticChecks, apkPermissions, cspChecks };

if (require.main === module) {
  const problems = staticChecks();
  const apkIndex = process.argv.indexOf('--apk');
  if (apkIndex !== -1) {
    const apk = process.argv[apkIndex + 1];
    const perms = apkPermissions(apk);
    console.log(`APK permissions (${perms.length}):\n  ${perms.join('\n  ')}`);
    if (perms.includes('android.permission.INTERNET')) {
      problems.push(`${apk} requests android.permission.INTERNET`);
    }
  }
  problems.push(...cspChecks(fs.readFileSync(path.join(root, 'public', '_headers'), 'utf8')));
  const webIndex = process.argv.indexOf('--web');
  if (webIndex !== -1) problems.push(...webBuildChecks(path.resolve(process.argv[webIndex + 1])));
  if (problems.length) {
    console.error('Offline check failed:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
  console.log('Offline check passed: no network dependencies, calls or INTERNET permission.');
}
