import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PercentSlider } from '../../../../src/components/PercentSlider';
import { spacing } from '../../../../src/components/theme';
import { AppText, Button, Card, Row } from '../../../../src/components/ui';
import { GameGate } from '../../../../src/games/GameGate';
import { MaskedLines } from '../../../../src/games/MaskedLines';
import { hiddenIndexes } from '../../../../src/games/setup';
import { tokenizeUnits } from '../../../../src/games/tokens';
import type { GameSetup } from '../../../../src/games/useGameSetup';

function Body({ setup }: { setup: GameSetup }) {
  const { t } = useTranslation();
  const [percent, setPercent] = useState(0);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [peeking, setPeeking] = useState<Set<number>>(new Set());
  const tokenized = useMemo(() => tokenizeUnits(setup.units, setup.lang), [setup]);
  const hidden = useMemo(
    () => hiddenIndexes(tokenized.all.length, percent, seed),
    [tokenized, percent, seed],
  );

  const change = (v: number) => {
    setPercent(Math.min(100, Math.max(0, v)));
    setPeeking(new Set());
  };
  const peek = (i: number) =>
    setPeeking((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="label">{t('slider.hidden')}</AppText>
          <AppText variant="heading" testID="slider-percent">
            {percent}%
          </AppText>
        </Row>
        <PercentSlider
          testID="slider"
          value={percent}
          onChange={change}
          label={t('slider.label')}
        />
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="caption" muted>
            {t('slider.guided')}
          </AppText>
          <AppText variant="caption" muted>
            {t('slider.recall')}
          </AppText>
        </Row>
        <Row style={{ flexWrap: 'wrap' }}>
          {[-10, 10].map((d) => (
            <Button
              key={d}
              variant="secondary"
              label={d > 0 ? '+10%' : '−10%'}
              onPress={() => change(percent + d)}
            />
          ))}
          <Button
            variant="ghost"
            label={t('slider.reshuffle')}
            onPress={() => setSeed(Math.floor(Math.random() * 1e6))}
          />
        </Row>
      </Card>
      <Card>
        <MaskedLines
          lines={tokenized.lines}
          lang={setup.lang}
          state={(i) => (hidden.has(i) && !peeking.has(i) ? 'hidden' : 'shown')}
          onPressWord={(i) => hidden.has(i) && peek(i)}
        />
      </Card>
      <AppText variant="caption" muted>
        {t('slider.tapHint')}
      </AppText>
    </View>
  );
}

export default function SliderGame() {
  const { t } = useTranslation();
  return <GameGate title={t('games.slider.name')}>{(setup) => <Body setup={setup} />}</GameGate>;
}
