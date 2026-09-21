import {
  getMemorization,
  insertSession,
  rowToState,
  saveProgressState,
  listMemorizations,
} from '../db/repo';
import type { SessionResult } from '../games/ids';
import { isScored } from '../games/ids';
import { syncReminders } from '../features/notifications/reminders';
import { applySession, type ApplyOutcome } from '../scheduler';
import type { AppDispatch, RootState } from './index';
import { memorizationsActions } from './memorizationsSlice';

/**
 * Saves a finished scored session, updates review progress and reminders.
 * Practice games are not saved. Returns what the scheduler decided.
 */
export const completeSession =
  (memorizationId: string, result: SessionResult) =>
  async (dispatch: AppDispatch, getState: () => RootState): Promise<ApplyOutcome | null> => {
    if (!isScored(result.game)) return null;
    const mem = getMemorization(memorizationId);
    if (!mem) return null;
    const settings = getState().settings.values;
    const now = Date.now();
    const outcome = applySession(rowToState(mem.progress), result, now, {
      resetSolidifyEachInterval: settings.reset_solidify_each_interval,
    });
    saveProgressState(memorizationId, outcome.state, now);
    insertSession({
      memorizationId,
      game: result.game,
      chunkStart: result.chunkRange[0],
      chunkEnd: result.chunkRange[1],
      accuracy: result.accuracy,
      coverage: result.coverage,
      weightedScore: result.weightedScore,
      countedForReview: outcome.counted,
      createdAt: now,
    });
    const items = listMemorizations();
    dispatch(memorizationsActions.setItems(items));
    if (outcome.counted) {
      syncReminders(items, settings).catch(() => {
        // Reminders are best effort; a failure must not lose the saved session.
      });
    }
    return outcome;
  };
