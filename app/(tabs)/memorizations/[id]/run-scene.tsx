import { Ionicons } from '@expo/vector-icons';
import type { Voice } from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { spacing, useTheme } from '../../../../src/components/theme';
import { AppText, Button, Card, Chip, Row } from '../../../../src/components/ui';
import { setVoiceOverrides } from '../../../../src/db/repo';
import { align, scoreAlignment, words, type AlignItem } from '../../../../src/engine';
import { issueFromError, useRecognizer } from '../../../../src/features/speech/recognition';
import { SpeechIssueCard, useSpeechGate } from '../../../../src/features/speech/SpeechGate';
import { defaultVoiceFor } from '../../../../src/features/speech/locales';
import { speakAsync, stopSpeaking, voicesFor } from '../../../../src/features/speech/tts';
import { DiffView } from '../../../../src/games/DiffView';
import { GameGate } from '../../../../src/games/GameGate';
import { makeResult } from '../../../../src/games/ids';
import { ResultView } from '../../../../src/games/ResultView';
import {
  buildScene,
  pitchFor,
  roleWordCount,
  rolesOf,
  voiceFor,
  type SceneStep,
} from '../../../../src/games/scene';
import type { GameSetup } from '../../../../src/games/useGameSetup';
import { useScoredGame } from '../../../../src/games/useScoredGame';
import { useAppDispatch, useAppSelector } from '../../../../src/store';
import { reloadMemorizations } from '../../../../src/store/memorizationsSlice';

interface LineResult {
  step: SceneStep;
  items: AlignItem[];
}

type Prompt = 'idle' | 'listening' | 'retry';

