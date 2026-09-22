import { SCHEDULER_CONFIG } from '../config';
import { GAME_GROUP, type GameId, type SessionResult } from '../games/ids';

export type SchedulerConfig = {
  intervalsDays: readonly number[];
  passMark: number;
  retryDays: number;
  minIntervalDays: number;
  reminderHour: number;
};

export interface ProgressState {
  /** Number of passed reviews (0..intervals.length). */
  intervalIndex: number;
  /** Start of the day the next review is due, in ms. Null for a text that has not been reviewed yet, or a finished target plan. */
  nextReviewAt: number | null;
  /** Optional target date (start of day, ms). */
  targetDueDate: number | null;
  /** Best Evaluate weightedScore in the current cycle. */
  headlineScore: number;
  /** Best Solidify weightedScore per game in the current cycle. */
  solidifyScores: Partial<Record<GameId, number>>;
}

export const DAY_MS = 86_400_000;

export function newProgress(): ProgressState {
  return {
    intervalIndex: 0,
    nextReviewAt: null,
    targetDueDate: null,
    headlineScore: 0,
    solidifyScores: {},
  };
}

/** Local midnight of the day containing `ms`. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local midnight `days` calendar days after the day containing `ms` (DST safe). */
export function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Whole calendar days from `from` to `to` (local days; negative if `to` is earlier). */
export function daysBetween(from: number, to: number): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

/**
 * Squeezes or stretches gaps so they add up to `availableDays`, each at least `minDays`.
 * When the days cannot fit (fewer than one per gap) every gap is the minimum.
 */
export function scaleIntervals(
  gaps: readonly number[],
  availableDays: number,
  minDays: number = SCHEDULER_CONFIG.minIntervalDays,
): number[] {
  const n = gaps.length;
  if (n === 0) return [];
  if (availableDays < n * minDays) return gaps.map(() => minDays);
  const total = gaps.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let cum = 0;
  let prev = 0;
  for (let k = 0; k < n; k++) {
    cum += gaps[k];
    let pos = Math.round((cum / total) * availableDays);
    pos = Math.max(pos, prev + minDays);
    pos = Math.min(pos, availableDays - (n - 1 - k) * minDays);
    out.push(pos - prev);
    prev = pos;
  }
  return out;
}

/** Days until the next review after passing the review at `state.intervalIndex`. Null when the plan is finished. */
export function nextGapDays(
  state: ProgressState,
  now: number,
  config: SchedulerConfig = SCHEDULER_CONFIG,
): number | null {
  const len = config.intervalsDays.length;
  if (state.targetDueDate === null) {
    return config.intervalsDays[Math.min(state.intervalIndex, len - 1)];
  }
  if (state.intervalIndex >= len) return null;
  const remaining = config.intervalsDays.slice(state.intervalIndex);
  const available = daysBetween(now, state.targetDueDate);
  return scaleIntervals(remaining, available, config.minIntervalDays)[0];
}

export interface ScheduleStep {
  index: number;
  date: number;
  gapDays: number;
}

/**
 * Preview of the reviews still to come. The first entry is the next review
 * (`nextReviewAt`, or today for a new text); each later entry is one scaled gap after the last.
 */
export function previewSchedule(
  state: ProgressState,
  now: number,
  config: SchedulerConfig = SCHEDULER_CONFIG,
): ScheduleStep[] {
  const len = config.intervalsDays.length;
  const first = startOfDay(state.nextReviewAt ?? now);
  const steps: ScheduleStep[] = [];
  const remaining = config.intervalsDays.slice(Math.min(state.intervalIndex, len));
  const gaps =
    state.targetDueDate === null
      ? [...remaining]
      : scaleIntervals(remaining, daysBetween(first, state.targetDueDate), config.minIntervalDays);
  let date = first;
  let index = state.intervalIndex;
  steps.push({ index, date, gapDays: 0 });
  for (const gap of gaps) {
    date = addDays(date, gap);
    index += 1;
    steps.push({ index, date, gapDays: gap });
  }
  return steps;
}

/**
 * Sets (or removes) the target date, and keeps the plan able to reach it:
 * - A plan with no intervals left (a finished target plan, or one past its last interval) starts
 *   over with a review today, so there are reviews leading up to the new date.
 * - A next review later than the scaled plan allows is brought forward.
 * - Removing the target from a finished target plan makes the text due today, so reviews go on at
 *   the regular intervals instead of stopping for good.
 */
