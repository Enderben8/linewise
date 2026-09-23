import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Chunk } from '../engine/types';
import type { GameId } from '../games/ids';

/** Mirrors SPEC.md §9. Every schema change needs a new migration in ./migrations.ts. */

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
});

/** One level of folders for grouping texts (SPEC §10). A text is in at most one folder. */
export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const memorizations = sqliteTable('memorizations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').notNull().default(''),
  language: text('language').notNull().default('en'),
  type: text('type', { enum: ['text', 'script'] })
    .notNull()
    .default('text'),
  body: text('body').notNull(),
  bodyHash: text('body_hash').notNull(),
  chunks: text('chunks', { mode: 'json' }).$type<Chunk[]>().notNull(),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  /** `null` when the text is in no folder. Deleting a folder leaves its texts in no folder. */
  folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
});

export const progress = sqliteTable('progress', {
  memorizationId: text('memorization_id')
    .primaryKey()
    .references(() => memorizations.id, { onDelete: 'cascade' }),
  targetDueDate: integer('target_due_date'),
  intervalIndex: integer('interval_index').notNull().default(0),
  nextReviewAt: integer('next_review_at'),
  headlineScore: real('headline_score').notNull().default(0),
  solidifyScores: text('solidify_scores', { mode: 'json' })
    .$type<Partial<Record<GameId, number>>>()
    .notNull(),
  /** Word positions hidden in Fill in the Blank, keyed `${chunkIndex}:${wordIndex}`. Reset when the text changes. */
  hiddenWords: text('hidden_words', { mode: 'json' }).$type<string[]>().notNull(),
  /** Speaker name -> voice identifier, for Run Scene. `""` is the narrator. */
  voiceOverrides: text('voice_overrides', { mode: 'json' })
    .$type<Record<string, string>>()
    .notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  memorizationId: text('memorization_id')
    .notNull()
    .references(() => memorizations.id, { onDelete: 'cascade' }),
  game: text('game').$type<GameId>().notNull(),
  chunkStart: integer('chunk_start').notNull(),
  chunkEnd: integer('chunk_end').notNull(),
  accuracy: real('accuracy').notNull(),
  coverage: real('coverage').notNull(),
  weightedScore: real('weighted_score').notNull(),
  countedForReview: integer('counted_for_review', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});

export const recordings = sqliteTable('recordings', {
  id: text('id').primaryKey(),
  memorizationId: text('memorization_id')
    .notNull()
    .references(() => memorizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  fileUri: text('file_uri').notNull(),
  durationSec: real('duration_sec').notNull(),
  bodyHash: text('body_hash').notNull(),
  createdAt: integer('created_at').notNull(),
});

export type FolderRow = typeof folders.$inferSelect;
export type Memorization = typeof memorizations.$inferSelect;
export type ProgressRow = typeof progress.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type RecordingRow = typeof recordings.$inferSelect;

export const schema = { settings, folders, memorizations, progress, sessions, recordings };
