import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { BACKUP } from '../../config';
import type { MemorizationWithProgress } from '../../db/repo';
import i18n from '../../i18n';
import { reminderDate } from '../../scheduler';

const CHANNEL_ID = 'reviews';
const BACKUP_ID = 'backup-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: i18n.t('notifications.channel'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function hasNotificationPermission(): Promise<boolean> {
  const p = await Notifications.getPermissionsAsync();
  return p.granted;
}

/** Asks for permission if it has not been decided. Returns whether reminders can be shown. */
export async function requestNotificationPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

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
      identifier: BACKUP_ID,
      title: opts.t('notifications.backupTitle'),
      body: opts.t('notifications.backupBody'),
      date,
    });
  }
  return plan;
}

/**
 * Cancels every scheduled reminder and schedules a fresh set. Cheap enough to run on
 * app start (the phone may have restarted) and after each counting session.
 */
export async function syncReminders(
  items: MemorizationWithProgress[],
  settings: {
    notifications_enabled: boolean;
    backup_reminder_enabled: boolean;
    last_backup_at: number | null;
  },
): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.notifications_enabled) return;
  if (!(await hasNotificationPermission())) return;
  await ensureChannel();
  const plan = planReminders(items, {
    now: Date.now(),
    lastBackupAt: settings.last_backup_at,
    backupReminder: settings.backup_reminder_enabled,
    t: (k, o) => i18n.t(k, o) as string,
  });
  for (const p of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.identifier,
      content: {
        title: p.title,
        body: p.body,
        data: p.memorizationId ? { memorizationId: p.memorizationId } : {},
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.date,
        channelId: CHANNEL_ID,
      },
    });
  }
}
