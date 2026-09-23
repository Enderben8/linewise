import { BACKUP } from '../../config';
import type { FolderRow, Memorization, ProgressRow, SessionRow } from '../../db/schema';

export interface SettingRow {
  key: string;
  value: unknown;
}

/** Every table except recordings (audio files stay on the phone). */
export interface BackupTables {
  settings: SettingRow[];
  folders: FolderRow[];
  memorizations: Memorization[];
  progress: ProgressRow[];
  sessions: SessionRow[];
}

export interface BackupFile {
  app: 'linewise';
  version: number;
  exportedAt: number;
  tables: BackupTables;
}

export function buildBackup(tables: BackupTables, now: number): BackupFile {
  return { app: 'linewise', version: BACKUP.version, exportedAt: now, tables };
}

export function backupFileName(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `linewise-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export type ParseResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; reason: 'invalid' | 'unknown-version'; version?: number };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function validFolder(f: unknown): boolean {
  return isObj(f) && isStr(f.id) && isStr(f.name) && isNum(f.createdAt) && isNum(f.updatedAt);
}

function validMemorization(m: unknown): boolean {
  return (
    isObj(m) &&
    (m.folderId === undefined || m.folderId === null || isStr(m.folderId)) &&
    isStr(m.id) &&
    isStr(m.title) &&
    isStr(m.body) &&
    isStr(m.bodyHash) &&
    (m.type === 'text' || m.type === 'script') &&
    Array.isArray(m.chunks) &&
    Array.isArray(m.tags) &&
    isNum(m.createdAt) &&
    isNum(m.updatedAt)
  );
}

function validProgress(p: unknown): boolean {
  return (
    isObj(p) &&
    isStr(p.memorizationId) &&
    isNum(p.intervalIndex) &&
    isNum(p.headlineScore) &&
    isObj(p.solidifyScores) &&
    Array.isArray(p.hiddenWords) &&
    isObj(p.voiceOverrides)
  );
}

function validSession(s: unknown): boolean {
  return (
    isObj(s) &&
    isStr(s.id) &&
    isStr(s.memorizationId) &&
    isStr(s.game) &&
    isNum(s.weightedScore) &&
    isNum(s.createdAt)
  );
}

/**
 * Reads a backup file. Rejects anything that is not a Linewise backup of a known version.
 * Version 1 files have no folders; their texts come back in no folder. A text whose folder is not
 * in the file also comes back in no folder, so the restore never points at a missing folder.
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!isObj(raw) || raw.app !== 'linewise' || !isObj(raw.tables)) {
    return { ok: false, reason: 'invalid' };
  }
  if (!(BACKUP.readableVersions as readonly unknown[]).includes(raw.version)) {
    return {
      ok: false,
      reason: 'unknown-version',
      version: isNum(raw.version) ? raw.version : undefined,
    };
  }
  const t = raw.tables;
  if (raw.version === 1) t.folders = [];
  if (
    !Array.isArray(t.folders) ||
    !t.folders.every(validFolder) ||
    !Array.isArray(t.settings) ||
    !Array.isArray(t.memorizations) ||
    !Array.isArray(t.progress) ||
    !Array.isArray(t.sessions) ||
    !t.settings.every((s) => isObj(s) && isStr(s.key)) ||
    !t.memorizations.every(validMemorization) ||
    !t.progress.every(validProgress) ||
    !t.sessions.every(validSession)
  ) {
    return { ok: false, reason: 'invalid' };
  }
  const tables = t as unknown as BackupTables;
  const folderIds = new Set(tables.folders.map((f) => f.id));
  tables.memorizations = tables.memorizations.map((m) => ({
    ...m,
    folderId: m.folderId && folderIds.has(m.folderId) ? m.folderId : null,
  }));
  return { ok: true, backup: { ...(raw as unknown as BackupFile), tables } };
}

export interface BackupSummary {
  memorizations: number;
  sessions: number;
  exportedAt: number;
  titles: string[];
}

export function summarize(backup: BackupFile): BackupSummary {
  return {
    memorizations: backup.tables.memorizations.length,
    sessions: backup.tables.sessions.length,
    exportedAt: backup.exportedAt,
    titles: backup.tables.memorizations.map((m) => m.title),
  };
}

export interface MergePlan {
  /** Incoming folders that are new, or renamed more recently than the copy on this phone. */
  folders: FolderRow[];
  /** Incoming memorizations that are new, or newer than the copy on this phone. */
  memorizations: Memorization[];
  /** Progress rows that go with the memorizations above. */
  progress: ProgressRow[];
  /** Sessions not yet on this phone, for memorizations that exist after the merge. */
  sessions: SessionRow[];
  added: number;
  updated: number;
  kept: number;
}

/**
 * Merge rule from SPEC §9: same id, newer `updatedAt` wins. Nothing already on the phone is deleted.
 * Folders follow the same rule. Every incoming folder that is not on the phone is added, so the
 * incoming texts that use it have it.
 */
export function planMerge(existing: BackupTables, incoming: BackupTables): MergePlan {
  const haveFolders = new Map(existing.folders.map((f) => [f.id, f]));
  const folders = incoming.folders.filter((f) => {
    const current = haveFolders.get(f.id);
    return !current || f.updatedAt > current.updatedAt;
  });
  const have = new Map(existing.memorizations.map((m) => [m.id, m]));
  const taken: Memorization[] = [];
  let added = 0;
  let updated = 0;
  let kept = 0;
  for (const m of incoming.memorizations) {
    const current = have.get(m.id);
    if (!current) {
      taken.push(m);
      added++;
    } else if (m.updatedAt > current.updatedAt) {
      taken.push(m);
      updated++;
    } else {
      kept++;
    }
  }
  const takenIds = new Set(taken.map((m) => m.id));
  const knownIds = new Set([...have.keys(), ...takenIds]);
  const haveSessions = new Set(existing.sessions.map((s) => s.id));
  return {
    folders,
    memorizations: taken,
    progress: incoming.progress.filter((p) => takenIds.has(p.memorizationId)),
    sessions: incoming.sessions.filter(
      (s) => !haveSessions.has(s.id) && knownIds.has(s.memorizationId),
    ),
    added,
    updated,
    kept,
  };
}
