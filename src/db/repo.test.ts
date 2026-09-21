/**
 * @jest-environment node
 */
import { db } from './client';
import {
  createMemorization,
  deleteMemorization,
  deleteRecording,
  getMemorization,
  insertRecording,
  insertSession,
  listMemorizations,
  listRecordings,
  listSessions,
  loadSettingsRows,
  renameRecording,
  rowToState,
  saveProgressState,
  saveSetting,
  setHiddenWords,
  setVoiceOverrides,
  updateMemorization,
  type MemorizationInput,
} from './repo';
import { memorizations, progress, recordings, sessions, settings } from './schema';

jest.mock('./client', () => {
  const { createTestDb } = jest.requireActual('./testDb');
  return { db: createTestDb() };
});
jest.mock('../lib/uuid', () => ({ newId: () => jest.requireActual('crypto').randomUUID() }));

const input = (over: Partial<MemorizationInput> = {}): MemorizationInput => ({
  title: 'Sonnet',
  author: 'Will',
  language: 'en',
  type: 'text',
  body: 'Roses are red,\nViolets are blue.\n\nSugar is sweet.',
  tags: ['poetry'],
  ...over,
});

beforeEach(() => {
  db.delete(memorizations).run();
  db.delete(settings).run();
});

describe('memorizations', () => {
  it('creates a memorization with chunks, hash and an empty progress row', () => {
    const id = createMemorization(input(), 1000);
    const m = getMemorization(id)!;
    expect(m.title).toBe('Sonnet');
    expect(m.chunks).toHaveLength(2);
    expect(m.bodyHash).toHaveLength(16);
    expect(m.tags).toEqual(['poetry']);
    expect(m.createdAt).toBe(1000);
    expect(m.progress).toMatchObject({ intervalIndex: 0, nextReviewAt: null, headlineScore: 0 });
    expect(rowToState(m.progress).solidifyScores).toEqual({});
  });

  it('lists newest edits first', () => {
    const a = createMemorization(input({ title: 'A' }), 1);
    createMemorization(input({ title: 'B' }), 2);
    updateMemorization(a, input({ title: 'A2' }), 3);
    expect(listMemorizations().map((m) => m.title)).toEqual(['A2', 'B']);
  });

  it('resets hidden words only when the text changes', () => {
    const id = createMemorization(input(), 1);
    setHiddenWords(id, ['0:1', '0:2'], 2);
    updateMemorization(id, input({ title: 'New title', tags: ['x'] }), 3);
    expect(getMemorization(id)!.progress.hiddenWords).toEqual(['0:1', '0:2']);

    const before = getMemorization(id)!.bodyHash;
    updateMemorization(id, input({ body: 'Completely different words.' }), 4);
    const after = getMemorization(id)!;
    expect(after.bodyHash).not.toBe(before);
    expect(after.progress.hiddenWords).toEqual([]);
    expect(after.chunks).toHaveLength(1);
  });

  it('resets hidden words when switching between text and script', () => {
    const id = createMemorization(input(), 1);
    setHiddenWords(id, ['0:1'], 2);
    updateMemorization(id, input({ type: 'script' }), 3);
    expect(getMemorization(id)!.progress.hiddenWords).toEqual([]);
  });

  it('returns null for a missing id', () => {
    expect(getMemorization('nope')).toBeNull();
  });
});

describe('progress, sessions and recordings', () => {
  it('saves progress state and voice overrides', () => {
    const id = createMemorization(input());
    saveProgressState(id, {
      intervalIndex: 3,
      nextReviewAt: 5000,
      targetDueDate: 9000,
      headlineScore: 0.9,
      solidifyScores: { 'first-letter': 0.8 },
    });
    setVoiceOverrides(id, { ROMEO: 'v1', '': 'narrator' });
    const p = getMemorization(id)!.progress;
    expect(rowToState(p)).toEqual({
      intervalIndex: 3,
      nextReviewAt: 5000,
      targetDueDate: 9000,
      headlineScore: 0.9,
      solidifyScores: { 'first-letter': 0.8 },
    });
    expect(p.voiceOverrides).toEqual({ ROMEO: 'v1', '': 'narrator' });
  });

  it('stores sessions newest first', () => {
    const id = createMemorization(input());
    const base = {
      memorizationId: id,
      chunkStart: 0,
      chunkEnd: 1,
      accuracy: 1,
      coverage: 1,
      weightedScore: 1,
    };
    insertSession({ ...base, game: 'type-it', countedForReview: true, createdAt: 10 });
    insertSession({ ...base, game: 'speak', countedForReview: false, createdAt: 20 });
    const list = listSessions(id);
    expect(list.map((s) => s.game)).toEqual(['speak', 'type-it']);
    expect(list[1].countedForReview).toBe(true);
  });

  it('manages recordings', () => {
    const id = createMemorization(input());
    const rid = insertRecording({
      memorizationId: id,
      name: 'Take 1',
      fileUri: 'file:///a.m4a',
      durationSec: 12.5,
      bodyHash: 'h',
      createdAt: 1,
    });
    renameRecording(rid, 'Morning');
    expect(listRecordings(id).map((r) => r.name)).toEqual(['Morning']);
    expect(deleteRecording(rid)).toBe('file:///a.m4a');
    expect(deleteRecording(rid)).toBeNull();
    expect(listRecordings(id)).toEqual([]);
  });

  it('deleting a memorization removes everything and returns audio files to delete', () => {
    const id = createMemorization(input());
    const other = createMemorization(input({ title: 'Other' }));
    insertRecording({
      memorizationId: id,
      name: 'a',
      fileUri: 'file:///a.m4a',
      durationSec: 1,
      bodyHash: 'h',
      createdAt: 1,
    });
    insertRecording({
      memorizationId: id,
      name: 'b',
      fileUri: 'file:///b.m4a',
      durationSec: 1,
      bodyHash: 'h',
      createdAt: 2,
    });
    insertRecording({
      memorizationId: other,
      name: 'c',
      fileUri: 'file:///c.m4a',
      durationSec: 1,
      bodyHash: 'h',
      createdAt: 3,
    });
    insertSession({
      memorizationId: id,
      game: 'type-it',
      chunkStart: 0,
      chunkEnd: 0,
      accuracy: 1,
      coverage: 1,
      weightedScore: 1,
      countedForReview: false,
      createdAt: 1,
    });

    expect(deleteMemorization(id).sort()).toEqual(['file:///a.m4a', 'file:///b.m4a']);
    expect(getMemorization(id)).toBeNull();
    expect(
      db
        .select()
        .from(progress)
        .all()
        .map((p) => p.memorizationId),
    ).toEqual([other]);
    expect(db.select().from(sessions).all()).toEqual([]);
    expect(
      db
        .select()
        .from(recordings)
        .all()
        .map((r) => r.name),
    ).toEqual(['c']);
  });
});

describe('settings', () => {
  it('saves and updates values as JSON', () => {
    saveSetting('font_size', 1.3);
    saveSetting('default_voice', { en: 'v1' });
    saveSetting('font_size', 1.5);
    expect(loadSettingsRows()).toEqual({ font_size: 1.5, default_voice: { en: 'v1' } });
  });
});
