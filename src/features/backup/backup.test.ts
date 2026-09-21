import { BACKUP } from '../../config';
import type { Memorization, ProgressRow, SessionRow } from '../../db/schema';
import {
  backupFileName,
  buildBackup,
  parseBackup,
  planMerge,
  summarize,
  type BackupTables,
} from './backup';

const mem = (id: string, updatedAt: number, title = id): Memorization => ({
  id,
  title,
  author: '',
  language: 'en',
  type: 'text',
  body: 'a b c',
  bodyHash: 'h',
  chunks: [{ index: 0, lines: [{ kind: 'text', text: 'a b c' }] }],
  tags: [],
  createdAt: 1,
  updatedAt,
});
const prog = (id: string, intervalIndex = 0): ProgressRow => ({
  memorizationId: id,
  targetDueDate: null,
  intervalIndex,
  nextReviewAt: null,
  headlineScore: 0,
  solidifyScores: {},
  hiddenWords: [],
  voiceOverrides: {},
  updatedAt: 1,
});
const sess = (id: string, memorizationId: string): SessionRow => ({
  id,
  memorizationId,
  game: 'type-it',
  chunkStart: 0,
  chunkEnd: 0,
  accuracy: 1,
  coverage: 1,
  weightedScore: 1,
  countedForReview: true,
  createdAt: 5,
});
const tables = (over: Partial<BackupTables> = {}): BackupTables => ({
  settings: [{ key: 'font_size', value: 1.2 }],
  memorizations: [mem('a', 10), mem('b', 10)],
  progress: [prog('a'), prog('b')],
  sessions: [sess('s1', 'a')],
  ...over,
});

describe('backup file', () => {
  it('round-trips through JSON', () => {
    const file = buildBackup(tables(), 1234);
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.backup.version).toBe(BACKUP.version);
      expect(summarize(parsed.backup)).toEqual({
        memorizations: 2,
        sessions: 1,
        exportedAt: 1234,
        titles: ['a', 'b'],
      });
    }
  });

  it('excludes recordings by construction', () => {
    expect(Object.keys(buildBackup(tables(), 1).tables).sort()).toEqual([
      'memorizations',
      'progress',
      'sessions',
      'settings',
    ]);
  });

  it('rejects unknown versions, other files and broken data', () => {
    const file = buildBackup(tables(), 1);
    expect(parseBackup(JSON.stringify({ ...file, version: 99 }))).toEqual({
      ok: false,
      reason: 'unknown-version',
      version: 99,
    });
    expect(parseBackup('not json')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseBackup(JSON.stringify({ hello: 1 }))).toEqual({ ok: false, reason: 'invalid' });
    expect(parseBackup(JSON.stringify({ ...file, app: 'other' }))).toEqual({
      ok: false,
      reason: 'invalid',
    });
    const broken = { ...file, tables: { ...file.tables, memorizations: [{ id: 1 }] } };
    expect(parseBackup(JSON.stringify(broken))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('names the file by date', () => {
    expect(backupFileName(new Date(2026, 8, 3, 12).getTime())).toBe(
      'linewise-backup-2026-09-03.json',
    );
  });
});

describe('planMerge', () => {
  it('adds new texts, updates older ones and keeps newer ones', () => {
    const existing = tables({
      memorizations: [mem('a', 10), mem('b', 50)],
      progress: [prog('a'), prog('b', 3)],
      sessions: [sess('s1', 'a')],
    });
    const incoming = tables({
      memorizations: [mem('a', 20, 'A new'), mem('b', 40, 'B old'), mem('c', 5)],
      progress: [prog('a', 2), prog('b', 1), prog('c', 1)],
      sessions: [
        sess('s1', 'a'),
        sess('s2', 'a'),
        sess('s3', 'b'),
        sess('s4', 'c'),
        sess('s5', 'zzz'),
      ],
    });
    const plan = planMerge(existing, incoming);
    expect(plan).toMatchObject({ added: 1, updated: 1, kept: 1 });
    expect(plan.memorizations.map((m) => m.id).sort()).toEqual(['a', 'c']);
    expect(plan.progress.map((p) => [p.memorizationId, p.intervalIndex]).sort()).toEqual([
      ['a', 2],
      ['c', 1],
    ]);
    // s1 already exists; s5 belongs to a text that is nowhere.
    expect(plan.sessions.map((s) => s.id).sort()).toEqual(['s2', 's3', 's4']);
  });

  it('is a no-op when nothing is newer', () => {
    const t = tables();
    const plan = planMerge(t, t);
    expect(plan).toMatchObject({ added: 0, updated: 0, kept: 2 });
    expect(plan.memorizations).toEqual([]);
    expect(plan.sessions).toEqual([]);
  });
});
