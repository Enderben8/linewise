# Rebuild Spec: Linewise

A spec for rebuilding the core features of **Memorize By Heart 5.9.10** (the APK in this folder) as a new app called **Linewise**. You are building a feature-equivalent app, not a copy. Read this whole file before starting work.

Status tracking is at the bottom (§11). Update it when you finish a task.

---

## 1. Ground rules

1. **Do not copy the original's brand or assets.** The app is called **Linewise**: Android package `app.linewise`, URL scheme `linewise`. Make a new logo, mascot images, colours and UI copy. Never use the original's package ID (`com.memorize_by_heart`), scheme or text.
2. **Never use anything from `Memorize By Heart_5.9.10 (2).apk` in the new code.** Its `app.config` has a keystore password and Google API keys in plain text. Do not copy them, print them or commit them.
3. **Fully offline. No backend, no accounts, no network calls.** Do not add a server, a database service, sign-in, analytics, crash reporting or any SDK that talks to the internet. The app must work in airplane mode, and must not request the `INTERNET` permission unless a later decision in §10 allows it. The one exception, allowed in §10 on 2026-09-22, is the update check: the Android app asks GitHub for the latest release, and the user can turn that off.
4. **No paid services and no API keys.** Everything runs on the phone. The only secret in the project is the Android signing keystore, which lives only in GitHub Actions secrets.
5. **Build the text engine (§6) first and unit-test it.** Every game depends on it.
6. **Everything is free.** Do not add a paywall, subscription, trial, ads or any "Premium" check. The original app gates many features behind Premium; ignore that.
7. When a decision here is marked *(default)*, use it without asking. Record any change in §10.

## 2. Product summary

Users add a text (a poem, verse, speech or play script) and split it into chunks. They practise with 11 game modes, including speech recognition. Reviews come at spaced-repetition intervals, with reminders toward an optional target date. All data stays on the phone. Every feature is free.

**Platform and distribution:** Android only. The app is not published to any app store. Signed release APKs are built by GitHub Actions and attached to GitHub Releases, and users install them directly. Do not add iOS-only work, app store listings or store review prompts. Keep the code cross-platform where it costs nothing.

**Web app** (added 2026-09-22, see §10): the same code also ships as an installable, offline web app (PWA) on Cloudflare Pages. Data stays in that browser. Speak and Run Scene are Android only, and the web app has no reminders; everything else works the same.

**Left out on purpose** (they need a server): accounts and sign-in, cloud backup and sync, the public Library, groups, leaderboards, AI voices, PDF import. Backup export/import (§9) replaces cloud backup. Do not build any of the others.

## 3. Tech stack (fixed)

| Concern | Use |
| --- | --- |
| App | Expo SDK (latest stable), TypeScript `strict`, expo-router, development build via `npx expo prebuild` (not Expo Go) |
| State | Redux Toolkit for app state. Game state lives in the screen component or a local reducer |
| Storage | `expo-sqlite` + Drizzle ORM for all data. `expo-file-system` for recordings and backups |
| UI | FlashList, react-native-reanimated, react-native-gesture-handler, react-native-draggable-flatlist, react-native-svg |
| Speech to text | `expo-speech-recognition`, with on-device recognition requested (`requiresOnDeviceRecognition`) |
| Text to speech | `expo-speech` (device voices) |
| Audio | `expo-audio` with background playback |
| OCR | `expo-camera` / `expo-image-picker`, then on-device ML Kit text recognition (`@react-native-ml-kit/text-recognition`) with its models bundled in the APK, not downloaded |
| File import | `expo-document-picker` for `.txt` and `.md` files |
| Backup | `expo-sharing` to save or send a backup file; `expo-document-picker` to restore one |
| Notifications | `expo-notifications` (local scheduled only) |
| i18n | `expo-localization` + `i18next`. Languages: en, es, fr, de, fil, pt-BR, nl, hi, ar, zh-Hans, he (ar and he are RTL) |
| Tests | Jest (unit), Maestro (end to end) |
| Build | `npx expo prebuild` + Gradle `assembleRelease`, run in GitHub Actions. No EAS, no store submission. Updates ship as new APKs |

