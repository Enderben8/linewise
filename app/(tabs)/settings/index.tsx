import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Switch, View } from 'react-native';
import { spacing, useTheme } from '../../../src/components/theme';
import { AppText, Button, Card, Chip, Row, Screen } from '../../../src/components/ui';
import { APP } from '../../../src/config';
import { confirmAction, notify } from '../../../src/lib/dialog';
import { listMemorizations } from '../../../src/db/repo';
import { LANGUAGES } from '../../../src/features/settings/defaults';
import {
  REMINDERS_SUPPORTED,
  requestNotificationPermission,
  syncReminders,
} from '../../../src/features/notifications/reminders';
import { speakAsync } from '../../../src/features/speech/tts';
import { checkForUpdate, UPDATE_CHECK_SUPPORTED } from '../../../src/features/updates/check';
import { currentVersion, offerUpdate } from '../../../src/features/updates/offer';
import { applyLocale } from '../../../src/i18n';
import { useAppDispatch, useAppSelector } from '../../../src/store';
import { updateSettings } from '../../../src/store/settingsSlice';

const FONT_SIZES = [0.85, 1, 1.15, 1.3, 1.5];
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="heading">{title}</AppText>
      <Card>{children}</Card>
    </View>
  );
}

function ToggleRow({
  label,
  help,
  value,
  onChange,
  testID,
}: {
  label: string;
  help?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  return (
    <Row style={{ justifyContent: 'space-between', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <AppText variant="label">{label}</AppText>
        {help ? (
          <AppText variant="caption" muted>
            {help}
          </AppText>
        ) : null}
      </View>
      <Switch testID={testID} value={value} onValueChange={onChange} accessibilityLabel={label} />
    </Row>
  );
}

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { palette } = useTheme();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const settings = useAppSelector((s) => s.settings.values);
  const [restartNote, setRestartNote] = useState(false);
  const [checking, setChecking] = useState(false);

  // The one place the user asks for the update check; the launch check is in app/_layout.tsx.
  const checkNow = async () => {
    setChecking(true);
    try {
      const update = await checkForUpdate(currentVersion());
      if (update) await offerUpdate(update);
      else notify(t('updates.upToDate'));
    } catch {
      notify(t('updates.failed'));
    } finally {
      setChecking(false);
    }
  };

  const changeLocale = async (locale: string) => {
    dispatch(updateSettings({ locale }));
    const { needsRestart } = await applyLocale(locale);
    setRestartNote(needsRestart);
  };

  const toggleNotifications = async (on: boolean) => {
    if (on) {
      const ok = await requestNotificationPermission();
      if (!ok) {
        const open = await confirmAction({
          title: t('settings.notificationsBlockedTitle'),
          message: t('settings.notificationsBlockedBody'),
          confirmLabel: t('speechIssue.openSettings'),
          cancelLabel: t('common.cancel'),
        });
        if (open) Linking.openSettings();
        return;
      }
    }
    dispatch(updateSettings({ notifications_enabled: on }));
    await syncReminders(listMemorizations(), { ...settings, notifications_enabled: on }).catch(
      () => {},
    );
  };

  return (
    <Screen>
      <Section title={t('settings.language')}>
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip
            label={t('settings.system')}
            selected={settings.locale === 'system'}
            onPress={() => changeLocale('system')}
          />
          {LANGUAGES.map((l) => (
            <Chip
              key={l.code}
              testID={`locale-${l.code}`}
              label={l.name}
              selected={settings.locale === l.code}
              onPress={() => changeLocale(l.code)}
            />
          ))}
        </Row>
        {restartNote ? (
          <AppText color={palette.warning} testID="restart-note">
            {t('settings.restartNote')}
          </AppText>
        ) : null}
        <AppText variant="label" muted style={{ marginTop: spacing.sm }}>
          {t('settings.defaultLanguage')}
        </AppText>
        <Row style={{ flexWrap: 'wrap' }}>
          {LANGUAGES.map((l) => (
            <Chip
              key={l.code}
              label={l.name}
              selected={settings.default_language === l.code}
              onPress={() => dispatch(updateSettings({ default_language: l.code }))}
            />
          ))}
        </Row>
      </Section>

      <Section title={t('settings.fontSize')}>
        <Row style={{ flexWrap: 'wrap' }}>
          {FONT_SIZES.map((f) => (
            <Chip
              key={f}
              testID={`font-${f}`}
              label={`${Math.round(f * 100)}%`}
              selected={settings.font_size === f}
              onPress={() => dispatch(updateSettings({ font_size: f }))}
            />
          ))}
        </Row>
        <AppText>{t('settings.fontPreview')}</AppText>
      </Section>

      <Section title={t('settings.speech')}>
        <AppText variant="label" muted>
          {t('settings.speechRate')}
        </AppText>
        <Row style={{ flexWrap: 'wrap' }}>
          {RATES.map((r) => (
            <Chip
              key={r}
              label={`${r}×`}
              selected={settings.speech_rate === r}
              onPress={() => dispatch(updateSettings({ speech_rate: r }))}
            />
          ))}
        </Row>
        <Button
          variant="secondary"
          label={t('settings.testSpeech')}
          onPress={() =>
            // The sentence is in the app's language, so read it in that language.
            speakAsync(t('settings.testSentence'), {
              lang: i18n.language,
              rate: settings.speech_rate,
            })
          }
        />
        <Button
          variant="secondary"
          label={t('settings.voices')}
          onPress={() => router.push('/settings/voices')}
        />
      </Section>

      <Section title={t('settings.reviews')}>
        {REMINDERS_SUPPORTED ? (
          <ToggleRow
            label={t('settings.notifications')}
            help={t('settings.notificationsHelp')}
            value={settings.notifications_enabled}
            onChange={toggleNotifications}
            testID="toggle-notifications"
          />
        ) : (
          <AppText variant="caption" muted>
            {t('reminders.web')}
          </AppText>
        )}
        <ToggleRow
          label={t('settings.resetSolidify')}
          help={t('settings.resetSolidifyHelp')}
          value={settings.reset_solidify_each_interval}
          onChange={(v) => dispatch(updateSettings({ reset_solidify_each_interval: v }))}
        />
      </Section>

      <Section title={t('settings.data')}>
        <Button
          testID="open-backup"
          variant="secondary"
          label={t('settings.backup')}
          onPress={() => router.push('/settings/backup')}
        />
        <AppText variant="caption" muted>
          {t('settings.offlineNote')}
        </AppText>
      </Section>

      <Section title={t('settings.about')}>
        <AppText>
          {APP.name} {currentVersion()}
        </AppText>
        {UPDATE_CHECK_SUPPORTED ? (
          <>
            <ToggleRow
              label={t('settings.updates')}
              help={t('settings.updatesHelp')}
              value={settings.update_check_enabled}
              onChange={(v) => dispatch(updateSettings({ update_check_enabled: v }))}
              testID="toggle-updates"
            />
            <Button
              testID="check-updates"
              variant="secondary"
              label={t('settings.checkNow')}
              loading={checking}
              onPress={checkNow}
            />
          </>
        ) : (
          <AppText variant="caption" muted>
            {t('settings.webUpdates')}
          </AppText>
        )}
        <Button
          variant="secondary"
          label={t('settings.faq')}
          onPress={() => router.push('/settings/faq')}
        />
        <Button
          variant="secondary"
          label={t('settings.report')}
          onPress={() => Linking.openURL(APP.issuesUrl)}
        />
        <AppText variant="caption" muted>
          {t('settings.reportNote')}
        </AppText>
        <Button
          variant="ghost"
          label={t('settings.replayIntro')}
          onPress={() => router.push('/onboarding')}
        />
      </Section>
    </Screen>
  );
}
