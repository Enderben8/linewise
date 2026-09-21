import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { spacing, useTheme } from '../../../../src/components/theme';
import { AppText, Button, Card } from '../../../../src/components/ui';
import { align, scoreAlignment, words, type AlignItem } from '../../../../src/engine';
import { useRecognizer } from '../../../../src/features/speech/recognition';
import { SpeechIssueCard, useSpeechGate } from '../../../../src/features/speech/SpeechGate';
import { DiffView } from '../../../../src/games/DiffView';
import { GameGate } from '../../../../src/games/GameGate';
import { makeResult } from '../../../../src/games/ids';
import { ResultView } from '../../../../src/games/ResultView';
import { unitsText } from '../../../../src/games/setup';
import type { GameSetup } from '../../../../src/games/useGameSetup';
import { useScoredGame } from '../../../../src/games/useScoredGame';

function Body({ setup }: { setup: GameSetup }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const target = useMemo(() => words(unitsText(setup.units), setup.lang), [setup]);
  const [diff, setDiff] = useState<AlignItem[]>([]);
  const [heardNothing, setHeardNothing] = useState(false);
  const { finished, finish, reset } = useScoredGame(setup.mem.id);
  const gate = useSpeechGate(setup.lang, { needsRecognition: true, needsTts: false });

  const rec = useRecognizer({
    lang: setup.lang,
    continuous: true,
    onEnd: (transcript) => {
      const attempt = words(transcript, setup.lang);
      if (attempt.length === 0) {
        setHeardNothing(true);
        return;
      }
      const items = align(target, attempt);
      setDiff(items);
      finish(
        makeResult(
          'speak',
          scoreAlignment(items).accuracy,
          setup.selectionWords,
          setup.totalWords,
          setup.range,
        ),
      );
    },
  });

  const begin = async () => {
    setHeardNothing(false);
    if (!(await gate.check())) return;
    // Bias recognition toward the words of the text; the engine caps the list.
    rec.start(Array.from(new Set(target.map((x) => x.text))).slice(0, 100));
  };
  const done = () => {
    rec.stop();
  };

  if (finished) {
    return (
      <View style={{ gap: spacing.lg }}>
        <ResultView
          result={finished.result}
          outcome={finished.outcome}
          onPlayAgain={() => {
            reset();
            setDiff([]);
          }}
        />
        <AppText variant="heading">{t('speak.review')}</AppText>
        <DiffView items={diff} lang={setup.lang} />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <AppText muted>{t('speak.help', { count: setup.selectionWords })}</AppText>
      {gate.issue ? <SpeechIssueCard issue={gate.issue} lang={setup.lang} onRetry={begin} /> : null}
      {heardNothing ? <AppText color={palette.warning}>{t('speak.heardNothing')}</AppText> : null}
      {rec.error && !rec.listening ? (
        <AppText color={palette.danger}>{t('speak.error', { code: rec.error })}</AppText>
      ) : null}

      {rec.listening ? (
        <>
          <Card style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
            <Ionicons name="mic" size={56} color={palette.danger} />
            <AppText variant="heading">{t('speak.listening')}</AppText>
            <AppText muted style={{ textAlign: 'center' }} testID="speak-transcript">
              {rec.transcript || t('speak.waiting')}
            </AppText>
          </Card>
          <Button testID="speak-done" label={t('speak.done')} onPress={done} />
        </>
      ) : (
        <Button
          testID="speak-start"
          label={t('speak.start')}
          onPress={begin}
          loading={gate.checking}
          icon={<Ionicons name="mic" size={20} color={palette.onPrimary} />}
        />
      )}
    </View>
  );
}

export default function Speak() {
  const { t } = useTranslation();
  return <GameGate title={t('games.speak.name')}>{(setup) => <Body setup={setup} />}</GameGate>;
}