export function withTargetDate(
  state: ProgressState,
  targetDueDate: number | null,
  now: number,
  config: SchedulerConfig = SCHEDULER_CONFIG,
): ProgressState {
  const today = startOfDay(now);
  const next: ProgressState = { ...state, targetDueDate };
  if (targetDueDate === null) {
    if (state.nextReviewAt === null && state.intervalIndex > 0) next.nextReviewAt = today;
    return next;
  }
  if (state.intervalIndex >= config.intervalsDays.length) {
    return { ...next, intervalIndex: 0, nextReviewAt: today };
  }
  if (state.nextReviewAt !== null && state.nextReviewAt > today) {
    // The plan as it would run from today: the gap to the next review, then the gaps after it.
    const gaps = config.intervalsDays.slice(Math.max(0, state.intervalIndex - 1));
    const available = daysBetween(today, targetDueDate);
    const first = scaleIntervals(gaps, available, config.minIntervalDays)[0];
    next.nextReviewAt = Math.min(state.nextReviewAt, addDays(today, first));
  }
  return next;
}

export function isReviewDay(state: ProgressState, now: number): boolean {
  if (state.nextReviewAt === null) return state.intervalIndex === 0;
  return now >= state.nextReviewAt;
}

export interface ApplyOptions {
  resetSolidifyEachInterval?: boolean;
  config?: SchedulerConfig;
}

export interface ApplyOutcome {
  state: ProgressState;
  /** True when this session was the counting session of a review day. */
  counted: boolean;
  /** True when a counting session passed and the interval advanced. */
  advanced: boolean;
}

/**
 * Applies a finished session to a memorization's progress.
 * Only the first Solidify or Evaluate session of a review day counts.
 */
export function applySession(
  state: ProgressState,
  result: SessionResult,
  now: number,
  options: ApplyOptions = {},
): ApplyOutcome {
  const config = options.config ?? SCHEDULER_CONFIG;
  const group = GAME_GROUP[result.game];
  const next: ProgressState = { ...state, solidifyScores: { ...state.solidifyScores } };

  if (group === 'practice') return { state: next, counted: false, advanced: false };

  if (group === 'solidify') {
    next.solidifyScores[result.game] = Math.max(
      next.solidifyScores[result.game] ?? 0,
      result.weightedScore,
    );
  } else {
    next.headlineScore = Math.max(next.headlineScore, result.weightedScore);
  }

  if (!isReviewDay(state, now)) return { state: next, counted: false, advanced: false };

  if (result.weightedScore < config.passMark) {
    next.nextReviewAt = addDays(now, config.retryDays);
    return { state: next, counted: true, advanced: false };
  }

  const gap = nextGapDays(state, now, config);
  next.intervalIndex = Math.min(state.intervalIndex + 1, config.intervalsDays.length);
  next.nextReviewAt = gap === null ? null : addDays(now, gap);
  // A new cycle starts: the passing Evaluate session seeds the headline, otherwise it carries over.
  if (group === 'evaluate') next.headlineScore = result.weightedScore;
  if (options.resetSolidifyEachInterval) next.solidifyScores = {};
  return { state: next, counted: true, advanced: true };
}

/** Outer ring: percent memorised (0..1). */
export function outerRing(state: ProgressState): number {
  return Math.min(1, Math.max(0, state.headlineScore));
}

/** Inner ring: progress through the review plan (0..1). */
export function innerRing(
  state: ProgressState,
  config: SchedulerConfig = SCHEDULER_CONFIG,
): number {
  return Math.min(1, state.intervalIndex / config.intervalsDays.length);
}

/**
 * When to fire the reminder for a due day: `reminderHour` local time on that day.
 * If that moment has passed but the review is still due, remind at the next reminderHour.
 * Returns null when there is nothing to remind about.
 */
export function reminderDate(
  nextReviewAt: number | null,
  now: number,
  config: SchedulerConfig = SCHEDULER_CONFIG,
): Date | null {
  if (nextReviewAt === null) return null;
  const at = new Date(startOfDay(nextReviewAt));
  at.setHours(config.reminderHour, 0, 0, 0);
  if (at.getTime() > now) return at;
  const later = new Date(startOfDay(now));
  later.setHours(config.reminderHour, 0, 0, 0);
  if (later.getTime() <= now) later.setDate(later.getDate() + 1);
  return later;
}
