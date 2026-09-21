/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  createMemorization,
  getMemorization,
  insertRecording,
  insertSession,
  listMemorizations,
  listSessions,
  saveProgressState,
  saveSetting,
  loadSettingsRows,
} from '../../db/repo';
import { memorizations, settings } from '../../db/schema';
import { newProgress } from '../../scheduler';
import { applyMerge, readAllTables, replaceAll } from './apply';
import { buildBackup, parseBackup, planMerge } from './backup';

jest.mock('../../db/client', () => {
  const { createTestDb } = jest.requireActual('../../db/testDb');
  return { db: createTestDb() };
});
jest.mock('../../lib/uuid', () => ({ newId: () => jest.requireActual('crypto').randomUUID() }));

const text = (title: string) => ({
  title,
  author: '',
  language: 'en',
  type: 'text' as const,
  body: `${title} body words here`,
  tags: [],
});
const session = (memorizationId: string, createdAt: number) => ({
  memorizationId,
  game: 'type-it' as const,
  chunkStart: 0,
  chunkEnd: 0,
  accuracy: 1,
  coverage: 1,
  weightedScore: 1,
  countedForReview: true,
  createdAt,
});

beforeEach(() => {
  db.delete(memorizations).run();
  db.delete(settings).run();
});

/** A backup taken from the phone's current state, as it would come back from a file. */
function roundTrip() {
  const parsed = parseBackup(JSON.stringify(buildBackup(readAllTables(), 123)));
  if (!parsed.ok) throw new Error('backup did not parse');
  return parsed.backup;
}

describe('replaceAll', () => {
  it('restores a backup onto an empty phone with progress and sessions intact', () => {
    const id = createMemorization(text('Alpha'), 100);
    saveProgressState(id, {
      ...newProgress(),
      intervalIndex: 4,
      nextReviewAt: 5000,
      headlineScore: 0.92,
    });
    insertSession(session(id, 10));
    saveSetting('font_size', 1.3);
    const backup = roundTrip();

    db.delete(memorizations).run();
    db.delete(settings).run();
    expect(listMemorizations()).toEqual([]);

    expect(replaceAll(backup.tables)).toEqual([]);
    const restored = getMemorization(id)!;
    expect(restored.title).toBe('Alpha');
    expect(restored.progress).toMatchObject({
      intervalIndex: 4,
      nextReviewAt: 5000,
      headlineScore: 0.92,
    });
    expect(listSessions(id)).toHaveLength(1);
    expect(loadSettingsRows()).toMatchObject({ font_size: 1.3 });
  });

  it('removes texts that are not in the backup and reports their audio files', () => {
    const keep = createMemorization(text('Keep'), 1);
    const backup = roundTrip();
    const gone = createMemorization(text('Gone'), 2);
    insertRecording({
      memorizationId: gone,
      name: 'x',
      fileUri: 'file:///gone.m4a',
      durationSec: 1,
      bodyHash: 'h',
      createdAt: 1,
    });

    expect(replaceAll(backup.tables)).toEqual(['file:///gone.m4a']);
    expect(listMemorizations().map((m) => m.id)).toEqual([keep]);
  });

  it('replaces sessions and keeps recordings of texts that stay', () => {
    const id = createMemorization(text('Stay'), 1);
    insertSession(session(id, 1));
    const backup = roundTrip();
    insertSession(session(id, 2));
    insertRecording({
      memorizationId: id,
      name: 'x',
      fileUri: 'file:///stay.m4a',
      durationSec: 1,
      bodyHash: 'h',
      createdAt: 1,
    });

    replaceAll(backup.tables);
    expect(listSessions(id)).toHaveLength(1);
    expect(getMemorization(id)).not.toBeNull();
  });

  it('never overwrites device-specific settings', () => {
    saveSetting('default_voice', { en: 'this-phone' });
    saveSetting('last_backup_at', 42);
    saveSetting('font_size', 1);
    const backup = roundTrip();
    backup.tables.settings = [
      { key: 'default_voice', value: { en: 'other-phone' } },
      { key: 'last_backup_at', value: 1 },
      { key: 'font_size', value: 1.5 },
    ];
    replaceAll(backup.tables);
    expect(loadSettingsRows()).toEqual({
      default_voice: { en: 'this-phone' },
      last_backup_at: 42,
      font_size: 1.5,
    });
  });

  it('can restore an empty backup, clearing all texts', () => {
    createMemorization(text('A'), 1);
    const empty = { ...roundTrip().tables, memorizations: [], progress: [], sessions: [] };
    replaceAll(empty);
    expect(listMemorizations()).toEqual([]);
  });
});

describe('applyMerge', () => {
  it('adds new texts, lets the newer edit win and never deletes', () => {
    const a = createMemorization(text('A'), 100);
    const b = createMemorization(text('B'), 100);
    const backup = roundTrip();

    // On this phone: A is edited later, B is untouched, and a text C exists only here.
    db.update(memorizations)
      .set({ title: 'A edited on phone', updatedAt: 500 })
      .where(eq(memorizations.id, a))
      .run();
    const c = createMemorization(text('C only here'), 300);
    // In the backup: B was edited later than the phone's copy, and D is new.
    backup.tables.memorizations = backup.tables.memorizations.map((m) =>
      m.id === b ? { ...m, title: 'B edited in backup', updatedAt: 900 } : m,
    );
    backup.tables.memorizations.push({
      ...backup.tables.memorizations[0],
      id: 'd-new',
      title: 'D',
      updatedAt: 50,
    });
    backup.tables.progress.push({ ...backup.tables.progress[0], memorizationId: 'd-new' });

    const plan = planMerge(readAllTables(), backup.tables);
    applyMerge(plan);

    const titles = Object.fromEntries(listMemorizations().map((m) => [m.id, m.title]));
    expect(titles[a]).toBe('A edited on phone'); // phone copy was newer
    expect(titles[b]).toBe('B edited in backup'); // backup copy was newer
    expect(titles[c]).toBe('C only here'); // untouched
    expect(titles['d-new']).toBe('D'); // added
    expect(getMemorization('d-new')!.progress.intervalIndex).toBe(0);
  });

  it('is safe to apply twice', () => {
    const id = createMemorization(text('A'), 1);
    insertSession(session(id, 1));
    const backup = roundTrip();
    applyMerge(planMerge(readAllTables(), backup.tables));
    applyMerge(planMerge(readAllTables(), backup.tables));
    expect(listMemorizations()).toHaveLength(1);
    expect(listSessions(id)).toHaveLength(1);
  });
});
