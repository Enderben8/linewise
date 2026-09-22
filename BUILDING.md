# Building Linewise

One codebase produces two things: the **Android APK** and the **web app**. The shared code is plain
TypeScript; where a platform needs something different there is a twin file next to it (`recordings.ts`
and `recordings.web.ts`), and Metro picks the right one. This is the long version for maintainers. The
[README](README.md) has the short commands, and [SPEC.md](SPEC.md) explains what the app does and why.

## What you need

| For                  | What                                                                            |
| -------------------- | ------------------------------------------------------------------------------- |
| Anything             | Node 24 (what CI uses) and npm                                                  |
| The Android app      | JDK 17 or 21, the Android SDK with `ANDROID_HOME` set (Gradle fetches the rest) |
| The web app          | Nothing beyond Node                                                             |
| Publishing a release | Push access, the signing keystore and the repository secrets (see below)        |

Install dependencies with `npm ci`. Its `postinstall` runs `patch-package`, which applies
`patches/expo-sqlite+57.0.3.patch`; without it the web app cannot save a text longer than 255 bytes. If you
ever change a patched file, re-record the patch with `npx patch-package expo-sqlite`.

## The files that decide how a build turns out

| File                         | What it controls                                                             |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `app.json`                   | app name, version, Android permissions and the config plugins                |
| `metro.config.js`            | treats `.wasm` as an asset, and sets the isolation headers on the dev server |
| `plugins/withReleaseSigning` | adds the Gradle release signing config that reads the `LINEWISE_*` variables |
| `workbox-config.js`          | what the service worker precaches, and what it caches on first use           |
| `public/`                    | copied into the web build as is: `_headers`, `index.html`, the PWA icons     |
| `scripts/`                   | the build steps described below                                              |
| `.github/workflows/`         | `ci.yml` on every push, `release.yml` on every `v*` tag                      |

## While you are working

```bash
npm run android        # dev build on a connected device or emulator (prebuilds the first time)
npx expo start --web   # the web app at http://localhost:8081, with the isolation headers
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint, no warnings allowed
npm test               # Jest
npm run check:offline  # no network code outside the update check; checks the CSP too
```

There is no service worker in development, so the web app there never caches itself.

## The web build, step by step

`npm run build:web` runs five steps. Each one can be run on its own while debugging.

1. **`expo export --platform web --output-dir dist-web`** bundles the app with Metro into
   `dist-web/_expo/static/js/web/`. Every bundle is named after the md5 of its contents
   (`entry-<md5>.js`, `worker-<md5>.js`), assets land in `dist-web/assets/`, and `public/` is copied over
   unchanged, with `public/index.html` as the page.
2. **`node scripts/fix-web-assets.js dist-web`** moves `assets/node_modules/` (the SQLite WebAssembly and
   the icon fonts) to `assets/vendor/`, because Cloudflare Pages does not upload any folder called
   `node_modules`, and rewrites the paths. Editing a bundle changes its contents, so the script then gives
   it the md5 of the new contents as its name, and renames the bundles that load it in turn.
3. **`node scripts/copy-ocr-assets.js dist-web`** copies the Tesseract worker, the WebAssembly cores and
   nine language models into `dist-web/ocr/` (about 29 MB), so scanning a photo never reaches a CDN.
4. **`workbox generateSW workbox-config.js`** writes `dist-web/sw.js`: the app shell (around 50 files, 9 MB)
   is precached, `/ocr/*` is cached the first time it is used, and the Workbox runtime is inlined so the
   service worker loads nothing from another site.
5. **`node scripts/check-offline.js --web dist-web`** fails the build if a file is still under
   `node_modules`, a bundle's name no longer matches its contents, `sw.js` is missing or loads from another
   site, or the Content-Security-Policy in `public/_headers` allows another host.

The result is `dist-web/` (not committed). Serve it exactly as Cloudflare will with `npm run serve:web`,
which reads `public/_headers` and falls back to `index.html` for unknown paths.

### The headers, and the one rule about file names

`public/_headers` gives every page `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`, which
make the page cross-origin isolated. Without them there is no `SharedArrayBuffer`, and expo-sqlite's worker
cannot open the database. The same file sets a Content-Security-Policy that only allows this site, caches
`/_expo/*` for a year as `immutable`, and marks `/sw.js` `no-cache`.

Immutable caching means **a name under `/_expo/` must always mean the same bytes**. Any step that edits a
bundle after the export has to rename it, or browsers that already have the old file keep running it for a
year. This is not theoretical: v1.1.1 rewrote the SQLite worker and kept its name, so browsers that had
opened v1.1.0 went on asking for a file that no longer existed and could not open the database. Step 2 now
renames, and step 5 fails the build if a name and its contents ever disagree.

## The Android build, step by step

```bash
npx expo prebuild --platform android   # regenerates android/ from app.json and the plugins
cd android && ./gradlew assembleRelease
```

- `android/` is generated, not committed. Re-run `prebuild` (add `--clean` if it misbehaves) after changing
  `app.json`, a config plugin, or a dependency with native code.
