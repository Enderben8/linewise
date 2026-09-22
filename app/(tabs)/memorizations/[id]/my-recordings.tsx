import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, View } from 'react-native';
import { spacing, useTheme } from '../../../../src/components/theme';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Row,
  Screen,
} from '../../../../src/components/ui';
import {
  deleteRecording,
  insertRecording,
  listRecordings,
  renameRecording,
  setVoiceOverrides,
} from '../../../../src/db/repo';
import type { RecordingRow } from '../../../../src/db/schema';
import {
  deleteAudioFiles,
  persistRecording,
  usePlayableUri,
} from '../../../../src/features/recordings/files';
import {
  LISTEN_SOURCE_KEY,
  canAddRecording,
  defaultRecordingName,
  formatDuration,
  isOutOfDate,
} from '../../../../src/features/recordings/rules';
import { LIMITS } from '../../../../src/config';
import { useAppDispatch, useAppSelector } from '../../../../src/store';
import { reloadMemorizations } from '../../../../src/store/memorizationsSlice';
import { newId } from '../../../../src/lib/uuid';
import { confirmAction, notify } from '../../../../src/lib/dialog';

interface RowProps {
  rec: RecordingRow;
  outOfDate: boolean;
  isListenSource: boolean;
  playing: boolean;
  onPlayRequest: () => void;
  onStopped: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onUse: () => void;
}

