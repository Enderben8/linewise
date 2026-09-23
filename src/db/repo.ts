import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm';
import { hashBody, parseBody } from '../engine';
import type { BodyType } from '../engine';
import { newId } from '../lib/uuid';
import { newProgress, type ProgressState } from '../scheduler';
import { db } from './client';
import {
  folders,
  memorizations,
  progress,
  recordings,
  sessions,
  settings,
  type FolderRow,
  type Memorization,
  type ProgressRow,
  type RecordingRow,
  type SessionRow,
} from './schema';

export interface MemorizationInput {
  title: string;
  author: string;
  language: string;
  type: BodyType;
  body: string;
  tags: string[];
  /** Only used when creating. Leave out when editing: the folder is changed with `moveToFolder`. */
  folderId?: string | null;
}

export interface MemorizationWithProgress extends Memorization {
  progress: ProgressRow;
}

/* ---------- progress mapping ---------- */

export function rowToState(row: ProgressRow): ProgressState {
  return {
    intervalIndex: row.intervalIndex,
    nextReviewAt: row.nextReviewAt,
    targetDueDate: row.targetDueDate,
    headlineScore: row.headlineScore,
    solidifyScores: row.solidifyScores,
  };
}

function emptyProgressRow(memorizationId: string, now: number): ProgressRow {
  const p = newProgress();
  return {
    memorizationId,
    targetDueDate: p.targetDueDate,
    intervalIndex: p.intervalIndex,
    nextReviewAt: p.nextReviewAt,
    headlineScore: p.headlineScore,
    solidifyScores: {},
    hiddenWords: [],
    voiceOverrides: {},
    updatedAt: now,
  };
}

/* ---------- memorizations ---------- */

export function listMemorizations(): MemorizationWithProgress[] {
  const mems = db.select().from(memorizations).orderBy(desc(memorizations.updatedAt)).all();
  const progresses = new Map(
    db
      .select()
      .from(progress)
      .all()
      .map((p) => [p.memorizationId, p]),
  );
  return mems.map((m) => ({
    ...m,
    progress: progresses.get(m.id) ?? emptyProgressRow(m.id, m.updatedAt),
  }));
}

export function getMemorization(id: string): MemorizationWithProgress | null {
  const m = db.select().from(memorizations).where(eq(memorizations.id, id)).get();
  if (!m) return null;
  const p = db.select().from(progress).where(eq(progress.memorizationId, id)).get();
  return { ...m, progress: p ?? emptyProgressRow(id, m.updatedAt) };
}

export function createMemorization(input: MemorizationInput, now = Date.now()): string {
  const id = newId();
  db.transaction((tx) => {
    tx.insert(memorizations)
      .values({
        id,
        title: input.title,
        author: input.author,
        language: input.language,
        type: input.type,
        body: input.body,
        bodyHash: hashBody(input.body),
        chunks: parseBody(input.body, input.type),
        tags: input.tags,
        createdAt: now,
        updatedAt: now,
        folderId: input.folderId ?? null,
      })
      .run();
    tx.insert(progress).values(emptyProgressRow(id, now)).run();
  });
  return id;
}

/** Updates a memorization. When the body changes, hidden words are reset (SPEC §7). */
export function updateMemorization(id: string, input: MemorizationInput, now = Date.now()): void {
  db.transaction((tx) => {
    const current = tx.select().from(memorizations).where(eq(memorizations.id, id)).get();
    if (!current) return;
    const bodyHash = hashBody(input.body);
    tx.update(memorizations)
      .set({
        title: input.title,
        author: input.author,
        language: input.language,
        type: input.type,
        body: input.body,
        bodyHash,
        chunks: parseBody(input.body, input.type),
        tags: input.tags,
        updatedAt: now,
      })
      .where(eq(memorizations.id, id))
      .run();
    if (bodyHash !== current.bodyHash || input.type !== current.type) {
      tx.update(progress)
        .set({ hiddenWords: [], updatedAt: now })
        .where(eq(progress.memorizationId, id))
        .run();
    }
  });
}

/** Deletes the row (progress, sessions and recording rows cascade). Returns audio files the caller must delete. */
export function deleteMemorization(id: string): string[] {
  let uris: string[] = [];
  db.transaction((tx) => {
    uris = tx
      .select()
      .from(recordings)
      .where(eq(recordings.memorizationId, id))
      .all()
      .map((r) => r.fileUri);
    tx.delete(memorizations).where(eq(memorizations.id, id)).run();
  });
  return uris;
}

