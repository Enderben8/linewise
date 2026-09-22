import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { MemorizationWithProgress } from '../../db/repo';
import i18n from '../../i18n';
import { planReminders } from './plan';

const CHANNEL_ID = 'reviews';

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

/** Reminders are an Android feature; screens hide their controls when this is false. */
export const REMINDERS_SUPPORTED = true;

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
