# Rebuild Spec: Linewise

A spec for rebuilding the features of **Memorize By Heart 5.9.10** (the APK in this folder) as a new app called **Linewise**. You are building a feature-equivalent app, not a copy. Read this whole file before starting work.

Status tracking is at the bottom (§12). Update it when you finish a task.

---

## 1. Ground rules

1. **Do not copy the original's brand or assets.** The app is called **Linewise**: Android package `app.linewise`, URL scheme `linewise`. Make a new logo, mascot images, colours and UI copy. Never use the original's package ID (`com.memorize_by_heart`), scheme or text.
2. **Never use anything from `Memorize By Heart_5.9.10 (2).apk` in the new code.** Its `app.config` has a keystore password and Google API keys in plain text. Do not copy them, print them or commit them.
3. **Keep secrets off the device.** Put API keys (OpenAI, Google Vision) only in Cloud Functions config or secrets. Put the Android signing keystore and its passwords only in GitHub Actions secrets. Never put a key in `app.config`, `.env` files that ship with the client, or source code.
4. **Anything that crosses users, costs money or enforces a limit runs in a Cloud Function.** The client only writes to its own user-scoped data.
5. **Build the text engine (§6) first and unit-test it.** Every game depends on it.
6. **Everything is free.** Do not add a paywall, subscription, trial, ads or any "Premium" check. The original app gates many features behind Premium; ignore that.
7. When a decision here is marked *(default)*, use it without asking. Record any change in §11.

## 2. Product summary

Users add a text (a poem, verse, speech or play script) and split it into chunks. They practise with 11 game modes, including speech recognition. Reviews come at spaced-repetition intervals, with optional reminders toward a target date. Social features include a public Library and groups with leaderboards. **Every feature is free for every user.** There is no Premium tier, paywall, subscription or in-app purchase.

**Platform and distribution:** Android only. The app is not published to any app store. Signed release APKs are built by GitHub Actions and attached to GitHub Releases, and users install them directly. Do not add iOS-only work, Apple sign-in, app store listings or store review prompts. Keep the code cross-platform where it costs nothing, but test and ship Android only.

## 3. Tech stack (fixed)

| Concern | Use |
| --- | --- |
| App | Expo SDK (latest stable), TypeScript `strict`, expo-router |
| State | Redux Toolkit for app state, TanStack Query for Firestore reads. Game state lives in the screen component or a local reducer |
| UI | FlashList, react-native-reanimated, react-native-gesture-handler, react-native-draggable-flatlist, react-native-svg |
| Auth | Firebase Auth (`@react-native-firebase/auth`): email/password with verification and reset, Google. No Apple sign-in |
| Data | Cloud Firestore (`@react-native-firebase/firestore`) with offline persistence |
| Server | Cloud Functions v2 (TypeScript, callable functions), Cloud Storage |
| Speech to text | `expo-speech-recognition` |
| Text to speech | `expo-speech` (device voices). OpenAI TTS through a Function for natural voices |
| Audio | `expo-audio` with background playback |
| OCR | `expo-camera` / `expo-image-picker`, then Google Cloud Vision **through a Function** |
| File import | `expo-document-picker`, then text extraction in a Function |
| Notifications | `expo-notifications` (local scheduled only) |
| i18n | `expo-localization` + `i18next`. Languages: en, es, fr, de, fil, pt-BR, nl, hi, ar, zh-Hans, he (ar and he are RTL) |
| Monitoring | Firebase Crashlytics + Analytics |
| Tests | Jest (unit), Firebase Emulator Suite (rules and Functions), Maestro (end to end) |
| Build | `npx expo prebuild` + Gradle `assembleRelease`, run in GitHub Actions. No EAS, no store submission. Updates ship as new APKs |

Do not add a library that duplicates one of these without recording why in §11.

## 4. Repository layout

```
app/                      expo-router routes (see §5)
src/
  engine/                 text engine: pure TS, no React, 100% unit-tested
  scheduler/              spaced-repetition maths: pure TS
  games/                  one folder per game: component + reducer + scoring
  features/               auth, library, groups, voices, recordings, settings
  services/firebase/      typed Firestore/Functions/Storage wrappers
  store/                  Redux slices
  i18n/                   i18next setup + locales/<lang>.json
  components/             shared UI
functions/                Cloud Functions (own package.json)
.github/workflows/        CI: typecheck + tests on every push; release APK on version tags
firestore.rules
storage.rules
e2e/                      Maestro flows
```

## 5. Screens (expo-router)

