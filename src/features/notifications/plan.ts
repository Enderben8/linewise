import { BACKUP } from '../../config';
import type { MemorizationWithProgress } from '../../db/repo';
import { reminderDate } from '../../scheduler';

export const BACKUP_REMINDER_ID = 'backup-reminder';

export interface ReminderPlanItem {
  identifier: string;
  title: string;
  body: string;
  date: Date;
  memorizationId?: string;
}

/** Pure planning step so the schedule can be tested without the native module. */
export function planReminders(
  items: Pick<MemorizationWithProgress, 'id' | 'title' | 'progress'>[],
  opts: {
    now: number;
    lastBackupAt: number | null;
    backupReminder: boolean;
    t: (key: string, o?: Record<string, unknown>) => string;
  },
): ReminderPlanItem[] {
  const plan: ReminderPlanItem[] = [];
  for (const m of items) {
    const date = reminderDate(m.progress.nextReviewAt, opts.now);
    if (!date) continue;
    plan.push({
      identifier: `review-${m.id}`,
      title: opts.t('notifications.reviewTitle'),
      body: opts.t('notifications.reviewBody', { title: m.title }),
      date,
      memorizationId: m.id,
    });
  }
  if (opts.backupReminder) {
    const base = opts.lastBackupAt ?? opts.now;
    const due = base + BACKUP.reminderDays * 86_400_000;
    const date = new Date(Math.max(due, opts.now + 60_000));
    date.setHours(10, 0, 0, 0);
    if (date.getTime() <= opts.now) date.setDate(date.getDate() + 1);
    plan.push({
      identifier: BACKUP_REMINDER_ID,
      title: opts.t('notifications.backupTitle'),
      body: opts.t('notifications.backupBody'),
      date,
    });
  }
  return plan;
}