Do not add a library that duplicates one of these without recording why in §10.

## 4. Repository layout

```
app/                      expo-router routes (see §5)
src/
  engine/                 text engine: pure TS, no React, 100% unit-tested
  scheduler/              spaced-repetition maths: pure TS
  games/                  one folder per game: component + reducer + scoring
  features/               memorizations, voices, recordings, backup, settings, onboarding
  db/                     Drizzle schema, migrations and queries
  store/                  Redux slices
  i18n/                   i18next setup + locales/<lang>.json
  components/             shared UI
.github/workflows/        CI: typecheck, lint, tests on every push; release APK on version tags
e2e/                      Maestro flows
```

## 5. Screens (expo-router)

```
app/_layout.tsx
app/index.tsx                         redirect: onboarding (first launch) or tabs
app/onboarding/...                    questions + one-minute First Letter demo
app/(tabs)/_layout.tsx                3 tabs: Memorizations, Add, Settings
app/(tabs)/memorizations/index.tsx    list with progress rings, search, tag filter
app/(tabs)/memorizations/[id]/index.tsx       detail + game picker
app/(tabs)/memorizations/[id]/{tap-to-reveal,slider,listen,first-letter,fill-in-the-blank,sentence-scramble,type-it,multiple-choice,speak,run-scene,my-recordings}.tsx
app/(tabs)/memorizations/[id]/{stats,notifications,see-full-text,edit-text}.tsx
app/(tabs)/add/{index,edit-text,camera-recognition}.tsx
app/(tabs)/settings/index.tsx         language, font size, speech rate, voices, notifications, backup, about
```

## 6. Text engine (`src/engine`)

Pure functions, no I/O. Suggested API:

```ts
type LineKind = 'text' | 'speaker' | 'dialogue' | 'action';
interface Line { kind: LineKind; text: string; speaker?: string }
interface Chunk { index: number; lines: Line[] }
interface Token { text: string; norm: string; start: number; end: number } // norm = lowercase, no punctuation

parseBody(body: string, type: 'text' | 'script'): Chunk[]
validateScript(body: string): Array<{ line: number; code: 'SPEAKER_NO_DIALOGUE' | 'LOOKS_LIKE_SPEAKER' }>
sentences(chunk: Chunk): string[]
phrases(chunk: Chunk): string[]             // split on , ; : and line breaks
words(text: string, lang: string): Token[]  // use Intl.Segmenter for zh-Hans and other no-space scripts
align(target: Token[], attempt: Token[]): Array<{ op: 'match' | 'missed' | 'extra' | 'wrong'; target?: Token; attempt?: Token }>
```

Rules:

- A blank line separates chunks. Single line breaks inside a chunk are kept (poems, lyrics).
- Script format: a speaker name alone on a line in ALL CAPS, dialogue on the following lines. Action and stage-direction lines are wrapped in `()` or `[]` *(default)*.
- Punctuation stays attached for display and is ignored in scoring.
- `align` uses word-level Levenshtein alignment on `norm`.
- Numbers: treat `"3"` and `"three"` as equal for the current language *(default: en only at first)*.

Tests must cover all 11 languages with at least one sample each, plus RTL, plus a script with 3+ speakers and action lines.

## 7. Games

Every game takes a `ChunkSelection` (`one` chunk, a `range`, or `all`). Scripts can also filter to a focus speaker. Each game returns a `SessionResult`:

```ts
interface SessionResult { game: GameId; accuracy: number; coverage: number; weightedScore: number; chunkRange: [number, number] }
// coverage = words practised / total words; weightedScore = accuracy * coverage
```

