import { BACKUP } from '../../config';
import { daysBetween, isReviewDay, type ProgressState } from '../../scheduler';

export type ReviewStatus =
  { kind: 'new' } | { kind: 'due' } | { kind: 'upcoming'; days: number } | { kind: 'done' };

export function reviewStatus(state: ProgressState, now: number): ReviewStatus {
  if (state.nextReviewAt === null) {
    return state.intervalIndex === 0 ? { kind: 'new' } : { kind: 'done' };
  }
  if (isReviewDay(state, now)) return { kind: 'due' };
  return { kind: 'upcoming', days: Math.max(1, daysBetween(now, state.nextReviewAt)) };
}

/** True when the monthly backup nudge should show. Counts from the last backup, or from the oldest text if none. */
export function backupDue(
  opts: { enabled: boolean; lastBackupAt: number | null; oldestCreatedAt: number | null },
  now: number,
): boolean {
  if (!opts.enabled) return false;
  const since = opts.lastBackupAt ?? opts.oldestCreatedAt;
  if (since === null) return false;
  return now - since >= BACKUP.reminderDays * 86_400_000;
}

/** Splits a comma or newline separated tag string into unique, trimmed tags. */
export function parseTags(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(/[,\n]/)) {
    const tag = raw.trim();
    if (tag && !out.some((t) => t.toLowerCase() === tag.toLowerCase())) out.push(tag);
  }
  return out;
}

export function matchesSearch(
  m: { title: string; author: string; tags: string[] },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    m.title.toLowerCase().includes(q) ||
    m.author.toLowerCase().includes(q) ||
    m.tags.some((t) => t.toLowerCase().includes(q))
  );
}
