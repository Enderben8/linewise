import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, useTheme } from '../../../../src/components/theme';
import { AppText, Button, EmptyState } from '../../../../src/components/ui';
import { GameGate } from '../../../../src/games/GameGate';
import { makeResult } from '../../../../src/games/ids';
import { ResultView } from '../../../../src/games/ResultView';
import {
  buildRounds,
  correctPositions,
  scrambleItems,
  scrambleOrder,
} from '../../../../src/games/scramble';
import type { GameSetup } from '../../../../src/games/useGameSetup';
import { useScoredGame } from '../../../../src/games/useScoredGame';

interface Item {
  /** Index in the correct order within the round. */
  id: number;
  text: string;
}

function makeRound(texts: string[]): Item[] {
  return scrambleOrder(texts).map((id) => ({ id, text: texts[id] }));
}

function Body({ setup }: { setup: GameSetup }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const rounds = useMemo(() => buildRounds(scrambleItems(setup.units)), [setup]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [items, setItems] = useState<Item[]>(() => (rounds[0] ? makeRound(rounds[0]) : []));
  const [checked, setChecked] = useState(false);
  const [tally, setTally] = useState({ correct: 0, total: 0 });
  const { finished, finish, reset } = useScoredGame(setup.mem.id);

  const restart = () => {
    reset();
    setRoundIndex(0);
    setItems(rounds[0] ? makeRound(rounds[0]) : []);
    setChecked(false);
    setTally({ correct: 0, total: 0 });
  };

  if (finished) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <ResultView result={finished.result} outcome={finished.outcome} onPlayAgain={restart} />
      </ScrollView>
    );
  }
  if (rounds.length === 0 || (rounds[0] ?? []).length < 2) {
    return <EmptyState title={t('scramble.tooShort')} body={t('scramble.tooShortBody')} />;
  }

  const round = rounds[roundIndex];
  const correctNow = correctPositions(
    items.map((i) => i.id),
    round,
  );

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (checked || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };

  const check = () => setChecked(true);
  const next = () => {
    const nextTally = { correct: tally.correct + correctNow, total: tally.total + items.length };
    if (roundIndex + 1 < rounds.length) {
      setTally(nextTally);
      setRoundIndex(roundIndex + 1);
      setItems(makeRound(rounds[roundIndex + 1]));
      setChecked(false);
    } else {
      setTally(nextTally);
      finish(
        makeResult(
          'sentence-scramble',
          nextTally.correct / nextTally.total,
          setup.selectionWords,
          setup.totalWords,
          setup.range,
        ),
      );
    }
  };

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<Item>) => {
    const index = getIndex() ?? 0;
    // A repeated sentence is right in either of its places.
    const right = checked && item.text === round[index];
    const wrong = checked && !right;
    return (
      <ScaleDecorator>
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginBottom: spacing.sm,
            padding: spacing.md,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: right
              ? palette.success
              : wrong
                ? palette.danger
                : isActive
                  ? palette.accent
                  : palette.border,
            backgroundColor: palette.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <Pressable
            onPressIn={checked ? undefined : drag}
            accessibilityLabel={t('scramble.drag')}
            hitSlop={8}
          >
            <Ionicons name="reorder-three" size={28} color={palette.muted} />
          </Pressable>
          <AppText style={{ flex: 1 }}>{item.text}</AppText>
          {!checked ? (
            <View>
              <Pressable
                onPress={() => move(index, -1)}
                accessibilityLabel={t('scramble.up')}
                hitSlop={6}
              >
                <Ionicons name="chevron-up" size={20} color={palette.muted} />
              </Pressable>
              <Pressable
                onPress={() => move(index, 1)}
                accessibilityLabel={t('scramble.down')}
                hitSlop={6}
              >
                <Ionicons name="chevron-down" size={20} color={palette.muted} />
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, paddingBottom: insets.bottom }}>
      <DraggableFlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        onDragEnd={({ data }) => setItems(data)}
        renderItem={renderItem}
        activationDistance={12}
        ListHeaderComponent={
          <View style={{ padding: spacing.lg, gap: spacing.xs }}>
            <AppText muted>{t('scramble.help')}</AppText>
            <AppText variant="caption" muted>
              {t('scramble.round', { n: roundIndex + 1, total: rounds.length })}
            </AppText>
          </View>
        }
        ListFooterComponent={
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            {checked ? (
              <>
                <AppText variant="label" style={{ textAlign: 'center' }}>
                  {t('scramble.score', { correct: correctNow, total: items.length })}
                </AppText>
                {correctNow < items.length ? (
                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="caption" muted>
                      {t('scramble.correctOrder')}
                    </AppText>
                    {round.map((text, i) => (
                      <AppText key={i} variant="caption">
                        {i + 1}. {text}
                      </AppText>
                    ))}
                  </View>
                ) : null}
                <Button
                  testID="scramble-next"
                  label={roundIndex + 1 < rounds.length ? t('scramble.next') : t('scramble.finish')}
                  onPress={next}
                />
              </>
            ) : (
              <Button testID="scramble-done" label={t('scramble.done')} onPress={check} />
            )}
          </View>
        }
      />
    </View>
  );
}

export default function SentenceScramble() {
  const { t } = useTranslation();
  return (
    <GameGate title={t('games.sentence-scramble.name')} scroll={false}>
      {(setup) => <Body setup={setup} />}
    </GameGate>
  );
}
