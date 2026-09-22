import { makeResult, type GameId } from '../games/ids';
import {
  addDays,
  applySession,
  daysBetween,
  innerRing,
  isReviewDay,
  monthStats,
  newProgress,
  nextGapDays,
  outerRing,
  previewSchedule,
  reminderDate,
  scaleIntervals,
  startOfDay,
  withTargetDate,
  type ProgressState,
} from './index';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const result = (game: GameId, score: number) => makeResult(game, score, 100, 100, [0, 0]);

describe('scaleIntervals', () => {
  it('keeps the gaps when they already fit', () => {
    expect(scaleIntervals([1, 2, 4, 7, 14, 30, 60], 118)).toEqual([1, 2, 4, 7, 14, 30, 60]);
  });

  it('squeezes gaps so they add up to the available days', () => {
    const out = scaleIntervals([1, 2, 4, 7, 14, 30, 60], 30);
    expect(out.reduce((a, b) => a + b, 0)).toBe(30);
    expect(out.every((g) => g >= 1)).toBe(true);
    expect([...out].sort((a, b) => a - b)).toEqual(out);
  });

  it('stretches gaps for a distant target', () => {
    const out = scaleIntervals([1, 2, 4], 70);
    expect(out.reduce((a, b) => a + b, 0)).toBe(70);
  });

  it('never goes below one day, even when the target is too close', () => {
    expect(scaleIntervals([1, 2, 4, 7], 2)).toEqual([1, 1, 1, 1]);
    expect(scaleIntervals([1, 2, 4, 7], 0)).toEqual([1, 1, 1, 1]);
    expect(scaleIntervals([1, 2, 4, 7], 4)).toEqual([1, 1, 1, 1]);
  });

  it('handles an empty plan', () => {
    expect(scaleIntervals([], 10)).toEqual([]);
  });
});

describe('dates', () => {
  it('counts calendar days regardless of time of day', () => {
    expect(daysBetween(at(2026, 3, 1, 23), at(2026, 3, 2, 1))).toBe(1);
    expect(daysBetween(at(2026, 3, 1, 1), at(2026, 3, 1, 23))).toBe(0);
  });

  it('adds calendar days across a month end', () => {
    expect(addDays(at(2026, 1, 31), 1)).toBe(startOfDay(at(2026, 2, 1)));
  });
});

