/** Tunable defaults. See SPEC.md §8 and §9. */

export const SCHEDULER_CONFIG = {
  /** Days between reviews, by stage. */
  intervalsDays: [1, 2, 4, 7, 14, 30, 60],
  /** A counting session must reach this weightedScore to advance. */
  passMark: 0.8,
  /** After a failed counting session the next review is this many days away. */
  retryDays: 1,
  /** Never schedule closer than this, even when a target date squeezes the plan. */
  minIntervalDays: 1,
  /** Local hour at which review reminders fire. */
  reminderHour: 9,
} as const;

export const LIMITS = {
  maxBodyBytes: 100 * 1024,
  maxRecordingsPerMemorization: 10,
  maxRecordingSeconds: 10 * 60,
} as const;

export const BACKUP = {
  /** Bump when the backup file layout changes. Older versions are rejected unless migrated. */
  version: 1,
  reminderDays: 30,
} as const;

export const APP = {
  name: 'Linewise',
  issuesUrl: 'https://github.com/Enderben8/linewise/issues',
} as const;
