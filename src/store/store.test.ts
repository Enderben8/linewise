/**
 * @jest-environment node
 */
import { getMemorization, listSessions, rowToState } from '../db/repo';
import { makeResult } from '../games/ids';
import { addMemorization, editMemorization, removeMemorization } from './memorizationsSlice';
import { completeSession } from './sessionThunks';
import { loadSettings, updateSettings } from './settingsSlice';
import { store } from './index';

jest.mock('../db/client', () => {
  const { createTestDb } = jest.requireActual('../db/testDb');
  return { db: createTestDb() };
});
jest.mock('../lib/uuid', () => ({ newId: () => jest.requireActual('crypto').randomUUID() }));
jest.mock('../features/recordings/files', () => ({ deleteAudioFiles: jest.fn() }));
jest.mock('../features/notifications/reminders', () => ({
  syncReminders: jest.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line import/first
import { syncReminders } from '../features/notifications/reminders';
// eslint-disable-next-line import/first
import { deleteAudioFiles } from '../features/recordings/files';

const DAY = 86_400_000;
const input = {
  title: 'Poem',
  author: '',
  language: 'en',
  type: 'text' as const,
  body: 'one two\n\nthree four',
  tags: [],
};
const full = (game: 'type-it' | 'first-letter' | 'tap-to-reveal', score: number) =>
  makeResult(game, score, 4, 4, [0, 1]);

describe('memorization thunks', () => {
  it('adds, edits and removes texts and keeps the list in sync', () => {
    const id = store.dispatch(addMemorization(input)) as unknown as string;
    expect(store.getState().memorizations.items.map((m) => m.title)).toEqual(['Poem']);

    store.dispatch(editMemorization(id, { ...input, title: 'Renamed' }));
    expect(store.getState().memorizations.items[0].title).toBe('Renamed');

    store.dispatch(removeMemorization(id));
    expect(store.getState().memorizations.items).toEqual([]);
    expect(deleteAudioFiles).toHaveBeenCalledWith([]);
  });
});

describe('completeSession', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves a passing scored session, advances the plan and reschedules reminders', async () => {
    const id = store.dispatch(addMemorization(input)) as unknown as string;
    const outcome = await store.dispatch(completeSession(id, full('type-it', 0.9)));
    expect(outcome).toMatchObject({ counted: true, advanced: true });

    const mem = getMemorization(id)!;
    const state = rowToState(mem.progress);
    expect(state.intervalIndex).toBe(1);
    expect(state.headlineScore).toBeCloseTo(0.9);
    expect(state.nextReviewAt).toBeGreaterThan(Date.now());
    expect(state.nextReviewAt! - Date.now()).toBeLessThan(2 * DAY);

    const sessions = listSessions(id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      game: 'type-it',
      countedForReview: true,
      chunkStart: 0,
      chunkEnd: 1,
    });
    expect(syncReminders).toHaveBeenCalledTimes(1);
    expect(store.getState().memorizations.items[0].progress.intervalIndex).toBe(1);
  });

  it('only the first scored session of a review day counts', async () => {
    const id = store.dispatch(addMemorization(input)) as unknown as string;
    await store.dispatch(completeSession(id, full('first-letter', 0.85)));
    const second = await store.dispatch(completeSession(id, full('type-it', 1)));
    expect(second).toMatchObject({ counted: false, advanced: false });
    expect(
      listSessions(id)
        .map((s) => s.countedForReview)
        .sort(),
    ).toEqual([false, true]);
    expect(rowToState(getMemorization(id)!.progress).intervalIndex).toBe(1);
    expect(rowToState(getMemorization(id)!.progress).headlineScore).toBe(1);
  });

  it('a failing counting session keeps the interval and retries tomorrow', async () => {
    const id = store.dispatch(addMemorization(input)) as unknown as string;
    const outcome = await store.dispatch(completeSession(id, full('type-it', 0.5)));
    expect(outcome).toMatchObject({ counted: true, advanced: false });
    const state = rowToState(getMemorization(id)!.progress);
    expect(state.intervalIndex).toBe(0);
    expect(state.nextReviewAt! - Date.now()).toBeLessThanOrEqual(DAY);
  });

  it('practice games are not saved and change nothing', async () => {
    const id = store.dispatch(addMemorization(input)) as unknown as string;
    expect(await store.dispatch(completeSession(id, full('tap-to-reveal', 1)))).toBeNull();
    expect(listSessions(id)).toEqual([]);
    expect(syncReminders).not.toHaveBeenCalled();
  });

  it('respects the reset-Solidify setting', async () => {
    const id = store.dispatch(addMemorization(input)) as unknown as string;
    store.dispatch(updateSettings({ reset_solidify_each_interval: true }));
    await store.dispatch(completeSession(id, full('first-letter', 0.85)));
    expect(rowToState(getMemorization(id)!.progress).solidifyScores).toEqual({});
  });

  it('ignores a text that no longer exists', async () => {
    expect(await store.dispatch(completeSession('missing', full('type-it', 1)))).toBeNull();
  });
});

describe('settings thunks', () => {
  it('persists changes and hydrates them back with defaults for the rest', () => {
    store.dispatch(updateSettings({ font_size: 1.5, default_voice: { fr: 'v' } }));
    store.dispatch(loadSettings());
    const s = store.getState().settings;
    expect(s.hydrated).toBe(true);
    expect(s.values).toMatchObject({
      font_size: 1.5,
      default_voice: { fr: 'v' },
      speech_rate: 1,
      onboarding_done: false,
    });
  });
});
