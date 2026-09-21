import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { spacing, useTheme } from '../../../../src/components/theme';
import { AppText, Button, Card, EmptyState } from '../../../../src/components/ui';
import { GameGate } from '../../../../src/games/GameGate';
import { makeResult } from '../../../../src/games/ids';
import { buildQuestions } from '../../../../src/games/multipleChoice';
import { ResultView } from '../../../../src/games/ResultView';
import type { GameSetup } from '../../../../src/games/useGameSetup';
import { useScoredGame } from '../../../../src/games/useScoredGame';

function Body({ setup }: { setup: GameSetup }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const [round, setRound] = useState(0);
  const questions = useMemo(
    () => buildQuestions(setup.units, setup.lang),
    // A new round draws fresh questions and distractors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setup, round],
  );
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const { finished, finish, reset } = useScoredGame(setup.mem.id);

  if (finished) {
    return (
      <ResultView
        result={finished.result}
        outcome={finished.outcome}
        onPlayAgain={() => {
          reset();
          setIndex(0);
          setPicked(null);
          setCorrect(0);
          setRound((r) => r + 1);
        }}
      />
    );
  }
  if (questions.length === 0) {
    return <EmptyState title={t('choice.tooShort')} body={t('choice.tooShortBody')} />;
  }

  const q = questions[index];
  const answered = picked !== null;

  const pick = (i: number) => {
    if (answered) return;
    setPicked(i);
    if (i === q.correctIndex) setCorrect((c) => c + 1);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  };

  const next = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setPicked(null);
      return;
    }
    finish(
      makeResult(
        'multiple-choice',
        correct / questions.length,
        setup.selectionWords,
        setup.totalWords,
        setup.range,
      ),
    );
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        {t('choice.progress', { n: index + 1, total: questions.length })}
      </AppText>
      <AppText muted>{q.level === 'phrase' ? t('choice.askPhrase') : t('choice.askWord')}</AppText>
      <Card>
        <AppText variant="heading" style={{ lineHeight: 30 }}>
          {q.context}{' '}
          <AppText variant="heading" color={palette.accent}>
            …
          </AppText>
        </AppText>
      </Card>
      <View style={{ gap: spacing.sm }}>
        {q.options.map((option, i) => {
          const isRight = answered && i === q.correctIndex;
          const isWrong = answered && picked === i && i !== q.correctIndex;
          return (
            <Button
              key={option}
              testID={`choice-${i}`}
              variant={isRight ? 'primary' : 'secondary'}
              label={option}
              onPress={() => pick(i)}
              style={
                isWrong
                  ? { borderColor: palette.danger }
                  : isRight
                    ? { backgroundColor: palette.success, borderColor: palette.success }
                    : undefined
              }
            />
          );
        })}
      </View>
      {answered ? (
        <Button
          testID="choice-next"
          label={index + 1 < questions.length ? t('choice.next') : t('choice.finish')}
          onPress={next}
        />
      ) : null}
    </View>
  );
}

export default function MultipleChoice() {
  const { t } = useTranslation();
  return (
    <GameGate title={t('games.multiple-choice.name')}>{(setup) => <Body setup={setup} />}</GameGate>
  );
}