| Game | Group | Behaviour | Scored |
| --- | --- | --- | --- |
| Tap to Reveal | Practice | Tap to reveal the next unit. Modes: phrase, sentence, word. Optional TTS reads each revealed part | No |
| Slider | Practice | Slider from 0% to 100% hidden words, from guided reading to full recall | No |
| Listen | Practice | Device TTS or a saved recording reads the text. Speed, repeat, pause/resume, follow-along highlight | No |
| First Letter | Solidify | Show blanks. User types the first letter of each word. Wrong letter: haptic buzz, mark wrong, move on | Yes |
| Fill in the Blank | Solidify | Hide some words and offer choices. User can pick which words to hide (saved per memorization, reset if the text changes) | Yes |
| Sentence Scramble | Solidify | Drag scrambled sentences into order, then tap Done | Yes |
| Type It | Evaluate | Type the whole selection from memory, scored with `align` | Yes |
| Multiple Choice | Evaluate | Pick the correct next word or phrase from 4 options | Yes |
| Speak | Evaluate | Recite. Speech recognition transcript scored with `align`. Shows missed and extra words | Yes |
| Run Scene | Evaluate (scripts only) | User picks a role. App speaks other roles and action cues (per-role voices), listens for the user's lines, then scores them | Yes |
| My Recordings | Practice | Record, rename, delete. Set one as the Listen source. Warn if recorded before the last text change | No |

Speech games must check microphone permission, speech recognition availability (including the on-device language pack) and TTS availability **before** starting, and explain what to enable or download if one is missing.

On finishing a scored game, show the result, play a celebration (confetti + a mascot reaction), and save a session (§9).

## 8. Review system (`src/scheduler`)

*(All defaults. Keep them in one config object so they can be tuned.)*

- Intervals in days: `[1, 2, 4, 7, 14, 30, 60]`.
- A **review day** is when `now >= nextReviewAt`. Only the **first** Solidify or Evaluate session on a review day counts. If its `weightedScore >= 0.8`, advance `intervalIndex` and set `nextReviewAt`. Otherwise keep the interval and set `nextReviewAt` to tomorrow.
- Sessions outside review days are practice only and do not affect progression.
- **Target date:** scale the remaining intervals so the final review lands on the target date. Never go below 1 day.
- Optional setting: reset Solidify scores at each new interval.
- After a counting session, cancel the old reminder and schedule one local notification at `nextReviewAt`. Reschedule all reminders when the app starts, in case the phone restarted.
- **Headline score** = best Evaluate `weightedScore` in the current cycle.
- **Progress rings:** outer = percent memorized (headline score); inner = progress through the current cycle (`intervalIndex / intervals.length`).
- **Stats:** monthly bar chart of scored sessions per day; tap a day to list games and scores.

## 9. Data model (SQLite on the device)

All ids are UUIDs. Use Drizzle migrations for every schema change, so updating the APK never loses data.

| Table | Columns |
| --- | --- |
| `settings` | key, value (JSON): locale, default_language, font_size, speech_rate, default_voice, notifications_enabled, reset_solidify_each_interval, onboarding_done |
| `memorizations` | id, title, author, language, type (`text`/`script`), body, body_hash, chunks (JSON), tags (JSON array), created_at, updated_at |
| `progress` | memorization_id (primary key), target_due_date, interval_index, next_review_at, headline_score, solidify_scores (JSON), hidden_words (JSON), voice_overrides (JSON), updated_at |
| `sessions` | id, memorization_id, game, chunk_start, chunk_end, accuracy, coverage, weighted_score, counted_for_review, created_at |
| `recordings` | id, memorization_id, name, file_uri, duration_sec, body_hash, created_at |

Deleting a memorization deletes its progress, sessions, recordings and their audio files.

### Backup and restore

Because there is no cloud backup, a lost or reset phone loses everything unless the user has a backup file.

- **Export:** Settings → Back up. Writes one `linewise-backup-YYYY-MM-DD.json` file containing a `version` number and every table except recordings, then opens the Android share sheet so the user can save it to Files or Google Drive, or send it.
- **Import:** Settings → Restore. Pick a backup file, show what it contains, then either replace all data or merge (memorizations with the same id: newer `updated_at` wins). Reject files with an unknown `version`.
- Recordings are not in the backup *(default)*, to keep the file small. Say so on the export screen.
- Remind the user to back up once a month (a setting, on by default).

### Sharing a single text

A memorization can be shared as plain text through the Android share sheet, and any text shared **to** Linewise from another app opens the Add screen with that text filled in.

### Limits *(defaults, keep in one config file)*

| Limit | Value |
| --- | --- |
| Memorizations | Unlimited |
| Memorization body size | 100 KB |
| Recordings per memorization | 10, max 10 min each |