```
app/_layout.tsx
app/index.tsx                         redirect: onboarding or tabs
app/auth/{login,signup,password}.tsx
app/onboarding/...                    questions + one-minute First Letter demo
app/(tabs)/_layout.tsx                5 tabs
app/(tabs)/memorizations/index.tsx    list with progress rings
app/(tabs)/memorizations/[id]/index.tsx       detail + game picker
app/(tabs)/memorizations/[id]/{tap-to-reveal,slider,listen,first-letter,fill-in-the-blank,sentence-scramble,type-it,multiple-choice,speak,run-scene,my-recordings}.tsx
app/(tabs)/memorizations/[id]/{stats,notifications,see-full-text,edit-text}.tsx
app/(tabs)/add/{index,edit-text,camera-recognition,library}.tsx
app/(tabs)/library/index.tsx
app/(tabs)/groups/index.tsx
app/(tabs)/groups/[groupId]/{index,members,settings,edit-text,camera-recognition}.tsx
app/(tabs)/groups/[groupId]/memorizations/[id]/...   same game routes, group context
app/(tabs)/settings/index.tsx
```

Group routes reuse the same game components. Pass group context as a route param; do not copy components.

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
| Listen | Practice | TTS or a saved recording reads the text. Speed, repeat, pause/resume, follow-along highlight | No |
| First Letter | Solidify | Show blanks. User types the first letter of each word. Wrong letter: haptic buzz, mark wrong, move on | Yes |
| Fill in the Blank | Solidify | Hide some words and offer choices. User can pick which words to hide (saved per memorization, reset if the text changes) | Yes |
| Sentence Scramble | Solidify | Drag scrambled sentences into order, then tap Done | Yes |
| Type It | Evaluate | Type the whole selection from memory, scored with `align` | Yes |
| Multiple Choice | Evaluate | Pick the correct next word or phrase from 4 options | Yes |
| Speak | Evaluate | Recite. Speech recognition transcript scored with `align`. Shows missed and extra words | Yes |
| Run Scene | Evaluate (scripts only) | User picks a role. App speaks other roles and action cues (per-role voices), listens for the user's lines, then scores them | Yes |
| My Recordings | Practice | Record, rename, delete. Set one as the Listen source. Warn if recorded before the last text change | No |

Speech games must check microphone permission, recognition availability and TTS availability **before** starting, and explain what to enable if one is missing.

On finishing a scored game, show the result, play a celebration (confetti + a mascot reaction), and write a session (§8).

## 8. Review system (`src/scheduler`)

*(All defaults. Keep them in one config object so they can be tuned.)*

- Intervals in days: `[1, 2, 4, 7, 14, 30, 60]`.
- A **review day** is when `now >= nextReviewAt`. Only the **first** Solidify or Evaluate session on a review day counts. If its `weightedScore >= 0.8`, advance `intervalIndex` and set `nextReviewAt`. Otherwise keep the interval and set `nextReviewAt` to tomorrow.
- Sessions outside review days are practice only and do not affect progression.
- **Target date:** scale the remaining intervals so the final review lands on the target date. Never go below 1 day.
- Optional setting: reset Solidify scores at each new interval.
- After a counting session, cancel the old reminder and schedule one local notification at `nextReviewAt`.
- **Headline score** = best Evaluate `weightedScore` in the current cycle.
- **Progress rings:** outer = percent memorized (headline score); inner = progress through the current cycle (`intervalIndex / intervals.length`).
- **Stats:** monthly bar chart of scored sessions per day; tap a day to list games and scores.

## 9. Data model (Firestore)

| Path | Fields | Who writes |
| --- | --- | --- |
| `users/{uid}` | displayName, avatarUrl, locale, defaultLanguage, settings{fontSize, speechRate, notifications, resetSolidifyEachInterval} | Client |
| `memorizations/{id}` | ownerUid, title, author, language, type, body, bodyHash, chunks, tags[], visibility, sourceLibraryId? | Owner client. Public items: Function only |
| `users/{uid}/progress/{memId}` | targetDueDate?, intervalIndex, nextReviewAt, headlineScore, solidifyScores, hiddenWords{bodyHash, indexes}, voiceOverrides | Client |
| `users/{uid}/sessions/{id}` | memId, game, chunkRange, accuracy, coverage, weightedScore, countedForReview, createdAt | Client, create only |
| `users/{uid}/recordings/{id}` | memId, name, storagePath, durationSec, bodyHash | Client |
| `library/{id}` | memId, title, author, tags[], language, downloads, publishedBy, publishedAt | Function only |
| `groups/{id}` | name, ownerUid, leaderboardEnabled, joinApproval, memIds[] | Function only |
| `groups/{id}/members/{uid}` | role (owner/admin/member), status (active/pending), joinedAt | Function only |
| `groups/{id}/leaderboard/{uid}` | score, updatedAt | Function (trigger on session create) |
| `aiVoices/{key}` | memId, voice, chunkIndex, bodyHash, storagePath | Function only |

Security rules must enforce the "who writes" column. Write emulator tests for each row.

## 10. Cloud Functions

