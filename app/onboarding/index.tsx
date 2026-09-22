import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Mascot } from '../../src/components/Mascot';
import { spacing } from '../../src/components/theme';
import { AppText, Button, Chip, Row, Screen } from '../../src/components/ui';
import {
  REMINDERS_SUPPORTED,
  requestNotificationPermission,
} from '../../src/features/notifications/reminders';
import { useAppDispatch } from '../../src/store';
import { updateSettings } from '../../src/store/settingsSlice';

const GOALS = ['poem', 'speech', 'script', 'verse', 'other'] as const;

export default function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<(typeof GOALS)[number]>('poem');
  const [reminders, setReminders] = useState(true);

  const finish = async () => {
    let enabled = reminders && REMINDERS_SUPPORTED;
    if (enabled) enabled = await requestNotificationPermission();
    dispatch(updateSettings({ notifications_enabled: enabled }));
    router.push({ pathname: '/onboarding/demo', params: { goal } });
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Mascot mood="happy" size={110} />
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {t('onboarding.welcome')}
        </AppText>
        <AppText muted style={{ textAlign: 'center' }}>
          {t('onboarding.tagline')}
        </AppText>
      </View>

      {step === 0 ? (
        <View style={{ gap: spacing.md }}>
          <AppText variant="heading">{t('onboarding.goalQuestion')}</AppText>
          <Row style={{ flexWrap: 'wrap' }}>
            {GOALS.map((g) => (
              <Chip
                key={g}
                testID={`goal-${g}`}
                label={t(`onboarding.goals.${g}`)}
                selected={goal === g}
                onPress={() => setGoal(g)}
              />
            ))}
          </Row>
          {/* Browsers cannot deliver reminders (see reminders.web.ts), so the web app skips that question. */}
          <Button
            testID="onboarding-next"
            label={REMINDERS_SUPPORTED ? t('common.next') : t('onboarding.tryDemo')}
            onPress={() => (REMINDERS_SUPPORTED ? setStep(1) : finish())}
          />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: spacing.md }}>
          <AppText variant="heading">{t('onboarding.reminderQuestion')}</AppText>
          <AppText muted>{t('onboarding.reminderBody')}</AppText>
          <Row>
            <Chip label={t('common.yes')} selected={reminders} onPress={() => setReminders(true)} />
            <Chip
              label={t('common.no')}
              selected={!reminders}
              onPress={() => setReminders(false)}
            />
          </Row>
          <Row>
            <Button variant="secondary" label={t('common.back')} onPress={() => setStep(0)} />
            <Button
              style={{ flex: 1 }}
              testID="onboarding-demo"
              label={t('onboarding.tryDemo')}
              onPress={finish}
            />
          </Row>
        </View>
      ) : null}

      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        {t('onboarding.offline')}
      </AppText>
    </Screen>
  );
}
