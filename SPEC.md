# Rebuild Spec: Linewise

A spec for rebuilding the core features of **Memorize By Heart 5.9.10** (the APK in this folder) as a new app called **Linewise**. You are building a feature-equivalent app, not a copy. Read this whole file before starting work.

Status tracking is at the bottom (§11). Update it when you finish a task.

---

## 1. Ground rules

1. **Do not copy the original's brand or assets.** The app is called **Linewise**: Android package `app.linewise`, URL scheme `linewise`. Make a new logo, mascot images, colours and UI copy. Never use the original's package ID (`com.memorize_by_heart`), scheme or text.
2. **Never use anything from `Memorize By Heart_5.9.10 (2).apk` in the new code.** Its `app.config` has a keystore password and Google API keys in plain text. Do not copy them, print them or commit them.
3. **Fully offline. No backend, no accounts, no network calls.** Do not add a server, a database service, sign-in, analytics, crash reporting or any SDK that talks to the internet. The app must work in airplane mode, and must not request the `INTERNET` permission unless a later decision in §10 allows it.
4. **No paid services and no API keys.** Everything runs on the phone. The only secret in the project is the Android signing keystore, which lives only in GitHub Actions secrets.
5. **Build the text engine (§6) first and unit-test it.** Every game depends on it.
6. **Everything is free.** Do not add a paywall, subscription, trial, ads or any "Premium" check. The original app gates many features behind Premium; ignore that.
7. When a decision here is marked *(default)*, use it without asking. Record any change in §10.

## 2. Product summary

Users add a text (a poem, verse, speech or play script) and split it into chunks. They practise with 11 game modes, including speech recognition. Reviews come at spaced-repetition intervals, with reminders toward an optional target date. All data stays on the phone. Every feature is free.

**Platform and distribution:** Android only. The app is not published to any app store. Signed release APKs are built by GitHub Actions and attached to GitHub Releases, and users install them directly. Do not add iOS-only work, app store listings or store review prompts. Keep the code cross-platform where it costs nothing, but test and ship Android only.

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
| 2026-09-21 | Mobile only. No web app | Owner's decision |
| 2026-09-21 | Android only, distributed as APKs on GitHub Releases. No iOS, no app stores | Owner's decision |
| 2026-09-21 | App name Linewise, package `app.linewise` | Owner asked Claude to choose |
| 2026-09-21 | Fully offline, no backend and no accounts. Dropped: sign-in, cloud sync, Library, groups, leaderboards, AI voices, PDF import | Owner does not want Supabase, Google Cloud or any paid service |
| 2026-09-21 | Backup export/import to a JSON file replaces cloud backup | Otherwise a lost phone loses all data |

## 11. Build phases and status

Do phases in order. Phases 3 and 4 may run in parallel after phase 2. A phase is done only when every checkbox is ticked, `npx tsc --noEmit` passes, and all tests pass.

### Phase 1 — Foundation
- [ ] Expo project, TypeScript strict, ESLint, Prettier, Jest
- [ ] GitHub Actions: typecheck, lint and Jest on every push
- [ ] SQLite + Drizzle schema and migrations (§9)
- [ ] Route shell for §5 with placeholder screens; 3 tabs
- [ ] i18next with `en` complete and keys for all other languages; RTL layout works
- [ ] Create, edit, delete memorizations (text and script) with chunk preview, script warnings, tags and search

### Phase 2 — Core games
- [ ] `src/engine` complete with tests (§6)
- [ ] Chunk / range / all selector and focus-speaker filter
- [ ] Tap to Reveal, Slider, First Letter, Fill in the Blank, Sentence Scramble, Type It, Multiple Choice
- [ ] Session results screen, celebration, session saved

### Phase 3 — Review system
- [ ] `src/scheduler` complete with tests (§8)
- [ ] Target date step with schedule preview
- [ ] Local notifications, rescheduled on app start
- [ ] Progress rings, headline score, stats chart

### Phase 4 — Voice
- [ ] Device TTS voice picker (language, accent, speed) and help for downloading voices
- [ ] Listen game
- [ ] Speak game with availability checks, on-device recognition
- [ ] Run Scene with per-role and narration voices
- [ ] My Recordings (limits, out-of-date warning)

### Phase 5 — Polish and release
- [ ] Add from camera or photo with on-device OCR
- [ ] Import `.txt` / `.md` files; share text to and from Linewise
- [ ] Backup export and restore, with the monthly reminder
- [ ] Onboarding questions and First Letter demo
- [ ] Settings screen complete, FAQ, "report a problem" link to GitHub Issues (opens the browser; the app itself makes no network calls)
- [ ] All 11 translations complete
- [ ] Airplane-mode check: every feature works with no connection
- [ ] Maestro flows: onboarding, add text, each game, review day, backup and restore
- [ ] GitHub Actions release workflow: on a `v*` tag, build a signed release APK and attach it to a GitHub Release
- [ ] README: what the app does, how to install the APK (allow installs from unknown sources), how to build it locally

## 12. Open questions for the owner

Use the defaults above until these are answered, then update §10.

- Pass mark and interval list (§8).
- Should backups include recordings (bigger files)?