function Body({ setup }: { setup: GameSetup }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const dispatch = useAppDispatch();
  const rate = useAppSelector((s) => s.settings.values.speech_rate);
  const defaultVoice = useAppSelector((s) =>
    defaultVoiceFor(s.settings.values.default_voice, setup.lang),
  );
  const steps = useMemo(() => buildScene(setup.mem.chunks, setup.selection), [setup]);
  const roles = useMemo(() => rolesOf(steps), [steps]);

  const [role, setRole] = useState(
    setup.selection.speaker && roles.includes(setup.selection.speaker)
      ? setup.selection.speaker
      : (roles[0] ?? ''),
  );
  const [narrate, setNarrate] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, string>>(
    setup.mem.progress.voiceOverrides,
  );
  const [voices, setVoices] = useState<Voice[]>([]);
  const [running, setRunning] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [prompt, setPrompt] = useState<Prompt>('idle');
  const [hint, setHint] = useState(false);
  const [results, setResults] = useState<LineResult[]>([]);
  const { finished, finish, reset } = useScoredGame(setup.mem.id);
  const gate = useSpeechGate(setup.lang, { needsRecognition: true, needsTts: true });

  const runId = useRef(0);
  const pendingTranscript = useRef<((text: string) => void) | null>(null);
  const pendingDecision = useRef<((retry: boolean) => void) | null>(null);

  const rec = useRecognizer({
    lang: setup.lang,
    continuous: false,
    onEnd: (text) => pendingTranscript.current?.(text),
    onError: (code) => {
      // A missing language pack or permission ends the scene and shows what to fix.
      if (issueFromError(code)) {
        runId.current++;
        stopSpeaking();
        pendingDecision.current?.(false);
        setRunning(false);
        setPrompt('idle');
      }
    },
  });

  useEffect(() => {
    voicesFor(setup.lang).then(setVoices);
  }, [setup.lang]);
  useEffect(
    () => () => {
      runId.current++;
      stopSpeaking();
    },
    [],
  );

  const cycleVoice = (who: string) => {
    const ids = [null, ...voices.map((v) => v.identifier)];
    const current = ids.indexOf(overrides[who] ?? null);
    const next = ids[(current + 1) % ids.length];
    const updated = { ...overrides };
    if (next === null) delete updated[who];
    else updated[who] = next;
    setOverrides(updated);
    setVoiceOverrides(setup.mem.id, updated);
    dispatch(reloadMemorizations());
  };
  const voiceLabel = (who: string) => {
    const id = overrides[who];
    return voices.find((v) => v.identifier === id)?.name ?? t('scene.defaultVoice');
  };
  const testVoice = (who: string) =>
    speakAsync(who || t('scene.narrator'), {
      lang: setup.lang,
      rate,
      voice: voiceFor(who, overrides, defaultVoice),
      pitch: pitchFor(who, roles),
    });

  const listenOnce = useCallback(
    (step: SceneStep) =>
      new Promise<string>((resolve) => {
        pendingTranscript.current = resolve;
        rec.start(Array.from(new Set(words(step.text, setup.lang).map((w) => w.text))));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setup.lang, rec.start],
  );

  const play = async () => {
    if (!(await gate.check())) return;
    const id = ++runId.current;
    setResults([]);
    setRunning(true);
    const collected: LineResult[] = [];
    for (let i = 0; i < steps.length; i++) {
      if (runId.current !== id) return;
      const step = steps[i];
      setCursor(i);
      setHint(false);
      if (step.kind === 'action' || step.speaker !== role) {
        if (step.kind === 'action' && !narrate) continue;
        await speakAsync(step.text, {
          lang: setup.lang,
          rate,
          voice: voiceFor(step.speaker, overrides, defaultVoice),
          pitch: pitchFor(step.speaker, roles),
        });
        continue;
      }
      // The user's line: listen, then score. Retry or skip when nothing was heard.
      let transcript = '';
      for (;;) {
        setPrompt('listening');
        transcript = await listenOnce(step);
        if (runId.current !== id) return;
        if (transcript.trim()) break;
        setPrompt('retry');
        const retry = await new Promise<boolean>((resolve) => {
          pendingDecision.current = resolve;
        });
        if (runId.current !== id) return;
        if (!retry) break;
      }
      setPrompt('idle');
      collected.push({
        step,
        items: align(words(step.text, setup.lang), words(transcript, setup.lang)),
      });
      setResults([...collected]);
    }
    if (runId.current !== id) return;
    setRunning(false);
    const combined = collected.flatMap((r) => r.items);
    const accuracy = scoreAlignment(combined).accuracy;
    finish(
      makeResult(
        'run-scene',
        accuracy,
        roleWordCount(steps, role, setup.lang),
        setup.totalWords,
        setup.range,
      ),
    );
  };

  const stop = () => {
    runId.current++;
    stopSpeaking();
    rec.abort();
    pendingDecision.current?.(false);
    setRunning(false);
    setPrompt('idle');
  };

  if (finished) {
    return (
      <View style={{ gap: spacing.lg }}>
        <ResultView
          result={finished.result}
          outcome={finished.outcome}
          onPlayAgain={() => {
            reset();
            setResults([]);
            setCursor(0);
          }}
        />
        <AppText variant="heading">{t('scene.review')}</AppText>
        {results.map((r, i) => (
          <View key={i} style={{ gap: spacing.xs }}>
            <DiffView items={r.items} lang={setup.lang} />
          </View>
        ))}
      </View>
    );
  }

  if (roles.length === 0) {
    return <AppText muted>{t('scene.noRoles')}</AppText>;
  }

  if (!running) {
    return (
      <View style={{ gap: spacing.lg }}>
        <AppText muted>{t('scene.help')}</AppText>
        {(gate.issue ?? rec.issue) ? (
          <SpeechIssueCard issue={(gate.issue ?? rec.issue)!} lang={setup.lang} onRetry={play} />
        ) : null}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label" muted>
            {t('scene.yourRole')}
          </AppText>
          <Row style={{ flexWrap: 'wrap' }}>
            {roles.map((r) => (
              <Chip
                key={r}
                testID={`role-${r}`}
                label={r}
                selected={role === r}
                onPress={() => setRole(r)}
              />
            ))}
          </Row>
        </View>
        <Row>
          <Chip
            label={t('scene.narrate')}
            selected={narrate}
            onPress={() => setNarrate(!narrate)}
          />
        </Row>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label" muted>
            {t('scene.voices')}
          </AppText>
          {[...roles.filter((r) => r !== role), ''].map((who) => (
            <Card key={who || 'narrator'} style={{ padding: spacing.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <AppText variant="label">{who || t('scene.narrator')}</AppText>
                <Row>
                  <Button variant="ghost" label={voiceLabel(who)} onPress={() => cycleVoice(who)} />
                  <Button variant="ghost" label={t('scene.test')} onPress={() => testVoice(who)} />
                </Row>
              </Row>
            </Card>
          ))}
          {voices.length === 0 ? (
            <AppText variant="caption" muted>
              {t('scene.noVoices')}
            </AppText>
          ) : null}
        </View>
        <Button
          testID="scene-start"
          label={t('scene.start')}
          onPress={play}
          loading={gate.checking}
        />
      </View>
    );
  }

  const step = steps[cursor];
  const mine = step?.kind === 'line' && step.speaker === role;
  return (
    <View style={{ gap: spacing.lg }}>
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        {t('scene.progress', { n: cursor + 1, total: steps.length })}
      </AppText>
      <Card
        style={{
          minHeight: 180,
          justifyContent: 'center',
          gap: spacing.md,
          borderColor: mine ? palette.accent : palette.border,
        }}
      >
        {step ? (
          <>
            <AppText variant="label" color={palette.primary}>
              {step.kind === 'action' ? t('scene.narrator') : step.speaker || t('scene.narrator')}
            </AppText>
            {mine ? (
              hint ? (
                <AppText variant="heading">{step.text}</AppText>
              ) : (
                <AppText muted>{t('scene.yourLine')}</AppText>
              )
            ) : (
              <AppText
                variant="heading"
                style={step.kind === 'action' ? { fontStyle: 'italic' } : undefined}
              >
                {step.text}
              </AppText>
            )}
          </>
        ) : null}
      </Card>
      {mine && prompt === 'listening' ? (
        <>
          <Row style={{ justifyContent: 'center' }}>
            <Ionicons name="mic" size={28} color={palette.danger} />
            <AppText muted testID="scene-transcript">
              {rec.transcript || t('speak.waiting')}
            </AppText>
          </Row>
          <Row>
            <Button
              style={{ flex: 1 }}
              label={t('scene.hint')}
              variant="secondary"
              onPress={() => setHint(true)}
            />
            <Button style={{ flex: 1 }} label={t('speak.done')} onPress={() => rec.stop()} />
          </Row>
        </>
      ) : null}
      {mine && prompt === 'retry' ? (
        <Card>
          <AppText>{t('scene.heardNothing')}</AppText>
          <Row>
            <Button
              style={{ flex: 1 }}
              label={t('scene.retry')}
              onPress={() => pendingDecision.current?.(true)}
            />
            <Button
              style={{ flex: 1 }}
              variant="secondary"
              label={t('scene.skip')}
              onPress={() => pendingDecision.current?.(false)}
            />
          </Row>
        </Card>
      ) : null}
      <Button variant="danger" label={t('scene.stop')} onPress={stop} />
    </View>
  );
}

export default function RunScene() {
  const { t } = useTranslation();
  return <GameGate title={t('games.run-scene.name')}>{(setup) => <Body setup={setup} />}</GameGate>;
}
