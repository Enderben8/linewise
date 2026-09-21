import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { spacing, useTheme } from '../../../../src/components/theme';
import { AppText, Card } from '../../../../src/components/ui';
import {
  accuracyOf,
  initialFirstLetter,
  isFinished,
  typeLetter,
  type FirstLetterState,
} from '../../../../src/games/firstLetter';
import { GameGate } from '../../../../src/games/GameGate';
import { makeResult } from '../../../../src/games/ids';
import { MaskedLines } from '../../../../src/games/MaskedLines';
import { ResultView } from '../../../../src/games/ResultView';
import { tokenizeUnits } from '../../../../src/games/tokens';
import type { GameSetup } from '../../../../src/games/useGameSetup';
import { useScoredGame } from '../../../../src/games/useScoredGame';

function Body({ setup }: { setup: GameSetup }) {
  const { t } = useTranslation();
  const { palette, fontScale } = useTheme();
  const tokenized = useMemo(() => tokenizeUnits(setup.units, setup.lang), [setup]);
  const [state, setState] = useState<FirstLetterState>(initialFirstLetter);
  const [round, setRound] = useState(0);
  const { finished, finish, reset } = useScoredGame(setup.mem.id);
  const total = tokenized.all.length;

  const onType = (text: string) => {
    const step = typeLetter(state, text, tokenized.all);
    if (!step) return;
    if (!step.correct)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setState(step.state);
    if (isFinished(step.state, total)) {
      finish(
        makeResult(
          'first-letter',
          accuracyOf(step.state),
          setup.selectionWords,
          setup.totalWords,
          setup.range,
        ),
      );
    }
  };

  if (finished) {
    return (
      <ResultView
        result={finished.result}
        outcome={finished.outcome}
        onPlayAgain={() => {
          reset();
          setState(initialFirstLetter);
          setRound((r) => r + 1);
        }}
      />
    );
  }

  const currentLine = Math.max(
    0,
    tokenized.lines.findIndex((l) => state.index < l.start + l.tokens.length),
  );
  const window = tokenized.lines.slice(Math.max(0, currentLine - 2), currentLine + 7);

  return (
    <View style={{ gap: spacing.lg }}>
      <AppText muted>{t('firstLetter.help')}</AppText>
      <TextInput
        key={round}
        testID="first-letter-input"
        autoFocus
        value=""
        onChangeText={onType}
        placeholder={t('firstLetter.placeholder')}
        placeholderTextColor={palette.muted}
        autoCorrect={false}
        spellCheck={false}
        autoCapitalize="none"
        autoComplete="off"
        importantForAutofill="no"
        maxLength={2}
        style={{
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: 12,
          padding: spacing.md,
          minHeight: 52,
          fontSize: 20 * fontScale,
          color: palette.text,
          backgroundColor: palette.surface,
          textAlign: 'center',
        }}
      />
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        {t('firstLetter.progress', { done: state.index, total })}
      </AppText>
      <Card>
        <MaskedLines
          lines={window}
          lang={setup.lang}
          state={(i) => {
            if (i < state.index) return state.marks[i] === 'ok' ? 'ok' : 'wrong';
            return i === state.index ? 'currentHidden' : 'hidden';
          }}
        />
      </Card>
    </View>
  );
}

export default function FirstLetter() {
  const { t } = useTranslation();
  return (
    <GameGate title={t('games.first-letter.name')}>{(setup) => <Body setup={setup} />}</GameGate>
  );
}
