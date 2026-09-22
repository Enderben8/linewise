import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, useTheme } from '../../../../src/components/theme';
import { AppText, Card, Chip, IconButton, Row } from '../../../../src/components/ui';
import { listRecordings } from '../../../../src/db/repo';
import type { RecordingRow } from '../../../../src/db/schema';
import { SpeechIssueCard, useSpeechGate } from '../../../../src/features/speech/SpeechGate';
import { defaultVoiceFor } from '../../../../src/features/speech/locales';
import { speakAsync, stopSpeaking } from '../../../../src/features/speech/tts';
import { usePlayableUri } from '../../../../src/features/recordings/files';
import { formatDuration, listenSource } from '../../../../src/features/recordings/rules';
import { GameGate } from '../../../../src/games/GameGate';
import { buildSegments, effectiveRate, SPEEDS } from '../../../../src/games/listen';
import type { GameSetup } from '../../../../src/games/useGameSetup';
import { useAppSelector } from '../../../../src/store';

function SpeedChips({ speed, onChange }: { speed: number; onChange: (s: number) => void }) {
  return (
    <Row style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
      {SPEEDS.map((s) => (
        <Chip
          key={s}
          testID={`speed-${s}`}
          label={`${s}×`}
          selected={speed === s}
          onPress={() => onChange(s)}
        />
      ))}
    </Row>
  );
}

function TtsListen({ setup }: { setup: GameSetup }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const baseRate = useAppSelector((s) => s.settings.values.speech_rate);
  const voice = useAppSelector((s) => defaultVoiceFor(s.settings.values.default_voice, setup.lang));
  const segments = useMemo(() => buildSegments(setup.units), [setup]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const gate = useSpeechGate(setup.lang, { needsRecognition: false, needsTts: true });

  const runId = useRef(0);
  const options = useRef({ repeat, speed });
  useEffect(() => {
    options.current = { repeat, speed };
  }, [repeat, speed]);
  const scroller = useRef<ScrollView>(null);
  const ys = useRef<number[]>([]);

  useEffect(
    () => () => {
      runId.current++;
      stopSpeaking();
    },
    [],
  );
  useEffect(() => {
    const y = ys.current[index];
    if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
  }, [index]);

  const playFrom = async (start: number) => {
    const id = ++runId.current;
    stopSpeaking();
    setPlaying(true);
    for (let i = start; i < segments.length; i++) {
      if (runId.current !== id) return;
      setIndex(i);
      await speakAsync(segments[i].text, {
        lang: setup.lang,
        rate: effectiveRate(baseRate, options.current.speed),
        voice,
      });
    }
    if (runId.current !== id) return;
    if (options.current.repeat) {
      playFrom(0);
    } else {
      setPlaying(false);
      setIndex(0);
    }
  };

  const pause = () => {
    runId.current++;
    stopSpeaking();
    setPlaying(false);
  };
  const start = async () => {
    if (!(await gate.check())) return;
    playFrom(index);
  };
  const jump = (delta: number) => {
    const next = Math.min(segments.length - 1, Math.max(0, index + delta));
    setIndex(next);
    if (playing) playFrom(next);
  };
  const changeSpeed = (s: number) => {
    setSpeed(s);
    options.current.speed = s;
    if (playing) playFrom(index);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scroller} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
        {gate.issue ? (
          <SpeechIssueCard issue={gate.issue} lang={setup.lang} onRetry={start} />
        ) : null}
        {segments.map((seg, i) => (
          <View
            key={i}
            onLayout={(e) => (ys.current[i] = e.nativeEvent.layout.y)}
            style={{ marginTop: seg.chunkStart && i > 0 ? spacing.md : 0 }}
          >
            <AppText
              style={{
                fontSize: 19 * 1,
                lineHeight: 30,
                backgroundColor: i === index && playing ? palette.accent : 'transparent',
                color: i === index && playing ? palette.onAccent : palette.text,
                borderRadius: 6,
                paddingHorizontal: 4,
              }}
              onPress={() => jump(i - index)}
            >
              {seg.text}
            </AppText>
          </View>
        ))}
      </ScrollView>
      <Card style={{ borderRadius: 0, paddingBottom: spacing.lg + insets.bottom, gap: spacing.md }}>
        <Row style={{ justifyContent: 'center', gap: spacing.xl }}>
          <IconButton
            label={t('listen.previous')}
            icon={<Ionicons name="play-skip-back" size={28} color={palette.text} />}
            onPress={() => jump(-1)}
          />
          <IconButton
            testID="listen-play"
            label={playing ? t('common.pause') : t('common.play')}
            icon={
              <Ionicons
                name={playing ? 'pause-circle' : 'play-circle'}
                size={64}
                color={palette.primary}
              />
            }
            onPress={playing ? pause : start}
          />
          <IconButton
            label={t('listen.next')}
            icon={<Ionicons name="play-skip-forward" size={28} color={palette.text} />}
            onPress={() => jump(1)}
          />
        </Row>
        <SpeedChips speed={speed} onChange={changeSpeed} />
        <Row style={{ justifyContent: 'center' }}>
          <Chip
            testID="listen-repeat"
            label={t('listen.repeat')}
            selected={repeat}
            onPress={() => setRepeat(!repeat)}
          />
        </Row>
      </Card>
    </View>
  );
}