/* ---------- folders ---------- */

/** Folders in alphabetical order for the current language. */
export function listFolders(): FolderRow[] {
  return db
    .select()
    .from(folders)
    .orderBy(asc(folders.createdAt))
    .all()
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createFolder(name: string, now = Date.now()): string {
  const id = newId();
  db.insert(folders).values({ id, name, createdAt: now, updatedAt: now }).run();
  return id;
}

export function renameFolder(id: string, name: string, now = Date.now()): void {
  db.update(folders).set({ name, updatedAt: now }).where(eq(folders.id, id)).run();
}

/**
 * Deletes a folder. Its texts are kept and end up in no folder. They count as edited, so a
 * backup merge carries the change like any other edit.
 */
export function deleteFolder(id: string, now = Date.now()): void {
  db.transaction((tx) => {
    tx.update(memorizations)
      .set({ folderId: null, updatedAt: now })
      .where(eq(memorizations.folderId, id))
      .run();
    tx.delete(folders).where(eq(folders.id, id)).run();
  });
}

/**
 * Puts texts into a folder, or into no folder with `null`. Texts already there are left alone.
 * A move counts as an edit (`updatedAt`), so a backup merge carries it.
 */
export function moveToFolder(ids: string[], folderId: string | null, now = Date.now()): void {
  if (ids.length === 0) return;
  const elsewhere =
    folderId === null
      ? isNotNull(memorizations.folderId)
      : or(isNull(memorizations.folderId), ne(memorizations.folderId, folderId));
  db.update(memorizations)
    .set({ folderId, updatedAt: now })
    .where(and(inArray(memorizations.id, ids), elsewhere))
    .run();
}

/* ---------- progress ---------- */

export function saveProgressState(id: string, state: ProgressState, now = Date.now()): void {
  db.update(progress)
    .set({
      targetDueDate: state.targetDueDate,
      intervalIndex: state.intervalIndex,
      nextReviewAt: state.nextReviewAt,
      headlineScore: state.headlineScore,
      solidifyScores: state.solidifyScores,
      updatedAt: now,
    })
    .where(eq(progress.memorizationId, id))
    .run();
}

export function setHiddenWords(id: string, hidden: string[], now = Date.now()): void {
  db.update(progress)
    .set({ hiddenWords: hidden, updatedAt: now })
    .where(eq(progress.memorizationId, id))
    .run();
}

export function setVoiceOverrides(
  id: string,
  overrides: Record<string, string>,
  now = Date.now(),
): void {
  db.update(progress)
    .set({ voiceOverrides: overrides, updatedAt: now })
    .where(eq(progress.memorizationId, id))
    .run();
}

/* ---------- sessions ---------- */

export function insertSession(row: Omit<SessionRow, 'id'>): string {
  const id = newId();
  db.insert(sessions)
    .values({ id, ...row })
    .run();
  return id;
}

export function listSessions(memorizationId: string): SessionRow[] {
  return db
    .select()
    .from(sessions)
    .where(eq(sessions.memorizationId, memorizationId))
    .orderBy(desc(sessions.createdAt))
    .all();
}

/* ---------- recordings ---------- */

export function listRecordings(memorizationId: string): RecordingRow[] {
  return db
    .select()
    .from(recordings)
    .where(eq(recordings.memorizationId, memorizationId))
    .orderBy(desc(recordings.createdAt))
    .all();
}

export function insertRecording(row: Omit<RecordingRow, 'id'>): string {
  const id = newId();
  db.insert(recordings)
    .values({ id, ...row })
    .run();
  return id;
}

export function renameRecording(id: string, name: string): void {
  db.update(recordings).set({ name }).where(eq(recordings.id, id)).run();
}

export function deleteRecording(id: string): string | null {
  const row = db.select().from(recordings).where(eq(recordings.id, id)).get();
  if (!row) return null;
  db.delete(recordings).where(eq(recordings.id, id)).run();
  return row.fileUri;
}

/* ---------- settings ---------- */

export function loadSettingsRows(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of db.select().from(settings).all()) out[row.key] = row.value;
  return out;
}

export function saveSetting(key: string, value: unknown): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}
