import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { spacing } from '../../../../src/components/theme';
import { AppText, Button, Card, Row } from '../../../../src/components/ui';
import { setHiddenWords } from '../../../../src/db/repo';
import { allKeys, autoHide, blankOptions, keyedLines } from '../../../../src/games/fillBlank';
import { GameGate } from '../../../../src/games/GameGate';
import { makeResult } from '../../../../src/games/ids';
import { MaskedLines } from '../../../../src/games/MaskedLines';
import { ResultView } from '../../../../src/games/ResultView';
import type { GameSetup } from '../../../../src/games/useGameSetup';
import { useScoredGame } from '../../../../src/games/useScoredGame';
import { useAppDispatch } from '../../../../src/store';
import { reloadMemorizations } from '../../../../src/store/memorizationsSlice';

type Phase = 'choose' | 'play';

function Body({ setup }: { setup: GameSetup }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const lines = useMemo(() => keyedLines(setup.mem.chunks, setup.selection, setup.lang), [setup]);
  const keys = useMemo(() => allKeys(lines), [lines]);
  const keyIndex = useMemo(() => new Map(keys.map((k, i) => [k, i])), [keys]);
  const tokens = useMemo(() => lines.flatMap((l) => l.tokens), [lines]);
  const pool = useMemo(
    () =>
      keyedLines(setup.mem.chunks, { mode: 'all', from: 0, to: 0 }, setup.lang).flatMap((l) =>
        l.tokens.map((x) => x.text),
      ),
    [setup],
  );

  const [phase, setPhase] = useState<Phase>('choose');
  const [hidden, setHidden] = useState<Set<string>>(() => {
    const saved = setup.mem.progress.hiddenWords.filter((k) => keyIndex.has(k));
    return new Set(saved.length ? saved : autoHide(keys, 25, 7));
  });
  const [answers, setAnswers] = useState<('ok' | 'wrong')[]>([]);
  const [round, setRound] = useState(0);
  const { finished, finish, reset } = useScoredGame(setup.mem.id);

  const blanks = useMemo(() => keys.filter((k) => hidden.has(k)), [keys, hidden]);
  const current = blanks[answers.length];
  const currentIdx = current ? (keyIndex.get(current) as number) : -1;
  const answered = new Map(blanks.map((k, i) => [keyIndex.get(k) as number, answers[i]]));

  const options = useMemo(
    () =>
      current
        ? blankOptions(tokens[currentIdx].text, pool, 1000 + answers.length * 31 + round)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, round],
  );

  const toggle = (index: number) => {
    const key = keys[index];
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const start = () => {
    // Keep choices for words outside this selection, replace those inside it.
    const outside = setup.mem.progress.hiddenWords.filter((k) => !keyIndex.has(k));
    setHiddenWords(setup.mem.id, [...outside, ...blanks]);
    dispatch(reloadMemorizations());
    setAnswers([]);
    setPhase('play');
  };

  const isCorrect = (option: string) =>
    option.toLowerCase() ===
    tokens[currentIdx].text.replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '').toLowerCase();

  const answer = (option: string) => {
    if (!current) return;
    const ok = isCorrect(option);
    if (!ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    const next = [...answers, ok ? ('ok' as const) : ('wrong' as const)];
    setAnswers(next);
    if (next.length === blanks.length) {
      const correct = next.filter((a) => a === 'ok').length;
      finish(
        makeResult(
          'fill-in-the-blank',
          correct / blanks.length,
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
          setAnswers([]);
          setRound((r) => r + 1);
          setPhase('choose');
        }}
      />
    );
  }

  if (phase === 'choose') {
    return (
      <View style={{ gap: spacing.lg }}>
        <AppText muted>{t('fill.chooseHelp')}</AppText>
        <Row style={{ flexWrap: 'wrap' }}>
          {[15, 25, 50].map((p) => (
            <Button
              key={p}
              variant="secondary"
              label={t('fill.auto', { percent: p })}
              onPress={() => setHidden(new Set(autoHide(keys, p, Math.floor(Math.random() * 1e6))))}
            />
          ))}
          <Button variant="ghost" label={t('fill.clear')} onPress={() => setHidden(new Set())} />
        </Row>
        <Card>
          <MaskedLines
            lines={lines}
            lang={setup.lang}
            state={(i) => (hidden.has(keys[i]) ? 'hidden' : 'shown')}
            onPressWord={toggle}
          />
        </Card>
        <AppText variant="caption" muted>
          {t('fill.count', { count: blanks.length })}
        </AppText>
        <Button
          testID="fill-start"
          label={t('fill.start')}
          onPress={start}
          disabled={blanks.length === 0}
        />
      </View>
    );
  }

  const currentLine = Math.max(
    0,
    lines.findIndex((l) => currentIdx < l.start + l.tokens.length),
  );
  return (
    <View style={{ gap: spacing.lg }}>
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        {t('fill.progress', { done: answers.length, total: blanks.length })}
      </AppText>
      <Card>
        <MaskedLines
          lines={lines.slice(Math.max(0, currentLine - 2), currentLine + 6)}
          lang={setup.lang}
          state={(i) => {
            const a = answered.get(i);
            if (a === 'ok') return 'ok';
            if (a === 'wrong') return 'wrong';
            if (i === currentIdx) return 'currentHidden';
            return hidden.has(keys[i]) ? 'hidden' : 'shown';
          }}
        />
      </Card>
      <View style={{ gap: spacing.sm }}>
        {options.map((o) => (
          <Button
            key={o}
            testID={`option-${o}`}
            variant="secondary"
            label={o}
            onPress={() => answer(o)}
          />
        ))}
      </View>
    </View>
  );
}

export default function FillInTheBlank() {
  const { t } = useTranslation();
  return (
    <GameGate title={t('games.fill-in-the-blank.name')}>
      {(setup) => <Body setup={setup} />}
    </GameGate>
  );
}