function RecordingListen({ setup, recording }: { setup: GameSetup; recording: RecordingRow }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const player = useAudioPlayer(usePlayableUri(recording.fileUri));
  const status = useAudioPlayerStatus(player);
  const [speed, setSpeed] = useState<number>(1);
  const [repeat, setRepeat] = useState(false);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
    player.setActiveForLockScreen(true, {
      title: setup.mem.title,
      artist: setup.mem.author || undefined,
    });
    return () => {
      try {
        player.pause();
        player.clearLockScreenControls();
      } catch {
        // The player may already be released when the screen closes.
      }
    };
  }, [player, setup.mem.title, setup.mem.author]);
  useEffect(() => {
    // The native player exposes `loop` as a plain property.
    // eslint-disable-next-line react-hooks/immutability
    player.loop = repeat;
  }, [player, repeat]);

  const toggle = () => {
    if (status.playing) player.pause();
    else {
      if (status.duration > 0 && status.currentTime >= status.duration - 0.1)
        player.seekTo(0).catch(() => {});
      player.play();
    }
  };
  const seek = (delta: number) =>
    player
      .seekTo(Math.max(0, Math.min(status.duration, status.currentTime + delta)))
      .catch(() => {});
  const changeSpeed = (s: number) => {
    setSpeed(s);
    player.setPlaybackRate(s);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Card>
          <AppText variant="heading">{recording.name}</AppText>
          <AppText muted>
            {formatDuration(status.currentTime)} /{' '}
            {formatDuration(status.duration || recording.durationSec)}
          </AppText>
        </Card>
        <AppText muted>{t('listen.recordingHelp')}</AppText>
      </ScrollView>
      <Card style={{ borderRadius: 0, paddingBottom: spacing.lg + insets.bottom, gap: spacing.md }}>
        <Row style={{ justifyContent: 'center', gap: spacing.xl }}>
          <IconButton
            label={t('listen.back10')}
            icon={<Ionicons name="play-back" size={28} color={palette.text} />}
            onPress={() => seek(-10)}
          />
          <IconButton
            testID="listen-play"
            label={status.playing ? t('common.pause') : t('common.play')}
            icon={
              <Ionicons
                name={status.playing ? 'pause-circle' : 'play-circle'}
                size={64}
                color={palette.primary}
              />
            }
            onPress={toggle}
          />
          <IconButton
            label={t('listen.forward10')}
            icon={<Ionicons name="play-forward" size={28} color={palette.text} />}
            onPress={() => seek(10)}
          />
        </Row>
        <SpeedChips speed={speed} onChange={changeSpeed} />
        <Row style={{ justifyContent: 'center' }}>
          <Chip label={t('listen.repeat')} selected={repeat} onPress={() => setRepeat(!repeat)} />
        </Row>
      </Card>
    </View>
  );
}

function Body({ setup }: { setup: GameSetup }) {
  const { t } = useTranslation();
  const recordings = useMemo(() => listRecordings(setup.mem.id), [setup.mem.id]);
  const source = listenSource(
    setup.mem.progress.voiceOverrides,
    recordings.map((r) => r.id),
  );
  const [useRecording, setUseRecording] = useState(source.kind === 'recording');
  const recording =
    source.kind === 'recording' ? recordings.find((r) => r.id === source.id) : undefined;

  return (
    <View style={{ flex: 1 }}>
      {recording ? (
        <Row style={{ justifyContent: 'center', padding: spacing.sm }}>
          <Chip
            label={t('listen.sourceVoice')}
            selected={!useRecording}
            onPress={() => setUseRecording(false)}
          />
          <Chip
            label={t('listen.sourceRecording')}
            selected={useRecording}
            onPress={() => setUseRecording(true)}
          />
        </Row>
      ) : null}
      {recording && useRecording ? (
        <RecordingListen setup={setup} recording={recording} />
      ) : (
        <TtsListen setup={setup} />
      )}
    </View>
  );
}

export default function Listen() {
  const { t } = useTranslation();
  return (
    <GameGate title={t('games.listen.name')} scroll={false}>
      {(setup) => <Body setup={setup} />}
    </GameGate>
  );
}
