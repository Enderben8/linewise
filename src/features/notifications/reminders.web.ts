// Browsers cannot schedule a notification for a later day without a push server, which Linewise
// does not have. On the web, due reviews show as "Review today" badges and the monthly backup nudge
// shows in the list instead. These keep the same exports as reminders.ts and do nothing.
import type { MemorizationWithProgress } from '../../db/repo';

export { planReminders, type ReminderPlanItem } from './plan';

/** Reminders are an Android feature; screens hide their controls when this is false. */
export const REMINDERS_SUPPORTED = false;

export async function hasNotificationPermission(): Promise<boolean> {
  return false;
}

export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function syncReminders(
  _items: MemorizationWithProgress[],
  _settings: {
    notifications_enabled: boolean;
    backup_reminder_enabled: boolean;
    last_backup_at: number | null;
  },
): Promise<void> {}
