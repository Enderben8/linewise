# Linewise

Learn poems, speeches, verses and scripts by heart. Linewise is a free, offline Android app: you add a
text, split it into chunks, practise it with 11 games (including speech recognition), and get reminded to
review it at spaced intervals. Everything stays on your phone.

- **Free, no accounts, no ads.** There is no server, no sign-in and no analytics.
- **Works in airplane mode.** The only thing Linewise does online is check whether a new version is out,
  and you can turn that off.
- **11 games:** Tap to Reveal, Slider, Listen, First Letter, Fill in the Blank, Sentence Scramble,
  Type It, Multiple Choice, Speak, Run Scene (for scripts) and My Recordings.
- **Spaced reviews** at 1, 2, 4, 7, 14, 30 and 60 days, with an optional target date and local reminders.
- **Add text** by typing, pasting, importing `.txt` / `.md`, scanning a page with the camera (on-device OCR),
  or sharing text to Linewise from another app.
- **Back up and restore** to a single JSON file, since there is no cloud.
- **11 languages:** English, Spanish, French, German, Filipino, Portuguese (Brazil), Dutch, Hindi, Arabic
  (right to left), Simplified Chinese and Hebrew (right to left).

It also runs in the browser as an installable web app that works offline (see [Use it in the browser](#use-it-in-the-browser)).

The full product spec is in [SPEC.md](SPEC.md).

## Install the APK

Linewise is not in an app store. Install a signed release APK from the
[Releases](../../releases) page:

1. On your phone, open the newest release and download `linewise-vX.Y.Z.apk`.
2. Open the file. Android will ask you to allow installs from this source (**Install unknown apps**);
   allow it for your browser or file manager, then tap **Install**.
3. To check the download, compare its SHA-256 with `linewise-vX.Y.Z.apk.sha256` from the same release.

Updates ship as new APKs. Install a newer one over the old one; your data is kept.

## Use it in the browser

The web app is the same Linewise, published to Cloudflare Pages by the release workflow.

- **Install it:** in Chrome or Edge use _Install app_ in the address bar or menu; on Android Chrome use
  _Add to Home screen_; in Safari on iPhone use _Share, Add to Home Screen_. After the first visit it opens
  with no connection.
- **Your data stays in that browser** on that device. Clearing site data deletes it, and it does not move
  to another browser or to the Android app. Use **Settings, Back up and restore** to save a backup file and to
  move texts between devices.
- **Differences from the Android app:** Speak and Run Scene are not available (browsers send speech to a
  server for recognition), there are no review reminders (review days still show in the list), and text
  shared from other apps cannot be received. Scanning a photo runs Tesseract in the browser; the language
  files (about 3 to 10 MB each) are fetched from the site the first time you scan and kept for offline use.

To build and try it locally:

```bash
npm run build:web   # export to dist-web, copy the OCR files, generate the service worker, run the offline check
npm run serve:web   # http://localhost:8081, with the same headers as Cloudflare (public/_headers)
```

`npx expo start --web` also works for development (the service worker is only registered in a build).

## Build it yourself

[BUILDING.md](BUILDING.md) walks through both builds step by step, with the release process and what to do
when something goes wrong. The short version:

You need Node 24, a JDK (17 or 21) and the Android SDK (`ANDROID_HOME` set).

```bash
npm ci
npx expo prebuild --platform android   # generates the android/ folder (it is not committed)
cd android
./gradlew assembleRelease              # add -PreactNativeArchitectures=arm64-v8a to build one ABI faster
```

The APK is at `android/app/build/outputs/apk/release/app-release.apk`. Without the signing variables below
it is signed with the debug key: fine for your own phone, not for sharing.

## Develop

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint, no warnings allowed
npm test               # Jest: engine, scheduler, games, database, backup, translations, offline guard
npm run check:offline  # no network dependencies, no network calls but the update check, web CSP same-site only
npm run i18n:keys      # prints every translation key used by the code
npm run icons          # redraws the app icon set from the mascot (scripts/make-icons.js)
```

The interesting logic is plain TypeScript with tests:

| Folder          | What is in it                                                           |
| --------------- | ----------------------------------------------------------------------- |
| `src/engine`    | text engine: chunks, scripts, words, sentences, phrases, word alignment |
| `src/scheduler` | spaced-repetition maths, target-date scaling, reminders, stats          |
| `src/games`     | selection and per-game logic, results                                   |
| `src/db`        | Drizzle schema, migrations and queries on SQLite                        |
| `src/features`  | backup, speech, notifications, recordings, import, OCR, settings        |
| `src/store`     | Redux Toolkit slices                                                    |
| `src/i18n`      | i18next setup and the 11 locale files                                   |
| `app`           | expo-router screens                                                     |
| `e2e`           | Maestro flows (see [e2e/README.md](e2e/README.md))                      |

When you add UI text, add the key to `src/i18n/locales/en.json` and to all ten other locale files. The
tests fail if a key is missing, unused, or loses a `{{placeholder}}`.

### Changing the database

Never edit an existing migration. Add a new entry to `src/db/migrations.ts` (SQL plus a journal entry with a
larger `when`) and update `src/db/schema.ts`. The migration tests run the real SQL against SQLite and
compare it with the Drizzle schema.

## Releases and signing

CI (`.github/workflows/ci.yml`) typechecks, lints, tests and builds the Android bundle and the web app on
every push.

Pushing a tag such as `v1.0.0` runs `.github/workflows/release.yml`, which builds a signed release APK and
attaches it, with its SHA-256, to a GitHub Release. It fails on purpose if the signing key is missing, so an
APK signed with the debug key is never published.

One-time setup:

1. Create a keystore and keep the file and passwords somewhere safe. **If you lose it, existing installs can
   no longer be updated.**

   ```bash
   keytool -genkeypair -v -keystore linewise.jks -alias linewise -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 linewise.jks > linewise.jks.base64      # on macOS: base64 -i linewise.jks
   ```

2. In the GitHub repository, add these Actions secrets (Settings, Secrets and variables, Actions):
   `ANDROID_KEYSTORE_BASE64` (the base64 text), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
   `ANDROID_KEY_PASSWORD`.
3. Tag and push: `git tag v1.0.0 && git push origin v1.0.0`.

The keystore and its passwords exist only in those secrets; nothing secret is in the repository. The
version name and code come from the tag (`v1.2.3` becomes name `1.2.3`, code `10203`).

The same tag also builds the web app and deploys it to Cloudflare Pages. One-time setup (free plan):

1. In the Cloudflare dashboard, create a Pages project named `linewise` using _Direct Upload_ (upload any
   placeholder file; the workflow replaces it).
2. Create an API token with the _Cloudflare Pages: Edit_ permission, and note your account ID.
3. Add the Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Until those secrets exist the web job still builds and checks the site, and skips the deploy.

Optionally add `REPO_ADMIN_TOKEN`, a fine-grained GitHub token with _Administration: Read and write_ on
this repository. Each release then points the repository's Website link at the live site, including a
custom domain added later. GitHub's built-in Actions token cannot change repository settings, so without
this secret the link is left alone.

Do not turn on Cloudflare's own Git builds for the project. If the project is connected to this
repository, keep automatic production and preview deployments off (Settings, Builds). A Git build has
none of the workflow's steps, so it publishes the raw repository files over the site. To undo a bad
deploy, open the project's Deployments list and choose _Rollback_ on the last good one.

## Privacy

Your texts stay on your device. Linewise has no accounts and no server, and the only thing it uses the
internet for is checking whether a newer version has been released.

- **The Android app** asks GitHub for the latest release each time it opens, and offers the download if
  there is one. The request sends nothing about you or your texts, and **Settings, About, Check for
  updates** turns it off. That check is the only reason the app declares the `INTERNET` permission.
- **The web app** never calls GitHub: it fetches new versions of itself from its own site and then offers
  to reload. Its Content-Security-Policy (`public/_headers`) makes the browser block any request to another
  host, and CI fails if that policy ever allows one.
- Everything else, including text recognition, speech recognition and text to speech, runs on your device.
  `npm run check:offline` fails if any code outside the update check can reach the network.

**Settings, Report a problem** opens the GitHub Issues page in your browser; the app itself sends nothing.

## Known limits

- Android and the web. There is no iOS build (the web app can be added to an iPhone home screen).
- Speech recognition needs a phone whose speech service supports on-device recognition and has the
  language pack downloaded; the Speak and Run Scene screens tell you what is missing.
- Scanning text is not available for Arabic or Hebrew (the on-device model does not include them). Type or
  paste those texts instead.
- Scripts in languages without capital letters (Arabic, Hebrew, Hindi, Chinese) mark speakers with a
  trailing colon, for example `هاملت:`, instead of ALL CAPS.
- Digits and number words are treated as equal in English only, and only for single-word numbers.
- Backups do not include recordings.
