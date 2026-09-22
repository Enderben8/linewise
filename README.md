# Linewise

Learn poems, speeches, verses and scripts by heart. Add a text, split it into chunks, practise it with
11 games, and review it at spaced intervals until you know it. Linewise is free, has no accounts or ads,
and keeps everything on your device. It is an Android app and an installable web app.

- **11 games:** Tap to Reveal, Slider, Listen, First Letter, Fill in the Blank, Sentence Scramble,
  Type It, Multiple Choice, Speak, Run Scene (for scripts) and My Recordings.
- **Spaced reviews** at 1, 2, 4, 7, 14, 30 and 60 days, with an optional target date and reminders.
- **Add text** by typing or pasting, importing a `.txt` or `.md` file, scanning a page, or sharing text
  to Linewise from another app.
- **Works offline.** The only thing Linewise does online is check whether a new version is out, and
  you can turn that off.
- **Back up and restore** to a single file, since there is no cloud.
- **11 languages:** English, Spanish, French, German, Filipino, Portuguese (Brazil), Dutch, Hindi,
  Arabic, Simplified Chinese and Hebrew.

## Install on Android

Linewise is not in an app store. Install it from the [Releases](../../releases) page:

1. On your phone, open the newest release and download `linewise-vX.Y.Z.apk`.
2. Open the file. Android asks you to allow installs from this source (**Install unknown apps**); allow
   it for your browser or file manager, then tap **Install**.
3. To check the download, compare its SHA-256 with `linewise-vX.Y.Z.apk.sha256` from the same release.

When a new version is out, Linewise offers to download it the next time you open it. Install it over
the old one; your data is kept.

## Use it in the browser

Open <https://linewise-5ds.pages.dev/> (also the Website link of this repository). After the first
visit it works with no connection, and it updates itself when a new version is published.

- **Install it** with _Install app_ in Chrome or Edge, or _Add to Home screen_ in Chrome on Android.
- **Your texts stay in that browser.** Clearing the site's data deletes them, and they do not move to
  another browser or to the Android app. Use **Settings, Back up and restore** to keep a copy or to move
  texts between devices.
- **Differences from the Android app:** Speak and Run Scene are not available (browsers send speech to
  a server to recognise it), there are no reminders (texts due for review still say so in the list),
  and it cannot receive text shared from other apps. The first scan in a language downloads about 5 to
  7 MB from the site (the text recognition engine and that language's data); later scans work offline.

## Privacy

Your texts stay on your device. There are no accounts, no server and no analytics.

- **The Android app** asks GitHub for the latest release each time it opens, and offers the download if
  there is one. The request sends nothing about you or your texts. **Settings, About, Check for
  updates** turns it off; it is the only reason the app has the `INTERNET` permission.
- **The web app** loads nothing from anywhere but its own site. Its Content-Security-Policy
  (`public/_headers`) makes the browser block requests to any other host, and CI fails if the policy
  ever allows one.
- Everything else, including text recognition, speech recognition and text to speech, runs on the
  device. `npm run check:offline` fails if any code outside the update check can reach the network.

**Settings, Report a problem** opens GitHub Issues in your browser; the app itself sends nothing.

## Known limits

- There is no iOS app. The web app has been tested in Chrome; Firefox and Safari have not been checked
  yet.
- Speech recognition needs a phone that can recognise speech on the device, with the language pack
  downloaded. Speak and Run Scene say what is missing.
- Scanning does not support Arabic or Hebrew. Type or paste those texts instead.
- Scripts in languages without capital letters (Arabic, Hebrew, Hindi, Chinese) mark speakers with a
  trailing colon, for example `هاملت:`, instead of ALL CAPS.
- Digits and number words count as the same word in English only, and only for single-word numbers.
- Backups do not include recordings.

## Develop

You need Node 24. The Android app also needs a JDK (17 or 21) and the Android SDK.

```bash
npm ci                 # install; also applies patches/ (see BUILDING.md)
npm run android        # development build on a connected phone or emulator
npx expo start --web   # the web app at http://localhost:8081
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint, no warnings allowed
npm test               # Jest
npm run check:offline  # no network code but the update check, and a same-site-only web CSP
npm run build:web      # the offline web app in dist-web/; npm run serve:web serves it like Cloudflare
npm run i18n:keys      # every translation key the code uses
npm run icons          # redraws the app icons (scripts/make-icons.js)
```

[BUILDING.md](BUILDING.md) explains both builds step by step, releasing, signing and deploying, and
what to do when something goes wrong. [SPEC.md](SPEC.md) is the product spec, with a log of every
decision. The end-to-end flows are described in [e2e/README.md](e2e/README.md).

| Folder          | What is in it                                                                      |
| --------------- | ---------------------------------------------------------------------------------- |
| `app`           | expo-router screens                                                                |
| `src/engine`    | text engine: chunks, scripts, words, sentences, phrases, word alignment            |
| `src/scheduler` | spaced-repetition maths, target dates, reminder times, stats                       |
| `src/games`     | chunk selection and the logic of each game                                         |
| `src/db`        | Drizzle schema, migrations and queries on SQLite                                   |
| `src/features`  | backup, import, notifications, OCR, recordings, settings, sharing, speech, updates |
| `src/store`     | Redux Toolkit slices                                                               |
| `src/i18n`      | i18next setup and the 11 locale files                                              |
| `scripts`       | the web build steps and the release checks                                         |

- **UI text:** add the key to `src/i18n/locales/en.json` and to the ten other locale files. The tests
  fail if a key is missing, unused, or loses a `{{placeholder}}`.
- **Database changes:** never edit an existing migration. Add a new entry to `src/db/migrations.ts`
  (the SQL and a journal entry with a larger `when`) and update `src/db/schema.ts`. The tests run the
  real SQL against SQLite and compare it with the schema.