| Function | Checks | Does |
| --- | --- | --- |
| `publishToLibrary` | signed in, email verified, online | Makes the memorization public, creates `library/{id}`. Irreversible |
| `addFromLibrary` | signed in | Adds a Library item to the user's list or a group; increments downloads |
| `createGroup` | signed in, email verified, under group cap | Creates group, caller becomes owner |
| `joinGroup` | signed in, email verified, under member cap | Adds member, or pending if `joinApproval` |
| `approveMember` / `removeMember` / `setRole` | caller is owner or admin | Updates members |
| `transferOwnership` / `deleteGroup` | caller is owner | Transfer or delete (delete removes members, shared items, leaderboard) |
| `addToGroup` | caller is owner or admin, under memorization cap | Adds memorization to group |
| `generateNaturalVoice` | signed in, email verified, daily limit | OpenAI TTS for the selected chunks, cached by `bodyHash`, saved to Storage |
| `ocrImage` | signed in, daily limit | Google Vision on an uploaded image, returns text |
| `importFile` | signed in, daily limit | Extracts text from PDF/doc; saves first 5 pages if longer and says so |
| `deleteAccount` | signed in | Deletes all user data, Storage files and the Auth user |

### Limits *(defaults, keep in one server config)*

Everything is free, so these limits are the same for every user. They exist only to control running costs (OpenAI, Google Vision) and abuse. Do not build any paid way around them.

| Limit | Value |
| --- | --- |
| Memorizations per user | Unlimited |
| Groups owned per user | 5 |
| Members per group | 50 |
| Memorizations per group | 100 |
| Recordings per memorization | 10, max 10 min each |
| Natural voice generations per user per day | 20 |
| OCR scans and file imports per user per day | 20 |

## 11. Decisions log

Add a row when you change a default or make a call not covered here.

| Date | Decision | Why |
| --- | --- | --- |
| 2026-09-21 | All features free. No Premium tier, paywall, RevenueCat or in-app purchases | Owner's decision |
| 2026-09-21 | Mobile only. No web app | Owner's decision |
| 2026-09-21 | Android only, distributed as APKs on GitHub Releases. No iOS, no app stores, no Apple sign-in | Owner's decision |
| 2026-09-21 | App name Linewise, package `app.linewise` | Owner asked Claude to choose |

## 12. Build phases and status

Do phases in order. Phases 3 and 4 may run in parallel after phase 2. A phase is done only when every checkbox is ticked, `npx tsc --noEmit` passes, and all tests pass.

### Phase 1 — Foundation
- [ ] Expo project, TypeScript strict, ESLint, Prettier, Jest
- [ ] GitHub Actions: typecheck, lint and tests on every push
- [ ] Two Firebase projects (dev, prod); emulator config
- [ ] Route shell for §5 with placeholder screens; 5 tabs
- [ ] i18next with `en` complete and keys for all other languages; RTL layout works
- [ ] Auth: email/password (verify + reset), Google (register the debug and release keystore SHA-1s in Firebase)
- [ ] Create, edit, delete memorizations (text and script) with chunk preview and script warnings
- [ ] Offline persistence on

### Phase 2 — Core games
- [ ] `src/engine` complete with tests (§6)
- [ ] Chunk / range / all selector and focus-speaker filter
- [ ] Tap to Reveal, Slider, First Letter, Fill in the Blank, Sentence Scramble, Type It, Multiple Choice
- [ ] Session results screen, celebration, session write

### Phase 3 — Review system
- [ ] `src/scheduler` complete with tests (§8)
- [ ] Target date step with schedule preview
- [ ] Local notifications
- [ ] Progress rings, headline score, stats chart

### Phase 4 — Voice
- [ ] Device TTS voice picker (language, accent, speed) and help for downloading voices
- [ ] Listen game
- [ ] Speak game with availability checks
- [ ] Run Scene with per-role and narration voices
- [ ] My Recordings (Storage upload, limits, out-of-date warning)
- [ ] `generateNaturalVoice` Function and natural voice UI

### Phase 5 — Social
- [ ] Library: search (title/author, min 3 chars), tag filter (max 10), top downloads, add to list or group
- [ ] Publish with irreversible warning
- [ ] Groups: create, join by link or ID, approval, roles, transfer, delete
- [ ] Group leaderboard with admin toggle
- [ ] Security rules + emulator tests for every collection

### Phase 6 — Polish
- [ ] All limits enforced server-side (§10)
- [ ] OCR and file import
- [ ] Full Offline Mode (local store, sync paused, online-only features explain why they are off)
- [ ] Onboarding questions and First Letter demo
- [ ] Profile (name, avatar), settings, FAQ, contact form, account deletion
- [ ] All 11 translations complete
- [ ] Maestro flows: onboarding, add text, each game, review day, join group
- [ ] GitHub Actions release workflow: on a `v*` tag, build a signed release APK and attach it to a GitHub Release
- [ ] README: what the app does, how to install the APK (allow installs from unknown sources), how to build it locally

## 13. Open questions for the owner

Use the defaults above until these are answered, then update §11.

- Final values for the usage limits (§10).
- Pass mark and interval list (§8).
