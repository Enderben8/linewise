# Rebuild Spec: Linewise

A spec for rebuilding the features of **Memorize By Heart 5.9.10** (the APK in this folder) as a new app called **Linewise**. You are building a feature-equivalent app, not a copy. Read this whole file before starting work.

Status tracking is at the bottom (§12). Update it when you finish a task.

---

## 1. Ground rules

1. **Do not copy the original's brand or assets.** The app is called **Linewise**: Android package `app.linewise`, URL scheme `linewise`. Make a new logo, mascot images, colours and UI copy. Never use the original's package ID (`com.memorize_by_heart`), scheme or text.
2. **Never use anything from `Memorize By Heart_5.9.10 (2).apk` in the new code.** Its `app.config` has a keystore password and Google API keys in plain text. Do not copy them, print them or commit them.
3. **Keep secrets off the device.** The app may contain only the Supabase project URL and publishable (anon) key. They are public by design, and Row Level Security protects the data. The Supabase service-role key lives only in Edge Function secrets. The Android signing keystore and its passwords live only in GitHub Actions secrets. Never put any other key in `app.config`, a shipped `.env` file or source code.
4. **Anything that crosses users or enforces a limit runs on the server**, as a Postgres function (RPC) or an Edge Function. Row Level Security lets the client write only its own rows.
5. **No paid services.** Everything must run on free plans with no card on file: Supabase Free, GitHub, and on-device features. Do not add OpenAI, Google Cloud Vision, Firebase or any other service that needs billing.
6. **Build the text engine (§6) first and unit-test it.** Every game depends on it.
7. **Everything is free.** Do not add a paywall, subscription, trial, ads or any "Premium" check. The original app gates many features behind Premium; ignore that.
8. When a decision here is marked *(default)*, use it without asking. Record any change in §11.

## 2. Product summary

Users add a text (a poem, verse, speech or play script) and split it into chunks. They practise with 11 game modes, including speech recognition. Reviews come at spaced-repetition intervals, with optional reminders toward a target date. Social features include a public Library and groups with leaderboards. **Every feature is free for every user.** There is no Premium tier, paywall, subscription or in-app purchase.

**Platform and distribution:** Android only. The app is not published to any app store. Signed release APKs are built by GitHub Actions and attached to GitHub Releases, and users install them directly. Do not add iOS-only work, Apple sign-in, app store listings or store review prompts. Keep the code cross-platform where it costs nothing, but test and ship Android only.

## 3. Tech stack (fixed)

| Concern | Use |
| --- | --- |
| App | Expo SDK (latest stable), TypeScript `strict`, expo-router, development build via `npx expo prebuild` (not Expo Go) |
| State | Redux Toolkit for app state. TanStack Query for online-only reads (Library, groups). Game state lives in the screen component or a local reducer |
| Local data | `expo-sqlite` + Drizzle ORM. The device is the source of truth for the user's own data (see §9 Sync) |
| UI | FlashList, react-native-reanimated, react-native-gesture-handler, react-native-draggable-flatlist, react-native-svg |
| Backend | Supabase Free plan: Postgres with Row Level Security, Auth, Storage, Edge Functions (Deno). Client: `@supabase/supabase-js` |
| Auth | Supabase Auth: email/password with email confirmation and reset, and Google via `@react-native-google-signin/google-signin` + `signInWithIdToken`. No Apple sign-in |
| Speech to text | `expo-speech-recognition` (on-device) |
| Text to speech | `expo-speech` (device voices only). No AI voices |
| Audio | `expo-audio` with background playback. Recordings stay on the device (`expo-file-system`) |
| OCR | `expo-camera` / `expo-image-picker`, then on-device ML Kit text recognition (`@react-native-ml-kit/text-recognition`). No cloud OCR |
| File import | `expo-document-picker`. Plain text and Markdown are read on the device. PDFs go to the `import-file` Edge Function |
| Notifications | `expo-notifications` (local scheduled only) |
| i18n | `expo-localization` + `i18next`. Languages: en, es, fr, de, fil, pt-BR, nl, hi, ar, zh-Hans, he (ar and he are RTL) |
| Monitoring | None at first. Add the Sentry free plan later only if the owner agrees (record in §11) |
| Tests | Jest (unit), Supabase CLI local stack + pgTAP (`supabase test db`) for RLS and RPCs, Maestro (end to end) |
| Build | `npx expo prebuild` + Gradle `assembleRelease`, run in GitHub Actions. No EAS, no store submission. Updates ship as new APKs |

Supabase Free limits to design within: 500 MB database, 1 GB file storage, 5 GB egress a month, 500,000 Edge Function calls a month, 2 active projects. **A free project pauses after 1 week with no activity.** The owner restores it from the Supabase dashboard. The app must keep working offline while the backend is paused.

Do not add a library that duplicates one of these without recording why in §11.

## 4. Repository layout

