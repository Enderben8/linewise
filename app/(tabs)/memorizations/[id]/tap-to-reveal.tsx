import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { spacing, useTheme } from '../../../../src/components/theme';
import { AppText, Button, Card, Chip, Row } from '../../../../src/components/ui';
import { phrases, sentences, usesSpaces } from '../../../../src/engine';
import { GameGate } from '../../../../src/games/GameGate';
import { unitAsChunk, tokenizeUnits } from '../../../../src/games/tokens';
import type { GameSetup } from '../../../../src/games/useGameSetup';
import { defaultVoiceFor } from '../../../../src/features/speech/locales';
import { speakAsync, stopSpeaking } from '../../../../src/features/speech/tts';
import { useAppSelector } from '../../../../src/store';

type Mode = 'phrase' | 'sentence' | 'word';

interface Piece {
  text: string;
  /** Start a new line before this piece (a new chunk begins). */
  breakBefore: boolean;
}

function buildPieces(setup: GameSetup, mode: Mode): Piece[] {
  const out: Piece[] = [];
  if (mode === 'word') {
    let lastChunk = -1;
    for (const line of tokenizeUnits(setup.units, setup.lang).lines) {
      line.tokens.forEach((t, i) => {
        out.push({ text: t.text, breakBefore: i === 0 && line.chunkIndex !== lastChunk });
      });
      lastChunk = line.chunkIndex;
    }
    return out;
  }
  for (const unit of setup.units) {
    const chunk = unitAsChunk(unit);
    let parts = mode === 'phrase' ? phrases(chunk) : sentences(chunk);
    // Text with no commas or line breaks has one phrase; fall back to sentences so there is something to reveal.
    if (mode === 'phrase' && parts.length < 2) parts = sentences(chunk);
    parts.forEach((text, i) => out.push({ text, breakBefore: i === 0 && out.length > 0 }));
  }
  return out;
}

function Body({ setup }: { setup: GameSetup }) {
  const { t } = useTranslation();
  const { palette, fontScale } = useTheme();
  const rate = useAppSelector((s) => s.settings.values.speech_rate);
  const voice = useAppSelector((s) => defaultVoiceFor(s.settings.values.default_voice, setup.lang));
  const [mode, setMode] = useState<Mode>('phrase');
  const [count, setCount] = useState(0);
  const [speak, setSpeak] = useState(false);
  const pieces = useMemo(() => buildPieces(setup, mode), [setup, mode]);
  const glue = usesSpaces(setup.lang) ? ' ' : '';

  useEffect(() => () => stopSpeaking(), []);
  const changeMode = (m: Mode) => {
    setMode(m);
    setCount(0);
  };

  const reveal = () => {
    if (count >= pieces.length) return;
    const next = pieces[count];
    setCount(count + 1);
    if (speak) {
      stopSpeaking();
      speakAsync(next.text, { lang: setup.lang, rate, voice });
    }
  };
  const undo = () => setCount((c) => Math.max(0, c - 1));
  const shown = pieces.slice(0, count);

  return (
    <View style={{ gap: spacing.lg }}>
      <Row style={{ flexWrap: 'wrap' }}>
        {(['phrase', 'sentence', 'word'] as Mode[]).map((m) => (
          <Chip
            key={m}
            testID={`mode-${m}`}
            label={t(`tap.mode.${m}`)}
            selected={mode === m}
            onPress={() => changeMode(m)}
          />
        ))}
        <Chip label={t('tap.speak')} selected={speak} onPress={() => setSpeak(!speak)} />
      </Row>

      <Pressable
        testID="reveal-area"
        onPress={reveal}
        accessibilityRole="button"
        accessibilityLabel={t('tap.revealNext')}
      >
        <Card style={{ minHeight: 220, justifyContent: 'center' }}>
          {shown.length === 0 ? (
            <AppText muted style={{ textAlign: 'center' }}>
              {t('tap.start')}
            </AppText>
          ) : (
            <AppText
              style={{ fontSize: 19 * fontScale, lineHeight: 19 * fontScale * 1.7 }}
              scale={false}
            >
              {shown
                .map((p, i) => `${i > 0 ? (p.breakBefore ? '\n\n' : glue) : ''}${p.text}`)
                .join('')}
            </AppText>
          )}
        </Card>
      </Pressable>

      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        {t('tap.progress', { shown: count, total: pieces.length })}
      </AppText>
      <Row>
        <Button
          style={{ flex: 1 }}
          label={t('tap.revealNext')}
          onPress={reveal}
          disabled={count >= pieces.length}
        />
        <Button variant="secondary" label={t('tap.undo')} onPress={undo} disabled={count === 0} />
        <Button
          variant="secondary"
          label={t('tap.reset')}
          onPress={() => setCount(0)}
          disabled={count === 0}
        />
      </Row>
      {count >= pieces.length && pieces.length > 0 ? (
        <AppText color={palette.success} style={{ textAlign: 'center' }}>
          {t('tap.done')}
        </AppText>
      ) : null}
    </View>
  );
}

export default function TapToReveal() {
  const { t } = useTranslation();
  return (
    <GameGate title={t('games.tap-to-reveal.name')}>{(setup) => <Body setup={setup} />}</GameGate>
  );
}
