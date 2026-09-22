import { notInArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { memorizations, progress, recordings, sessions, settings } from '../../db/schema';
import type { BackupTables, MergePlan } from './backup';

/** Settings that describe this phone rather than the user's preferences; a restore never overwrites them. */
const DEVICE_SETTINGS = new Set(['default_voice', 'last_backup_at', 'update_dismissed_version']);

const CHUNK = 50;

function inChunks<T>(rows: T[], fn: (part: T[]) => void): void {
  for (let i = 0; i < rows.length; i += CHUNK) fn(rows.slice(i, i + CHUNK));
}

export function readAllTables(): BackupTables {
  return {
    settings: db.select().from(settings).all(),
    memorizations: db.select().from(memorizations).all(),
    progress: db.select().from(progress).all(),
    sessions: db.select().from(sessions).all(),
  };
}

function upsertMemorizations(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  rows: BackupTables['memorizations'],
) {
  for (const m of rows) {
    const { id: _id, ...rest } = m;
    tx.insert(memorizations)
      .values(m)
      .onConflictDoUpdate({ target: memorizations.id, set: rest })
      .run();
  }
}

function upsertProgress(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  rows: BackupTables['progress'],
) {
  for (const p of rows) {
    const { memorizationId: _id, ...rest } = p;
    tx.insert(progress)
      .values(p)
      .onConflictDoUpdate({ target: progress.memorizationId, set: rest })
      .run();
  }
}

/**
 * Makes this phone match the backup. Texts not in the backup are removed.
 * Returns audio files that belonged to removed texts, for the caller to delete.
 */
export function replaceAll(incoming: BackupTables): string[] {
  let orphanFiles: string[] = [];
  db.transaction((tx) => {
    const keepIds = incoming.memorizations.map((m) => m.id);
    const doomed = keepIds.length
      ? tx.select().from(memorizations).where(notInArray(memorizations.id, keepIds)).all()
      : tx.select().from(memorizations).all();
    const doomedIds = new Set(doomed.map((m) => m.id));
    orphanFiles = tx
      .select()
      .from(recordings)
      .all()
      .filter((r) => doomedIds.has(r.memorizationId))
      .map((r) => r.fileUri);
    if (doomed.length > 0) {
      if (keepIds.length)
        tx.delete(memorizations).where(notInArray(memorizations.id, keepIds)).run();
      else tx.delete(memorizations).run();
    }
    upsertMemorizations(tx, incoming.memorizations);
    upsertProgress(tx, incoming.progress);
    tx.delete(sessions).run();
    inChunks(incoming.sessions, (part) => tx.insert(sessions).values(part).run());
    for (const s of incoming.settings) {
      if (DEVICE_SETTINGS.has(s.key)) continue;
      tx.insert(settings)
        .values({ key: s.key, value: s.value })
        .onConflictDoUpdate({ target: settings.key, set: { value: s.value } })
        .run();
    }
  });
  return orphanFiles;
}

/** Applies a merge plan computed by `planMerge`. Nothing on the phone is deleted. */
export function applyMerge(plan: MergePlan): void {
  db.transaction((tx) => {
    upsertMemorizations(tx, plan.memorizations);
    upsertProgress(tx, plan.progress);
    inChunks(plan.sessions, (part) => tx.insert(sessions).values(part).onConflictDoNothing().run());
  });
}
