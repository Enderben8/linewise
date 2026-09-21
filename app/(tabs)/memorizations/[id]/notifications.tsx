import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { spacing, useTheme } from '../../../../src/components/theme';
import { AppText, Button, Card, EmptyState, Row, Screen } from '../../../../src/components/ui';
import { rowToState, saveProgressState, listMemorizations } from '../../../../src/db/repo';
import {
  hasNotificationPermission,
  requestNotificationPermission,
  syncReminders,
} from '../../../../src/features/notifications/reminders';
import { addDays, daysBetween, previewSchedule } from '../../../../src/scheduler';
import { useAppDispatch, useAppSelector } from '../../../../src/store';
import { reloadMemorizations } from '../../../../src/store/memorizationsSlice';
import { updateSettings } from '../../../../src/store/settingsSlice';

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const { palette } = useTheme();
  const dispatch = useAppDispatch();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mem = useAppSelector((s) => s.memorizations.items.find((m) => m.id === id));
  const settings = useAppSelector((s) => s.settings.values);
  const [now] = useState(() => Date.now());
  const existing = mem?.progress.targetDueDate ?? null;
  const [days, setDays] = useState(existing ? Math.max(1, daysBetween(now, existing)) : 30);
  const [permission, setPermission] = useState<boolean | null>(null);

  useEffect(() => {
    hasNotificationPermission()
      .then(setPermission)
      .catch(() => setPermission(false));
  }, []);

  const state = mem ? rowToState(mem.progress) : null;
  const target = addDays(now, days);
  const plan = useMemo(
    () => (state ? previewSchedule({ ...state, targetDueDate: target }, now) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state?.intervalIndex, state?.nextReviewAt, target],
  );
  if (!mem || !state) return <EmptyState title={t('detail.notFound')} />;

  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString(i18n.language, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const persist = async (targetDueDate: number | null) => {
    saveProgressState(mem.id, { ...state, targetDueDate });
    dispatch(reloadMemorizations());
    await syncReminders(listMemorizations(), settings).catch(() => {});
  };

  const enableReminders = async () => {
    const ok = await requestNotificationPermission();
    setPermission(ok);
    dispatch(updateSettings({ notifications_enabled: ok }));
    if (ok)
      await syncReminders(listMemorizations(), { ...settings, notifications_enabled: true }).catch(
        () => {},
      );
  };

  const step = (delta: number) => setDays((d) => Math.max(1, d + delta));

  return (
    <Screen>
      <Stack.Screen options={{ title: t('detail.reminders') }} />
      <Card>
        <AppText variant="heading">{t('target.title')}</AppText>
        <AppText muted>{t('target.help')}</AppText>
        {existing ? (
          <AppText color={palette.success}>{t('target.current', { date: fmt(existing) })}</AppText>
        ) : null}
        <Row style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button variant="secondary" label="−7" onPress={() => step(-7)} />
          <Button variant="secondary" label="−1" onPress={() => step(-1)} />
          <Button variant="secondary" label="+1" onPress={() => step(1)} />
          <Button variant="secondary" label="+7" onPress={() => step(7)} />
        </Row>
        <AppText variant="heading" style={{ textAlign: 'center' }} testID="target-date">
          {fmt(target)}
        </AppText>
        <AppText muted style={{ textAlign: 'center' }}>
          {t('target.inDays', { count: days })}
        </AppText>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">{t('target.preview')}</AppText>
        {plan.map((step, i) => (
          <Row key={i} style={{ justifyContent: 'space-between' }}>
            <AppText>
              {i === 0 ? t('target.firstReview') : t('target.reviewN', { n: i + 1 })}
            </AppText>
            <AppText variant="label">
              {fmt(step.date)}
              {step.gapDays > 0 ? `  (+${step.gapDays})` : ''}
            </AppText>
          </Row>
        ))}
        {plan.length <= 1 ? <AppText muted>{t('target.planComplete')}</AppText> : null}
      </View>

      <Button testID="save-target" label={t('target.save')} onPress={() => persist(target)} />
      {existing ? (
        <Button variant="secondary" label={t('target.clear')} onPress={() => persist(null)} />
      ) : null}

      <Card>
        <AppText variant="heading">{t('reminders.title')}</AppText>
        <AppText muted>
          {mem.progress.nextReviewAt
            ? t('reminders.next', { date: fmt(mem.progress.nextReviewAt) })
            : t('reminders.none')}
        </AppText>
        {settings.notifications_enabled && permission ? (
          <AppText color={palette.success}>{t('reminders.on')}</AppText>
        ) : (
          <>
            <AppText muted>{t('reminders.off')}</AppText>
            <Button variant="secondary" label={t('reminders.enable')} onPress={enableReminders} />
          </>
        )}
      </Card>
    </Screen>
  );
}