describe('applySession', () => {
  const now = at(2026, 5, 10);

  it('ignores practice games entirely', () => {
    const start = newProgress();
    const out = applySession(start, result('tap-to-reveal', 1), now);
    expect(out.counted).toBe(false);
    expect(out.state).toEqual(start);
  });

  it('counts the first scored session of a new text and advances on a pass', () => {
    const out = applySession(newProgress(), result('type-it', 0.9), now);
    expect(out.counted).toBe(true);
    expect(out.advanced).toBe(true);
    expect(out.state.intervalIndex).toBe(1);
    expect(out.state.nextReviewAt).toBe(addDays(now, 1));
    expect(out.state.headlineScore).toBeCloseTo(0.9);
  });

  it('keeps the interval and retries tomorrow on a fail', () => {
    const out = applySession(newProgress(), result('type-it', 0.79), now);
    expect(out.counted).toBe(true);
    expect(out.advanced).toBe(false);
    expect(out.state.intervalIndex).toBe(0);
    expect(out.state.nextReviewAt).toBe(addDays(now, 1));
  });

  it('passes at exactly the pass mark', () => {
    expect(applySession(newProgress(), result('speak', 0.8), now).advanced).toBe(true);
  });

  it('only the first scored session on a review day counts', () => {
    const first = applySession(newProgress(), result('first-letter', 0.9), now);
    const second = applySession(first.state, result('type-it', 1), now);
    expect(second.counted).toBe(false);
    expect(second.state.intervalIndex).toBe(1);
    expect(second.state.headlineScore).toBe(1);
  });

  it('does not count sessions before the review day', () => {
    const state: ProgressState = {
      ...newProgress(),
      intervalIndex: 2,
      nextReviewAt: addDays(now, 3),
    };
    const out = applySession(state, result('type-it', 1), now);
    expect(out.counted).toBe(false);
    expect(out.state.intervalIndex).toBe(2);
    expect(out.state.nextReviewAt).toBe(state.nextReviewAt);
  });

  it('counts on the due day and moves to the next gap', () => {
    const state: ProgressState = {
      ...newProgress(),
      intervalIndex: 2,
      nextReviewAt: startOfDay(now),
    };
    expect(isReviewDay(state, now)).toBe(true);
    const out = applySession(state, result('multiple-choice', 0.85), now);
    expect(out.state.intervalIndex).toBe(3);
    expect(out.state.nextReviewAt).toBe(addDays(now, 4));
  });

  it('keeps using the last interval after the plan is complete', () => {
    const state: ProgressState = {
      ...newProgress(),
      intervalIndex: 7,
      nextReviewAt: startOfDay(now),
    };
    const out = applySession(state, result('type-it', 1), now);
    expect(out.state.intervalIndex).toBe(7);
    expect(out.state.nextReviewAt).toBe(addDays(now, 60));
  });

  it('stores Solidify scores separately from the headline score', () => {
    const out = applySession(newProgress(), result('first-letter', 0.7), now);
    expect(out.state.solidifyScores['first-letter']).toBeCloseTo(0.7);
    expect(out.state.headlineScore).toBe(0);
  });

  it('can reset Solidify scores at each new interval', () => {
    const start: ProgressState = { ...newProgress(), solidifyScores: { 'first-letter': 1 } };
    const kept = applySession(start, result('type-it', 1), now);
    expect(kept.state.solidifyScores['first-letter']).toBe(1);
    const reset = applySession(start, result('type-it', 1), now, {
      resetSolidifyEachInterval: true,
    });
    expect(reset.state.solidifyScores).toEqual({});
  });

  it('weights accuracy by coverage', () => {
    const half = makeResult('type-it', 1, 50, 100, [0, 0]);
    expect(half.weightedScore).toBe(0.5);
    expect(applySession(newProgress(), half, now).advanced).toBe(false);
  });
});

describe('target date', () => {
  const now = at(2026, 5, 10);

  it('scales the next gap so the last review lands on the target', () => {
    const target = addDays(now, 30);
    const state: ProgressState = { ...newProgress(), targetDueDate: target };
    const plan = previewSchedule(state, now);
    expect(plan[0].date).toBe(startOfDay(now));
    expect(plan[plan.length - 1].date).toBe(target);
    expect(plan).toHaveLength(8);
    expect(plan.slice(1).every((s) => s.gapDays >= 1)).toBe(true);
  });

  it('uses the scaled gap when a session passes', () => {
    const state: ProgressState = { ...newProgress(), targetDueDate: addDays(now, 30) };
    const gap = nextGapDays(state, now)!;
    const out = applySession(state, result('type-it', 1), now);
    expect(out.state.nextReviewAt).toBe(addDays(now, gap));
    expect(gap).toBeLessThan(30);
  });

  it('finishes the plan after the last review', () => {
    const state: ProgressState = {
      ...newProgress(),
      intervalIndex: 7,
      nextReviewAt: startOfDay(now),
      targetDueDate: startOfDay(now),
    };
    const out = applySession(state, result('type-it', 1), now);
    expect(out.state.nextReviewAt).toBeNull();
    expect(isReviewDay(out.state, now)).toBe(false);
  });

  it('falls back to one-day gaps when the target has passed', () => {
    const state: ProgressState = { ...newProgress(), targetDueDate: addDays(now, -5) };
    expect(nextGapDays(state, now)).toBe(1);
  });

  it('without a target uses the default intervals', () => {
    const plan = previewSchedule(newProgress(), now);
    expect(plan.map((s) => s.gapDays)).toEqual([0, 1, 2, 4, 7, 14, 30, 60]);
  });
});