- The APK lands at `android/app/build/outputs/apk/release/app-release.apk`.
- `-PreactNativeArchitectures=arm64-v8a` builds one ABI, which is much faster for testing.
- Signing comes from the environment: `LINEWISE_KEYSTORE_FILE`, `LINEWISE_KEYSTORE_PASSWORD`,
  `LINEWISE_KEY_ALIAS` and `LINEWISE_KEY_PASSWORD`. Without them Gradle uses the debug key: fine on your own
  phone, and the release workflow refuses to publish such an APK.
- Installing a new APK over an old one keeps the user's data, as long as both are signed with the same key.
  **If you lose the keystore, nobody can update their install.**

## Versions come from the tag

`node scripts/set-version.js v1.2.3` writes `expo.version` (`1.2.3`) and `expo.android.versionCode`
(`major * 10000 + minor * 100 + patch`, so `10203`) into `app.json`. Both workflows run it from the tag
name, and the result is never committed: the tag is the only source of truth. Do not bump `app.json` by
hand. The Android app compares this version with GitHub's latest release tag when it checks for updates.

## Releasing

```bash
git tag -a v1.2.3 -m "v1.2.3: what changed" && git push origin v1.2.3
```

That starts `.github/workflows/release.yml`, which runs two jobs at once.

- **Build and publish** (about 20 minutes): checks (typecheck, lint, tests), stamp the version, prebuild,
  restore the keystore from the secrets, `assembleRelease`, list the APK's permissions, refuse an APK signed
  with the debug key, then create the GitHub Release with `linewise-vX.Y.Z.apk` and its `.sha256`.
- **Build and deploy the web app** (about 2 minutes): tests, stamp the version, `npm run build:web`, then
  `wrangler pages deploy dist-web --project-name=linewise --branch=main`, and finally point the
  repository's Website link at the live site.

| Secret                      | Without it                                                      |
| --------------------------- | --------------------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | the APK job fails on purpose, rather than publish a debug build |
| `ANDROID_KEYSTORE_PASSWORD` | Gradle cannot read the keystore                                 |
| `ANDROID_KEY_ALIAS`         | as above                                                        |
| `ANDROID_KEY_PASSWORD`      | as above                                                        |
| `CLOUDFLARE_API_TOKEN`      | the site is built and checked, but not deployed                 |
| `CLOUDFLARE_ACCOUNT_ID`     | as above                                                        |
| `REPO_ADMIN_TOKEN`          | the Website link is left alone (a note says so in the run)      |

`REPO_ADMIN_TOKEN` is a fine-grained GitHub token with **Administration: Read and write** on this
repository. GitHub's built-in Actions token deliberately cannot change repository settings, so without this
one the Website link has to be set by hand.

## Cloudflare Pages

The project is `linewise`; the site is <https://linewise-5ds.pages.dev/>. The release workflow uploads the
finished `dist-web/` directly, so **Cloudflare's own Git builds must stay off** (Settings, Builds: no
automatic production or preview deployments). A Git build here has no build command and no output
directory, so it publishes the raw repository over the site, and the app disappears.

To undo a bad deploy, open Deployments, find the last good one and choose **Rollback**; it takes seconds.
Adding a custom domain needs nothing in this repository: once the domain is active, the next release points
the repository's Website link at it.

## When something goes wrong

| What you see                                                                               | What it usually is                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The app's data could not be opened", `expected magic word 00 61 73 6d, found 3c 21 64 6f` | A request for the SQLite WebAssembly returned the web page instead (`3c 21 64 6f` is `<!do`). Check `curl -I <site>/assets/vendor/expo-sqlite/web/wa-sqlite/wa-sqlite.<md5>.wasm` says `content-type: application/wasm`. Either the file was not uploaded, or the browser is running a cached bundle that asks for an old path: only a new file name gets it off that copy. |
| "SharedArrayBuffer is not defined"                                                         | The page is not cross-origin isolated: `_headers` did not reach the browser. `curl -I <site>/` should show both `cross-origin-*` headers.                                                                                                                                                                                                                                   |
| "The app's data could not be opened", `NoModificationAllowedError`                         | The web database is already open in another tab or in the page being replaced. Only one page at a time can hold it; reloading fixes it.                                                                                                                                                                                                                                     |
| The site serves `SPEC.md`, or 404s everywhere                                              | A Cloudflare Git build published the repository. Turn automatic deployments off, then roll back to the last good deployment.                                                                                                                                                                                                                                                |
| A stale web app after a deploy                                                             | The old service worker serves its copy until the new one takes over. Reload once; the app also offers a reload when the new version is ready.                                                                                                                                                                                                                               |
| `prebuild` output looks wrong after editing `app.json`                                     | `npx expo prebuild --platform android --clean`.                                                                                                                                                                                                                                                                                                                             |
| Gradle cannot find the SDK or complains about licences                                     | Set `ANDROID_HOME`, then accept them: `sdkmanager --licenses`.                                                                                                                                                                                                                                                                                                              |
| Database tests fail to load after a Node upgrade                                           | `npm rebuild better-sqlite3`.                                                                                                                                                                                                                                                                                                                                               |