```
app/                      expo-router routes (see §5)
src/
  engine/                 text engine: pure TS, no React, 100% unit-tested
  scheduler/              spaced-repetition maths: pure TS
  games/                  one folder per game: component + reducer + scoring
  features/               auth, library, groups, voices, recordings, settings
  db/                     Drizzle schema, migrations and queries for the local SQLite store
  sync/                   push/pull between SQLite and Supabase
  services/supabase/      typed client, RPC wrappers, generated types (`supabase gen types`)
  store/                  Redux slices
  i18n/                   i18next setup + locales/<lang>.json
  components/             shared UI
supabase/
  migrations/             SQL: tables, RLS policies, RPC functions, triggers
  functions/              Edge Functions (import-file, delete-account)
  tests/                  pgTAP tests
  config.toml
.github/workflows/        CI: typecheck, lint, tests on every push; release APK on version tags
e2e/                      Maestro flows
.env.example              EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
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
| Listen | Practice | Device TTS or a saved recording reads the text. Speed, repeat, pause/resume, follow-along highlight | No |
| First Letter | Solidify | Show blanks. User types the first letter of each word. Wrong letter: haptic buzz, mark wrong, move on | Yes |
| Fill in the Blank | Solidify | Hide some words and offer choices. User can pick which words to hide (saved per memorization, reset if the text changes) | Yes |
| Sentence Scramble | Solidify | Drag scrambled sentences into order, then tap Done | Yes |
| Type It | Evaluate | Type the whole selection from memory, scored with `align` | Yes |
| Multiple Choice | Evaluate | Pick the correct next word or phrase from 4 options | Yes |
| Speak | Evaluate | Recite. Speech recognition transcript scored with `align`. Shows missed and extra words | Yes |
| Run Scene | Evaluate (scripts only) | User picks a role. App speaks other roles and action cues (per-role voices), listens for the user's lines, then scores them | Yes |
| My Recordings | Practice | Record, rename, delete. Set one as the Listen source. Warn if recorded before the last text change. Stored on the device only, never uploaded | No |

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

## 9. Data model (Supabase Postgres)

All ids are UUIDs generated on the device, so rows can be created offline. Every synced table has `updated_at timestamptz` and a `deleted boolean` soft-delete flag.

| Table | Columns | Who writes |
| --- | --- | --- |
| `profiles` | id (= `auth.users.id`), display_name, avatar_path, locale, default_language, settings jsonb, updated_at | Owner (RLS) |
| `memorizations` | id, owner_id, title, author, language, type (`text`/`script`), body, body_hash, chunks jsonb, tags text[], visibility (`private`/`public`), source_library_id, updated_at, deleted | Owner while private. Public rows: RPC only |
| `progress` | user_id + memorization_id (primary key), target_due_date, interval_index, next_review_at, headline_score, solidify_scores jsonb, hidden_words jsonb, voice_overrides jsonb, updated_at | Owner (RLS) |
| `sessions` | id, user_id, memorization_id, game, chunk_start, chunk_end, accuracy, coverage, weighted_score, counted_for_review, created_at | Owner, insert only (RLS) |
| `library_items` | id, memorization_id, title, author, tags text[], language, downloads, published_by, published_at | RPC only. Any signed-in user can read. `pg_trgm` index on title and author |
| `groups` | id, name, owner_id, leaderboard_enabled, join_approval, invite_code, created_at | RPC only. Members can read |
| `group_members` | group_id, user_id, role (`owner`/`admin`/`member`), status (`active`/`pending`), joined_at | RPC only. Members can read |
| `group_memorizations` | group_id, memorization_id, added_by, added_at | RPC only. Members can read |

Storage: one `avatars` bucket (public read, owner write, max 200 KB per image, resized on the device). Nothing else is uploaded.

RLS must be on for every table and must enforce the "who writes" column. Write pgTAP tests proving that a user cannot read or change another user's private rows, cannot write `library_items` or the group tables directly, and cannot read a group they are not an active member of. Active group members can read the memorizations shared with their group.

**Recordings** are not in Postgres. Keep them in the local SQLite store (id, memorization_id, name, file_uri, duration_sec, body_hash), with the audio file in the app's document directory.

### Sync

- The local SQLite store is the source of truth for the user's `profiles` row, their own `memorizations`, `progress` and `sessions`.
- Each local write marks the row dirty. When signed in and online, push dirty rows with `upsert`, then pull rows whose `updated_at` is newer than the last pull. On conflict, the later `updated_at` wins.
- Sessions are insert-only, so they never conflict.
- Offline Mode (a setting) stops sync completely until it is turned off. The Library, groups and publishing show an "online only" message instead.

## 10. Server logic

Postgres functions, `security definer`, called with `supabase.rpc()`. Each checks `auth.uid()` and the rules below, and raises a clear error code the app can translate.

| RPC | Checks | Does |
| --- | --- | --- |
| `publish_to_library(mem_id)` | owner, email confirmed | Sets visibility to public and creates a `library_items` row. Irreversible |
| `add_from_library(item_id, group_id?)` | signed in; owner or admin if a group is given | Adds the item to the user's list or the group; increments downloads |
| `create_group(name)` | email confirmed, under group cap | Creates the group with a random invite code; caller becomes owner |
| `join_group(invite_code)` | email confirmed, under member cap | Adds the caller, as `pending` if `join_approval` is on |
| `approve_member` / `remove_member` / `set_role` | caller is owner or admin | Updates `group_members` |
| `transfer_ownership` / `delete_group` | caller is owner | Transfers, or deletes the group with its members and shared links |
| `add_to_group(group_id, mem_id)` | owner or admin, under memorization cap | Adds a row to `group_memorizations` |
| `group_leaderboard(group_id)` | caller is an active member, leaderboard enabled | Returns each member's best weighted score on the group's memorizations |

Edge Functions (Deno):

| Function | Checks | Does |
| --- | --- | --- |
| `import-file` | signed in, daily limit | Extracts text from an uploaded PDF (for example with `unpdf`) and returns it. Keeps the first 5 pages if longer and says so. Stores nothing |
| `delete-account` | signed in | Deletes all the user's rows, their avatar and the auth user (needs the service-role key) |

### Limits *(defaults, keep in one SQL config table)*

The same for every user. They exist only to stay inside the Supabase Free plan and to stop abuse. Do not build any paid way around them.

| Limit | Value |
| --- | --- |
| Memorizations per user | Unlimited |
| Memorization body size | 100 KB |
| Groups owned per user | 5 |
| Members per group | 50 |
| Memorizations per group | 100 |
| Recordings per memorization | 10, max 10 min each (on the device) |
| PDF imports per user per day | 20, max 10 MB per file |

## 11. Decisions log

Add a row when you change a default or make a call not covered here.

| Date | Decision | Why |
| --- | --- | --- |
| 2026-09-21 | All features free. No Premium tier, paywall, RevenueCat or in-app purchases | Owner's decision |
| 2026-09-21 | Mobile only. No web app | Owner's decision |
| 2026-09-21 | Android only, distributed as APKs on GitHub Releases. No iOS, no app stores, no Apple sign-in | Owner's decision |
| 2026-09-21 | App name Linewise, package `app.linewise` | Owner asked Claude to choose |
| 2026-09-21 | Supabase Free instead of Firebase. Firebase needs the card-on-file Blaze plan for Cloud Functions and Storage | Owner wants no paid services |
| 2026-09-21 | No OpenAI voices and no Google Cloud Vision. Device TTS and on-device ML Kit OCR instead. Recordings stay on the device | Owner wants no paid services |
| 2026-09-21 | Local-first: SQLite on the device, synced to Supabase | Works offline, and while a free project is paused |

## 12. Build phases and status

Do phases in order. Phases 3 and 4 may run in parallel after phase 2. A phase is done only when every checkbox is ticked, `npx tsc --noEmit` passes, and all tests pass.

### Phase 1 — Foundation
- [ ] Expo project, TypeScript strict, ESLint, Prettier, Jest
- [ ] GitHub Actions: typecheck, lint, Jest and pgTAP tests on every push
- [ ] Supabase: local stack via the Supabase CLI for development; one hosted Free project for releases. Schema only through `supabase/migrations`
- [ ] Local SQLite store with Drizzle, and the sync module (§9)
- [ ] Route shell for §5 with placeholder screens; 5 tabs
- [ ] i18next with `en` complete and keys for all other languages; RTL layout works
- [ ] Auth: email/password (confirm + reset), Google (Android OAuth clients for the debug and release keystore SHA-1s, plus a web client ID for Supabase)
- [ ] Create, edit, delete memorizations (text and script) with chunk preview and script warnings
- [ ] Works fully offline for the user's own data

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
- [ ] My Recordings (on-device files, limits, out-of-date warning)

### Phase 5 — Social
- [ ] Library: search (title/author, min 3 chars), tag filter (max 10), top downloads, add to list or group
- [ ] Publish with irreversible warning
- [ ] Groups: create, join by link or ID, approval, roles, transfer, delete
- [ ] Group leaderboard with admin toggle
- [ ] RLS policies and RPCs, with pgTAP tests for every table and RPC

### Phase 6 — Polish
- [ ] All limits enforced server-side (§10)
- [ ] On-device OCR (camera and photo) and file import (text on the device, PDF via `import-file`)
- [ ] Full Offline Mode (local store, sync paused, online-only features explain why they are off)
- [ ] Onboarding questions and First Letter demo
- [ ] Profile (name, avatar), settings, FAQ, a "report a problem" link to GitHub Issues, account deletion
- [ ] All 11 translations complete
- [ ] Maestro flows: onboarding, add text, each game, review day, join group
- [ ] GitHub Actions release workflow: on a `v*` tag, build a signed release APK and attach it to a GitHub Release
- [ ] README: what the app does, how to install the APK (allow installs from unknown sources), how to build it locally

## 13. Open questions for the owner

Use the defaults above until these are answered, then update §11.

- Final values for the usage limits (§10).
- Pass mark and interval list (§8).
