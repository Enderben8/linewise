import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { Confetti } from '../../src/components/Confetti';
import { Mascot } from '../../src/components/Mascot';
import { spacing, useTheme } from '../../src/components/theme';
import { AppText, Button, Card, Screen } from '../../src/components/ui';
import { parseBody } from '../../src/engine';
import {
  accuracyOf,
  initialFirstLetter,
  isFinished,
  typeLetters,
} from '../../src/games/firstLetter';
import { MaskedLines } from '../../src/games/MaskedLines';
import { buildUnits } from '../../src/games/setup';
import { tokenizeUnits } from '../../src/games/tokens';
import { useAppDispatch } from '../../src/store';
import { addMemorization } from '../../src/store/memorizationsSlice';
import { updateSettings } from '../../src/store/settingsSlice';

/** Public domain (Jane Taylor, 1806). */
const SAMPLE = {
  title: 'Twinkle, Twinkle, Little Star',
  author: 'Jane Taylor',
  body: 'Twinkle, twinkle, little star,\nHow I wonder what you are!\nUp above the world so high,\nLike a diamond in the sky.',
};

export default function Demo() {
  const { t } = useTranslation();
  const { palette, fontScale } = useTheme();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { goal } = useLocalSearchParams<{ goal?: string }>();
  const units = useMemo(
    () => buildUnits(parseBody(SAMPLE.body, 'text'), { mode: 'all', from: 0, to: 0 }),
    [],
  );
  const tokenized = useMemo(() => tokenizeUnits(units, 'en'), [units]);
  const [state, setState] = useState(initialFirstLetter);
  const total = tokenized.all.length;
  const done = isFinished(state, total);

  const onType = (text: string) => {
    const step = typeLetters(state, text, tokenized.all);
    if (!step) return;
    if (step.anyWrong)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setState(step.state);
  };

  const finish = (save: boolean) => {
    if (save) {
      dispatch(
        addMemorization({
          ...SAMPLE,
          language: 'en',
          type: 'text',
          tags: goal && goal !== 'other' ? [goal] : [],
        }),
      );
    }
    dispatch(updateSettings({ onboarding_done: true }));
    router.replace('/(tabs)/memorizations');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <AppText variant="title">{t('demo.title')}</AppText>
      <AppText muted>{done ? t('demo.doneBody') : t('demo.help')}</AppText>

      {!done ? (
        <TextInput
          testID="demo-input"
          autoFocus
          value=""
          onChangeText={onType}
          placeholder={t('firstLetter.placeholder')}
          placeholderTextColor={palette.muted}
          autoCorrect={false}
          spellCheck={false}
          autoCapitalize="none"
          maxLength={40}
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
      ) : null}

      <Card>
        <MaskedLines
          lines={tokenized.lines}
          lang="en"
          state={(i) => {
            if (i < state.index) return state.marks[i] === 'ok' ? 'ok' : 'wrong';
            return i === state.index ? 'currentHidden' : 'hidden';
          }}
        />
      </Card>

      {done ? (
        <View style={{ gap: spacing.md, alignItems: 'center' }}>
          <Mascot mood="cheer" size={120} />
          <AppText variant="heading">
            {t('demo.score', { percent: Math.round(accuracyOf(state) * 100) })}
          </AppText>
          <Button
            style={{ alignSelf: 'stretch' }}
            testID="demo-save"
            label={t('demo.save')}
            onPress={() => finish(true)}
          />
          <Button
            style={{ alignSelf: 'stretch' }}
            variant="secondary"
            testID="demo-skip"
            label={t('demo.skip')}
            onPress={() => finish(false)}
          />
          <Confetti />
        </View>
      ) : (
        <Button variant="ghost" label={t('demo.skipDemo')} onPress={() => finish(false)} />
      )}
    </Screen>
  );
}
