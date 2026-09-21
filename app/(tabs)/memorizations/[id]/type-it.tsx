import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { spacing } from '../../../../src/components/theme';
import { AppText, Button, Field } from '../../../../src/components/ui';
import { align, scoreAlignment, words, type AlignItem } from '../../../../src/engine';
import { DiffView } from '../../../../src/games/DiffView';
import { GameGate } from '../../../../src/games/GameGate';
import { makeResult } from '../../../../src/games/ids';
import { ResultView } from '../../../../src/games/ResultView';
import { unitsText } from '../../../../src/games/setup';
import type { GameSetup } from '../../../../src/games/useGameSetup';
import { useScoredGame } from '../../../../src/games/useScoredGame';

function Body({ setup }: { setup: GameSetup }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [diff, setDiff] = useState<AlignItem[]>([]);
  const [round, setRound] = useState(0);
  const { finished, finish, reset } = useScoredGame(setup.mem.id);

  const submit = () => {
    const items = align(words(unitsText(setup.units), setup.lang), words(text, setup.lang));
    setDiff(items);
    const { accuracy } = scoreAlignment(items);
    finish(makeResult('type-it', accuracy, setup.selectionWords, setup.totalWords, setup.range));
  };

  if (finished) {
    return (
      <View style={{ gap: spacing.lg }}>
        <ResultView
          result={finished.result}
          outcome={finished.outcome}
          onPlayAgain={() => {
            reset();
            setText('');
            setDiff([]);
            setRound((r) => r + 1);
          }}
        />
        <AppText variant="heading">{t('typeIt.review')}</AppText>
        <DiffView items={diff} lang={setup.lang} />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <AppText muted>{t('typeIt.help', { count: setup.selectionWords })}</AppText>
      <Field
        key={round}
        testID="type-it-input"
        value={text}
        onChangeText={setText}
        multiline
        textAlignVertical="top"
        autoCorrect={false}
        spellCheck={false}
        autoCapitalize="none"
        placeholder={t('typeIt.placeholder')}
        style={{ minHeight: 260 }}
      />
      <Button
        testID="type-it-done"
        label={t('typeIt.done')}
        onPress={submit}
        disabled={!text.trim()}
      />
    </View>
  );
}

export default function TypeIt() {
  const { t } = useTranslation();
  return <GameGate title={t('games.type-it.name')}>{(setup) => <Body setup={setup} />}</GameGate>;
}