## 10. Decisions log

Add a row when you change a default or make a call not covered here.

| Date | Decision | Why |
| --- | --- | --- |
| 2026-09-21 | All features free. No Premium tier, paywall or in-app purchases | Owner's decision |
| 2026-09-21 | ~~Mobile only. No web app~~ Replaced on 2026-09-22 by the web app rows below | Owner's decision |
| 2026-09-21 | Android only, distributed as APKs on GitHub Releases. No iOS, no app stores | Owner's decision |
| 2026-09-21 | App name Linewise, package `app.linewise` | Owner asked Claude to choose |
| 2026-09-21 | Fully offline, no backend and no accounts. Dropped: sign-in, cloud sync, Library, groups, leaderboards, AI voices, PDF import | Owner does not want Supabase, Google Cloud or any paid service |
| 2026-09-21 | Backup export/import to a JSON file replaces cloud backup | Otherwise a lost phone loses all data |
| 2026-09-21 | A **review day** is a calendar day (local time). `nextReviewAt` is stored as the start of that day, so any time that day counts. Reminders fire at 09:00 local (`SCHEDULER_CONFIG.reminderHour`); an overdue review is nudged at the next 09:00 | §8 says `now >= nextReviewAt` but not what the time of day is |
| 2026-09-21 | `intervalIndex` = number of passed reviews. A new text has `nextReviewAt = null` and is due immediately, so its first scored session counts. After the last interval the plan keeps using the last interval (60 days); with a target date the plan ends (`nextReviewAt = null`) after the last review | §8 leaves the ends of the plan open |
| 2026-09-21 | **Headline score** = best Evaluate `weightedScore` since the last passed counting review. A passing Evaluate session seeds the new cycle with its score, a passing Solidify session leaves it unchanged, so the outer ring does not drop to 0 after every review | "Current cycle" was not defined |
| 2026-09-21 | Every scored game counts **all words in the selection** as practised (including Fill in the Blank and Multiple Choice). `coverage` divides by the words of the whole text, or of the focus speaker's lines. So a session must cover at least 80% of the text (or of the speaker's lines) to reach the 80% pass mark | Keeps `coverage` simple and the same for all games |
| 2026-09-21 | Accuracy for `align`-scored games (Type It, Speak, Run Scene) is `matched / (target words + extra words)` | §6 defines `align` but not the score |
| 2026-09-21 | Target-date plan: remaining gaps are scaled so the last review lands on the target date, each at least 1 day; if the days do not fit, every gap is 1 day. Recomputed after each pass | §8 says "scale" without the method |
| 2026-09-21 | `settings.default_voice` is a map `{ [language]: voiceId }` instead of a single value, because device voices belong to one language. Two settings were added: `backup_reminder_enabled`, `last_backup_at`. A restore never overwrites `default_voice` or `last_backup_at` (they describe this phone) | §9 lists one voice |
| 2026-09-21 | The recording chosen for Listen is stored in `progress.voice_overrides.__listen_source`, not a new column | The `progress` columns are fixed by §9 |
| 2026-09-21 | Migrations are written as TypeScript in `src/db/migrations.ts` (Drizzle's Expo migrator format) with no `drizzle-kit` or SQL bundler plugin. A test runs the SQL and compares it with `schema.ts` | Avoids a Metro/Babel SQL loader; keeps migrations unit-testable |
| 2026-09-21 | Libraries added beyond §3: `@expo/vector-icons` (icons), `expo-share-intent` (receive text shared from other apps, the only way in Expo), `expo-haptics` (First Letter buzz), `expo-crypto` (UUIDs), `expo-intent-launcher` (open the Android voice settings), `expo-system-ui` (dark mode), `expo-splash-screen`, `expo-build-properties`, `react-dom` (peer of `expo`). Dev only: `better-sqlite3` (run the database code in Jest), `sharp` (draw the icons), `babel-preset-expo` | Each fills a gap the fixed stack does not cover; none touches the network |
| 2026-09-21 | Extra routes: `onboarding/index`, `onboarding/demo`, `settings/voices`, `settings/backup`, `settings/faq` | §5 lists `onboarding/...` and one settings screen; these keep each screen small |
| 2026-09-21 | In languages without capital letters (ar, he, hi, zh-Hans) a script speaker line must end with a colon (`هاملت:`, `哈姆雷特：`) instead of being ALL CAPS | ALL CAPS cannot exist in those scripts, so scripts in them would never parse |
| 2026-09-21 | Number equivalence (`3` = `three`) covers single-word English numbers only (0-20, round tens, 100, 1000) | Multi-word numbers ("twenty one") would need token merging in `align` |
| 2026-09-21 | Slider and the drag handle use no extra library: a small custom slider, and Sentence Scramble also has move up/down buttons | Accessibility, and one less dependency |
| 2026-09-21 | UI strings that show a number are written as "label: {{count}}" (or show a date) instead of plural forms | Keeps 11 languages consistent without per-language plural rules |
| 2026-09-21 | OCR supports Latin, Chinese, Devanagari, Japanese and Korean (ML Kit models bundled). Arabic and Hebrew are not supported by ML Kit; the screen says so | Library limit |
| 2026-09-21 | Release signing reads `LINEWISE_KEYSTORE_FILE`, `LINEWISE_KEYSTORE_PASSWORD`, `LINEWISE_KEY_ALIAS`, `LINEWISE_KEY_PASSWORD` from the environment through `plugins/withReleaseSigning.js`. The release workflow refuses to publish an APK signed with the debug key. `versionCode` = major\*10000 + minor\*100 + patch from the tag | Keeps the keystore only in GitHub Actions secrets (§1 rule 4) |
| 2026-09-21 | Also blocked in the manifest: `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, besides `INTERNET` | The app uses none of them |
| 2026-09-22 | Linewise also ships as a web app: an installable PWA that works offline after the first visit, built from the same code with `*.web.ts(x)` twins for the phone-only modules | Owner's decision |
| 2026-09-22 | Hosted on Cloudflare Pages (free), deployed by the `web` job of the release workflow. The repo stays private | Owner's decision |
| 2026-09-22 | Speak and Run Scene are hidden on the web (`gamesFor`, `GameGate` shows "Android app only") | Browser speech recognition sends audio to Google or Microsoft servers, which breaks §1 rule 3 |
| 2026-09-22 | No reminders on the web: the toggle and onboarding question are hidden, and "review today" badges and the in-app backup nudge remain | A browser cannot show a notification on a later day without a push server |
| 2026-09-22 | Offline on the web is enforced by a strict Content-Security-Policy in `public/_headers` (only `'self'`, `blob:` and `data:`), checked by `scripts/check-offline.js`, instead of scanning the built bundle for URLs | Third-party libraries contain many harmless URL strings; the CSP makes the browser itself refuse any outside request |
| 2026-09-22 | Web OCR uses Tesseract.js (Apache-2.0) with its worker, cores and 9 language models copied into the site under `/ocr` by `scripts/copy-ocr-assets.js`, loaded only when the scan screen is used and cached by the service worker | ML Kit is Android only; nothing may load from a CDN |
| 2026-09-22 | Web storage: SQLite through expo-sqlite's web build (needs COOP/COEP headers), opened asynchronously once before the sync API is used; recordings are blobs in IndexedDB (`fileUri` = `idb:<id>`); the app asks for persistent storage | Keeps `src/db/repo.ts` synchronous and shared with Android |
| 2026-09-22 | `patches/expo-sqlite+57.0.3.patch` (applied by `patch-package` on install) fixes expo-sqlite's web worker writing only the low byte of a result's length, which cut off any synchronous result longer than 255 bytes | Upstream bug; saving a text failed on the web without it |
| 2026-09-22 | Libraries added for the web: `react-native-web`, `@expo/metro-runtime`, `tesseract.js`. Dev only: `workbox-cli` (service worker), `patch-package`, the `@tesseract.js-data/*` language packages | Needed for the web build; none talks to the network at run time |
| 2026-09-22 | `scripts/fix-web-assets.js` moves the exported `assets/node_modules/` folder to `assets/vendor/` and rewrites the paths; `check-offline.js --web` fails if any `node_modules` path is left in the build | Cloudflare Pages does not upload `node_modules` folders, so the SQLite WebAssembly and icon fonts were missing on the first deploy (v1.1.0) |
| 2026-09-22 | `scripts/fix-web-assets.js` gives every `_expo` bundle it edits a new name (the md5 of its new contents, as Expo names them), and renames the bundles that load it; `check-offline.js --web` fails if any bundle's name does not match its contents | `public/_headers` caches `/_expo/*` as immutable for a year. v1.1.1 edited the SQLite worker but kept its name, so browsers that had opened v1.1.0 kept running the old worker and still could not open the database |
| 2026-09-22 | Only the release workflow deploys the web app. The Pages project's automatic Git deployments stay off | With Git builds on and no build settings, Cloudflare published the raw repository over the site on 2026-09-22 (most paths 404, no COOP/COEP headers). Production was rolled back to the v1.1.1 deploy and Git builds were turned off |
| 2026-09-22 | Update check (owner's decision). The Android app requests `INTERNET` and, each time it opens, sends one GET to GitHub's latest-release API (`APP.releasesApiUrl`). If the release is newer, it offers to open the APK in the browser. "Not now" stores `update_dismissed_version` (kept on restore, like the other settings that describe this phone), and `update_check_enabled` (default on, Settings, About) turns the check off. "Check for updates now" runs it by hand. The web app does not call GitHub: its service worker installs each new version from the site and offers a reload, and a tab left open checks again when it comes back into view, at most hourly. `check-offline.js` allows `fetch()` only in `src/features/updates/check.ts` and no longer requires `INTERNET` to be blocked. The README, FAQ, onboarding and Settings copy say the app only goes online to check for updates | The owner wants to hear about new releases. The request sends nothing about the user or their texts |
| 2026-09-22 | Dialogs go through `src/lib/dialog.ts` (`notify`, `confirmAction`) instead of `Alert.alert` | `Alert.alert` does nothing in react-native-web |
| 2026-09-22 | UI copy says "device" instead of "phone" where the web app shows the same string (privacy notes, file and scan hints, empty list) | The text is shown in browsers on computers too |

## 11. Build phases and status

Do phases in order. Phases 3 and 4 may run in parallel after phase 2. A phase is done only when every checkbox is ticked, `npx tsc --noEmit` passes, and all tests pass.

### Phase 1 — Foundation
- [x] Expo project, TypeScript strict, ESLint, Prettier, Jest
- [x] GitHub Actions: typecheck, lint and Jest on every push
- [x] SQLite + Drizzle schema and migrations (§9)
- [x] Route shell for §5 with placeholder screens; 3 tabs
- [x] i18next with `en` complete and keys for all other languages; RTL layout works
- [x] Create, edit, delete memorizations (text and script) with chunk preview, script warnings, tags and search

### Phase 2 — Core games
- [x] `src/engine` complete with tests (§6)
- [x] Chunk / range / all selector and focus-speaker filter
- [x] Tap to Reveal, Slider, First Letter, Fill in the Blank, Sentence Scramble, Type It, Multiple Choice
- [x] Session results screen, celebration, session saved

### Phase 3 — Review system
- [x] `src/scheduler` complete with tests (§8)
- [x] Target date step with schedule preview
- [x] Local notifications, rescheduled on app start
- [x] Progress rings, headline score, stats chart

### Phase 4 — Voice
- [x] Device TTS voice picker (language, accent, speed) and help for downloading voices
- [x] Listen game
- [x] Speak game with availability checks, on-device recognition
- [x] Run Scene with per-role and narration voices
- [x] My Recordings (limits, out-of-date warning)

### Phase 5 — Polish and release
- [x] Add from camera or photo with on-device OCR
- [x] Import `.txt` / `.md` files; share text to and from Linewise
- [x] Backup export and restore, with the monthly reminder
- [x] Onboarding questions and First Letter demo
- [x] Settings screen complete, FAQ, "report a problem" link to GitHub Issues (opens the browser; the app itself makes no network calls)
- [x] All 11 translations complete
- [x] Airplane-mode check: every feature works with no connection
- [x] Maestro flows: onboarding, add text, each game, review day, backup and restore
- [x] GitHub Actions release workflow: on a `v*` tag, build a signed release APK and attach it to a GitHub Release
- [x] README: what the app does, how to install the APK (allow installs from unknown sources), how to build it locally

### Phase 6 — Web
- [x] Web build (Metro, single-page output) with web twins for the database, recordings, backup, file import, reminders, share intent and OCR
- [x] Speak and Run Scene hidden on the web with an "Android app only" message
- [x] RTL and language switching without a restart on the web
- [x] PWA: manifest, icons, service worker (Workbox) precaching the app shell; OCR files cached on first use
- [x] `public/_headers`: cross-origin isolation and a same-site-only Content-Security-Policy, checked in CI
- [x] CI builds the web app; the release workflow deploys it to Cloudflare Pages
- [x] Owner: create the Cloudflare Pages project `linewise` and add the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets

## 12. Open questions for the owner

Use the defaults above until these are answered, then update §10.

- Pass mark and interval list (§8).
- Should backups include recordings (bigger files)?

### Verification status (2026-09-21)

Every box above is ticked because the feature is built. What has and has not been checked:

- **Checked automatically:** `npx tsc --noEmit`, ESLint with zero warnings and all Jest tests (engine, scheduler, game logic, real SQLite migrations and repository, backup replace/merge, session and review flow, all 11 locales, offline guard, signing plugin, Maestro flow ids and texts).
- **Built:** a signed release APK (arm64-v8a and x86_64) builds with Gradle. `aapt2` shows it has no `INTERNET` permission, and `apksigner` shows it is signed with the supplied key, not the debug key.
- **Run on a real phone** (Samsung Galaxy S24, Android 16, the signed v1.0.0 release APK): onboarding, adding a text, Tap to Reveal, Slider, Type It through to the result and the scheduled review, the Add screen, and the Speak readiness checks. That pass found and fixed hidden words showing through, First Letter dropping batched letters, a frozen auto-title, one-piece Tap to Reveal on unpunctuated text, and Speak hiding the "download the language pack" guidance behind a raw error.
- **Not yet run on a device:** the remaining games (First Letter, Fill in the Blank, Sentence Scramble, Multiple Choice, Listen, Run Scene, My Recordings), speech recognition and text to speech end to end, camera/OCR, notifications, and share-intent. The airplane-mode item is covered by the manifest and code checks above, not by using the app offline.
- **Maestro flows** are written and validated against the app's ids and strings, but have not been executed.
- **GitHub Actions workflows** have run on GitHub: CI on every push, and the release workflow for v1.0.0 to v1.1.2, each building a signed APK, publishing the GitHub Release and (since v1.1.0) deploying the web app.
- **Update check** (2026-09-22): tests cover the version comparison, GitHub's reply, the choice of the APK asset, and refusing a download from anywhere but the releases page. The web app shows "the web app updates itself" in Settings and asks GitHub for nothing. Not yet run on a device: the prompt at launch, the download link, and the toggle in Settings.
- **Web app** (2026-09-22, headless Chrome against `scripts/serve-web.js` with the real `_headers`): the page is cross-origin isolated under the CSP, the service worker installs and the app reloads with the network off, and no request leaves the site. Onboarding, adding a text, Type It (100% result), the backup screen, Arabic (RTL), and photo OCR of printed English (read correctly in under 2 s) all work. Not yet checked: Firefox and Safari, installing the PWA, backup download and restore, and recordings. The first Cloudflare deploy (v1.1.0) failed to open the database because its WebAssembly file was not uploaded. v1.1.1 uploaded it, but browsers that had opened v1.1.0 kept their cached copy of the old SQLite worker and still failed; fixed in v1.1.2, checked by serving a v1.1.0-style build and then the new build to the same Chrome profile. On the live site (v1.1.1, headless Chrome) a first visit opens the database and the service worker installs and takes control. Known issue: loading the same URL again in the same tab (not a reload), or opening Linewise in a second tab, shows "The app's data could not be opened" (`NoModificationAllowedError`), because expo-sqlite's web storage lets only one page hold the database at a time. Reloading the page fixes the first case.
- Translations were written for this project and are checked for structure and placeholders, not reviewed by native speakers.