describe('withTargetDate', () => {
  const now = at(2026, 5, 10);
  const target = addDays(now, 10);

  it('brings forward a next review that falls after the target', () => {
    const state: ProgressState = {
      ...newProgress(),
      intervalIndex: 5,
      nextReviewAt: addDays(now, 30),
    };
    const out = withTargetDate(state, target, now);
    expect(out.targetDueDate).toBe(target);
    expect(out.nextReviewAt!).toBeLessThan(target);
    const plan = previewSchedule(out, now);
    expect(plan[plan.length - 1].date).toBe(target);
  });

  it('keeps a next review that is already early enough', () => {
    const state: ProgressState = {
      ...newProgress(),
      intervalIndex: 1,
      nextReviewAt: addDays(now, 1),
    };
    expect(withTargetDate(state, addDays(now, 60), now)).toEqual({
      ...state,
      targetDueDate: addDays(now, 60),
    });
  });

  it('starts a new plan when the old one has no intervals left', () => {
    const finished: ProgressState = {
      ...newProgress(),
      intervalIndex: 7,
      nextReviewAt: null,
      targetDueDate: addDays(now, -3),
      headlineScore: 0.9,
    };
    const out = withTargetDate(finished, target, now);
    expect(out).toMatchObject({
      intervalIndex: 0,
      nextReviewAt: startOfDay(now),
      headlineScore: 0.9,
    });
    expect(isReviewDay(out, now)).toBe(true);
    const plan = previewSchedule(out, now);
    expect(plan).toHaveLength(8);
    expect(plan[plan.length - 1].date).toBe(target);

    const pastTheEnd: ProgressState = {
      ...finished,
      nextReviewAt: addDays(now, 50),
      targetDueDate: null,
    };
    expect(withTargetDate(pastTheEnd, target, now).intervalIndex).toBe(0);
  });

  it('keeps reviewing at the regular intervals when a finished target is removed', () => {
    const finished: ProgressState = {
      ...newProgress(),
      intervalIndex: 7,
      nextReviewAt: null,
      targetDueDate: addDays(now, -3),
    };
    const out = withTargetDate(finished, null, now);
    expect(out).toMatchObject({ targetDueDate: null, nextReviewAt: startOfDay(now) });
    const passed = applySession(out, result('type-it', 1), now);
    expect(passed.state.nextReviewAt).toBe(addDays(now, 60));

    const ongoing: ProgressState = {
      ...newProgress(),
      intervalIndex: 2,
      nextReviewAt: target,
      targetDueDate: target,
    };
    expect(withTargetDate(ongoing, null, now)).toEqual({ ...ongoing, targetDueDate: null });
  });
});

describe('rings, reminders, stats', () => {
  it('computes ring fractions', () => {
    const state: ProgressState = { ...newProgress(), intervalIndex: 3, headlineScore: 0.9 };
    expect(outerRing(state)).toBeCloseTo(0.9);
    expect(innerRing(state)).toBeCloseTo(3 / 7);
    expect(innerRing({ ...state, intervalIndex: 7 })).toBe(1);
  });

  it('reminds at the reminder hour of the due day', () => {
    const now = at(2026, 5, 10, 8);
    const d = reminderDate(startOfDay(at(2026, 5, 12)), now)!;
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(9);
  });

  it('nags at the next reminder hour when overdue, and never in the past', () => {
    const now = at(2026, 5, 10, 15);
    const d = reminderDate(startOfDay(at(2026, 5, 8)), now)!;
    expect(d.getTime()).toBeGreaterThan(now);
    expect(d.getDate()).toBe(11);
    expect(reminderDate(null, now)).toBeNull();
  });

  it('groups scored sessions by day', () => {
    const days = monthStats(
      [
        { game: 'type-it', weightedScore: 0.9, createdAt: at(2026, 5, 3, 10) },
        { game: 'speak', weightedScore: 0.7, createdAt: at(2026, 5, 3, 9) },
        { game: 'listen', weightedScore: 1, createdAt: at(2026, 5, 3, 11) },
        { game: 'type-it', weightedScore: 0.5, createdAt: at(2026, 6, 1) },
      ],
      2026,
      4,
    );
    expect(days).toHaveLength(31);
    expect(days[2].count).toBe(2);
    expect(days[2].sessions.map((s) => s.game)).toEqual(['speak', 'type-it']);
    expect(days[0].count).toBe(0);
  });
});
