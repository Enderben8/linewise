import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Confetti } from '../components/Confetti';
import { Mascot, type MascotMood } from '../components/Mascot';
import { spacing, useTheme } from '../components/theme';
import { AppText, Button, Card, Row } from '../components/ui';
import { SCHEDULER_CONFIG } from '../config';
import type { ApplyOutcome } from '../scheduler';
import type { SessionResult } from './ids';

interface Props {
  result: SessionResult;
  outcome: ApplyOutcome | null;
  onPlayAgain: () => void;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Score summary shown when a scored game ends: mascot, confetti for a good run, and what it did to the review plan. */
export function ResultView({ result, outcome, onPlayAgain }: Props) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { palette } = useTheme();
  const passed = result.weightedScore >= SCHEDULER_CONFIG.passMark;
  const celebrate = passed || result.accuracy >= 0.9;
  const mood: MascotMood = celebrate ? 'cheer' : result.accuracy >= 0.5 ? 'happy' : 'sad';

  let reviewLine = t('result.practiceOnly');
  if (outcome?.counted) {
    if (outcome.advanced) {
      const at = outcome.state.nextReviewAt;
      reviewLine =
        at === null
          ? t('result.planDone')
          : t('result.advanced', {
              date: new Date(at).toLocaleDateString(i18n.language, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }),
            });
    } else {
      reviewLine = t('result.retry', { pass: Math.round(SCHEDULER_CONFIG.passMark * 100) });
    }
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Mascot mood={mood} size={140} />
        <AppText variant="title" testID="result-score">
          {pct(result.weightedScore)}
        </AppText>
        <AppText muted style={{ textAlign: 'center' }}>
          {celebrate ? t('result.great') : t('result.keepGoing')}
        </AppText>
      </View>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText>{t('result.accuracy')}</AppText>
          <AppText variant="label">{pct(result.accuracy)}</AppText>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText>{t('result.coverage')}</AppText>
          <AppText variant="label">{pct(result.coverage)}</AppText>
        </Row>
        <AppText variant="caption" muted>
          {t('result.weightedHelp')}
        </AppText>
      </Card>
      <Card style={{ borderColor: outcome?.advanced ? palette.success : palette.border }}>
        <AppText>{reviewLine}</AppText>
      </Card>
      <Button testID="play-again" label={t('result.playAgain')} onPress={onPlayAgain} />
      <Button label={t('result.backToText')} variant="secondary" onPress={() => router.back()} />
      {celebrate ? <Confetti /> : null}
    </View>
  );
}