function RecordingItem({
  rec,
  outOfDate,
  isListenSource,
  playing,
  onPlayRequest,
  onStopped,
  onRename,
  onDelete,
  onUse,
}: RowProps) {
  const { t, i18n } = useTranslation();
  const { palette } = useTheme();
  const player = useAudioPlayer(usePlayableUri(rec.fileUri));
  const status = useAudioPlayerStatus(player);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(rec.name);

  useEffect(() => {
    if (!playing && status.playing) player.pause();
  }, [playing, status.playing, player]);
  useEffect(() => {
    if (status.didJustFinish) onStopped();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  const toggle = () => {
    if (status.playing) {
      player.pause();
      onStopped();
    } else {
      onPlayRequest();
      if (
        status.didJustFinish ||
        (status.duration > 0 && status.currentTime >= status.duration - 0.1)
      ) {
        player.seekTo(0).catch(() => {});
      }
      player.play();
    }
  };

  return (
    <Card style={outOfDate ? { borderColor: palette.warning } : undefined}>
      {editing ? (
        <Row>
          <View style={{ flex: 1 }}>
            <Field value={name} onChangeText={setName} autoFocus maxLength={60} />
          </View>
          <Button
            label={t('common.save')}
            onPress={() => {
              if (name.trim()) onRename(name.trim());
              setEditing(false);
            }}
          />
        </Row>
      ) : (
        <Row style={{ gap: spacing.md }}>
          <IconButton
            testID={`play-${rec.name}`}
            label={status.playing ? t('common.pause') : t('common.play')}
            icon={
              <Ionicons
                name={status.playing ? 'pause-circle' : 'play-circle'}
                size={40}
                color={palette.primary}
              />
            }
            onPress={toggle}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="label" numberOfLines={1}>
              {rec.name}
            </AppText>
            <AppText variant="caption" muted>
              {formatDuration(rec.durationSec)} ·{' '}
              {new Date(rec.createdAt).toLocaleDateString(i18n.language)}
            </AppText>
          </View>
        </Row>
      )}
      {outOfDate ? <AppText color={palette.warning}>{t('recordings.outOfDate')}</AppText> : null}
      <Row style={{ flexWrap: 'wrap' }}>
        <Button
          variant={isListenSource ? 'primary' : 'secondary'}
          label={isListenSource ? t('recordings.usedInListen') : t('recordings.useInListen')}
          onPress={onUse}
        />
        <Button variant="ghost" label={t('recordings.rename')} onPress={() => setEditing(true)} />
        <Button variant="danger" label={t('common.delete')} onPress={onDelete} />
      </Row>
    </Card>
  );
}

export default function MyRecordings() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const dispatch = useAppDispatch();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mem = useAppSelector((s) => s.memorizations.items.find((m) => m.id === id));
  const [recordings, setRecordings] = useState<RecordingRow[]>(() =>
    id ? listRecordings(id) : [],
  );
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 500);

  const refresh = useCallback(() => {
    if (id) setRecordings(listRecordings(id));
  }, [id]);

  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearLimitTimer = () => {
    if (limitTimer.current) clearTimeout(limitTimer.current);
    limitTimer.current = null;
  };

  const stopAndSave = useCallback(async () => {
    if (limitTimer.current) clearTimeout(limitTimer.current);
    limitTimer.current = null;
    if (!id || !mem) return;
    const seconds = recorder.currentTime || recState.durationMillis / 1000;
    setBusy(true);
    try {
      await recorder.stop();
      const temp = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false });
      if (!temp) return;
      const recId = newId();
      const uri = await persistRecording(temp, recId);
      insertRecording({
        memorizationId: id,
        name: defaultRecordingName(
          listRecordings(id).map((r) => r.name),
          t('recordings.defaultName'),
        ),
        fileUri: uri,
        durationSec: seconds,
        bodyHash: mem.bodyHash,
        createdAt: Date.now(),
      });
      refresh();
    } finally {
      setBusy(false);
    }
  }, [id, mem, recorder, recState.durationMillis, refresh, t]);

  // The timer fires the latest stop handler, so a recording ends at the length limit.
  const stopRef = useRef(stopAndSave);
  useEffect(() => {
    stopRef.current = stopAndSave;
  }, [stopAndSave]);
  useEffect(() => clearLimitTimer, []);

  if (!mem) return <EmptyState title={t('detail.notFound')} />;

  const startRecording = async () => {
    if (!canAddRecording(recordings.length)) {
      notify(t('recordings.fullTitle'), t('recordings.fullBody'));
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      if (Platform.OS === 'web') {
        notify(t('recordings.permissionTitle'), t('recordings.permissionBody'));
      } else if (
        await confirmAction({
          title: t('recordings.permissionTitle'),
          message: t('recordings.permissionBody'),
          confirmLabel: t('speechIssue.openSettings'),
          cancelLabel: t('common.cancel'),
        })
      ) {
        Linking.openSettings();
      }
      return;
    }
    setPlayingId(null);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    clearLimitTimer();
    limitTimer.current = setTimeout(() => {
      notify(t('recordings.limitReachedTitle'), t('recordings.limitReachedBody'));
      stopRef.current();
    }, LIMITS.maxRecordingSeconds * 1000);
  };

  const remove = async (rec: RecordingRow) => {
    const ok = await confirmAction({
      title: t('recordings.deleteTitle'),
      message: rec.name,
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    const uri = deleteRecording(rec.id);
    if (uri) deleteAudioFiles([uri]);
    if (mem.progress.voiceOverrides[LISTEN_SOURCE_KEY] === rec.id) {
      const next = { ...mem.progress.voiceOverrides };
      delete next[LISTEN_SOURCE_KEY];
      setVoiceOverrides(mem.id, next);
      dispatch(reloadMemorizations());
    }
    refresh();
  };

  const toggleListenSource = (rec: RecordingRow) => {
    const current = mem.progress.voiceOverrides;
    const next = { ...current };
    if (current[LISTEN_SOURCE_KEY] === rec.id) delete next[LISTEN_SOURCE_KEY];
    else next[LISTEN_SOURCE_KEY] = rec.id;
    setVoiceOverrides(mem.id, next);
    dispatch(reloadMemorizations());
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('games.my-recordings.name') }} />
      <AppText muted>{t('recordings.help', { max: LIMITS.maxRecordingsPerMemorization })}</AppText>

      {recState.isRecording ? (
        <Card style={{ alignItems: 'center', gap: spacing.md }}>
          <Ionicons name="mic" size={48} color={palette.danger} />
          <AppText variant="title" testID="recording-time">
            {formatDuration(recState.durationMillis / 1000)}
          </AppText>
          <Button
            testID="recording-stop"
            label={t('recordings.stop')}
            onPress={stopAndSave}
            loading={busy}
          />
        </Card>
      ) : (
        <Button
          testID="recording-start"
          label={t('recordings.record')}
          onPress={startRecording}
          disabled={busy}
          icon={<Ionicons name="mic" size={20} color={palette.onPrimary} />}
        />
      )}

      {recordings.length === 0 ? <EmptyState title={t('recordings.empty')} /> : null}
      {recordings.map((rec) => (
        <RecordingItem
          key={rec.id}
          rec={rec}
          outOfDate={isOutOfDate(rec.bodyHash, mem.bodyHash)}
          isListenSource={mem.progress.voiceOverrides[LISTEN_SOURCE_KEY] === rec.id}
          playing={playingId === rec.id}
          onPlayRequest={() => setPlayingId(rec.id)}
          onStopped={() => setPlayingId((cur) => (cur === rec.id ? null : cur))}
          onRename={(name) => {
            renameRecording(rec.id, name);
            refresh();
          }}
          onDelete={() => remove(rec)}
          onUse={() => toggleListenSource(rec)}
        />
      ))}
    </Screen>
  );
}
