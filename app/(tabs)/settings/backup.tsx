import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Switch, View } from 'react-native';
import { spacing, useTheme } from '../../../src/components/theme';
import { AppText, Button, Card, Row, Screen } from '../../../src/components/ui';
import { listMemorizations } from '../../../src/db/repo';
import { applyMerge, readAllTables, replaceAll } from '../../../src/features/backup/apply';
import { planMerge, summarize, type BackupFile } from '../../../src/features/backup/backup';
import { exportBackup, pickBackup } from '../../../src/features/backup/service';
import { syncReminders } from '../../../src/features/notifications/reminders';
import { deleteAudioFiles } from '../../../src/features/recordings/files';
import { confirmAction } from '../../../src/lib/dialog';
import { useAppDispatch, useAppSelector } from '../../../src/store';
import { reloadMemorizations } from '../../../src/store/memorizationsSlice';
import { loadSettings, updateSettings } from '../../../src/store/settingsSlice';

export default function BackupScreen() {
  const { t, i18n } = useTranslation();
  const { palette } = useTheme();
  const dispatch = useAppDispatch();
  const settings = useAppSelector((s) => s.settings.values);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const backUp = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const shared = await exportBackup(t('backup.shareTitle'));
      if (!shared) {
        setMessage({ text: t('backup.sharingUnavailable'), ok: false });
        return;
      }
      dispatch(updateSettings({ last_backup_at: Date.now() }));
    } catch (e) {
      setMessage({
        text: t('backup.exportFailed', { error: e instanceof Error ? e.message : String(e) }),
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };

  const choose = async () => {
    setMessage(null);
    const res = await pickBackup();
    if (res.status === 'cancelled') return;
    if (res.status === 'error') return setMessage({ text: t('backup.readFailed'), ok: false });
    if (!res.ok) {
      return setMessage({
        text:
          res.reason === 'unknown-version'
            ? t('backup.unknownVersion', { version: res.version ?? '?' })
            : t('backup.invalid'),
        ok: false,
      });
    }
    setPending(res.backup);
  };

  const finish = async (text: string) => {
    dispatch(loadSettings());
    dispatch(reloadMemorizations());
    const latest = { ...settings };
    await syncReminders(listMemorizations(), latest).catch(() => {});
    setPending(null);
    setMessage({ text, ok: true });
  };

  const doReplace = async () => {
    if (!pending) return;
    const ok = await confirmAction({
      title: t('backup.replaceTitle'),
      message: t('backup.replaceBody'),
      confirmLabel: t('backup.replace'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    const files = replaceAll(pending.tables);
    deleteAudioFiles(files);
    await finish(t('backup.restored', { count: pending.tables.memorizations.length }));
  };

  const doMerge = async () => {
    if (!pending) return;
    const plan = planMerge(readAllTables(), pending.tables);
    applyMerge(plan);
    await finish(t('backup.merged', { added: plan.added, updated: plan.updated, kept: plan.kept }));
  };

  const summary = pending ? summarize(pending) : null;

  return (
    <Screen>
      <Card>
        <AppText variant="heading">{t('backup.exportTitle')}</AppText>
        <AppText>
          {Platform.OS === 'web' ? t('backup.exportBodyWeb') : t('backup.exportBody')}
        </AppText>
        <AppText color={palette.warning}>{t('backup.noRecordings')}</AppText>
        <AppText variant="caption" muted>
          {settings.last_backup_at
            ? t('backup.last', { date: fmt(settings.last_backup_at) })
            : t('backup.never')}
        </AppText>
        <Button testID="backup-now" label={t('backup.now')} onPress={backUp} loading={busy} />
      </Card>

      <Card>
        <AppText variant="heading">{t('backup.restoreTitle')}</AppText>
        <AppText>{t('backup.restoreBody')}</AppText>
        <Button
          testID="restore-choose"
          variant="secondary"
          label={t('backup.choose')}
          onPress={choose}
        />
      </Card>

      {summary ? (
        <Card style={{ borderColor: palette.accent }}>
          <AppText variant="heading">{t('backup.contains')}</AppText>
          <AppText>
            {t('backup.containsBody', {
              texts: summary.memorizations,
              sessions: summary.sessions,
              date: fmt(summary.exportedAt),
            })}
          </AppText>
          <View style={{ gap: 2 }}>
            {summary.titles.slice(0, 8).map((title, i) => (
              <AppText key={i} variant="caption" muted numberOfLines={1}>
                • {title}
              </AppText>
            ))}
            {summary.titles.length > 8 ? (
              <AppText variant="caption" muted>
                {t('editor.previewMore', { count: summary.titles.length - 8 })}
              </AppText>
            ) : null}
          </View>
          <Button testID="restore-merge" label={t('backup.merge')} onPress={doMerge} />
          <AppText variant="caption" muted>
            {t('backup.mergeHelp')}
          </AppText>
          <Button
            testID="restore-replace"
            variant="danger"
            label={t('backup.replace')}
            onPress={doReplace}
          />
          <Button variant="ghost" label={t('common.cancel')} onPress={() => setPending(null)} />
        </Card>
      ) : null}

      {message ? (
        <AppText testID="backup-message" color={message.ok ? palette.success : palette.danger}>
          {message.text}
        </AppText>
      ) : null}

      <Card>
        <Row style={{ justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <AppText variant="label">{t('backup.monthly')}</AppText>
            <AppText variant="caption" muted>
              {t('backup.monthlyHelp')}
            </AppText>
          </View>
          <Switch
            value={settings.backup_reminder_enabled}
            onValueChange={(v) => dispatch(updateSettings({ backup_reminder_enabled: v }))}
          />
        </Row>
      </Card>
    </Screen>
  );
}
