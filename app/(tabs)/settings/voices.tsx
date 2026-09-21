import type { Voice } from 'expo-speech';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { spacing, useTheme } from '../../../src/components/theme';
import { AppText, Button, Card, Chip, Row, Screen } from '../../../src/components/ui';
import { LANGUAGES } from '../../../src/features/settings/defaults';
import {
  speakAsync,
  stopSpeaking,
  voicesFor,
  openTtsSettings,
} from '../../../src/features/speech/tts';
import { useAppDispatch, useAppSelector } from '../../../src/store';
import { updateSettings } from '../../../src/store/settingsSlice';

export default function VoicesScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const dispatch = useAppDispatch();
  const settings = useAppSelector((s) => s.settings.values);
  const [lang, setLang] = useState<string>(settings.default_language);
  const [loaded, setLoaded] = useState<{ lang: string; list: Voice[] } | null>(null);
  // Voices belong to the language they were loaded for; show "loading" while a new one loads.
  const voices = loaded?.lang === lang ? loaded.list : null;

  const load = useCallback(async () => {
    const list = await voicesFor(lang);
    setLoaded({ lang, list });
  }, [lang]);
  useEffect(() => {
    let live = true;
    voicesFor(lang).then((list) => {
      if (live) setLoaded({ lang, list });
    });
    return () => {
      live = false;
      stopSpeaking();
    };
  }, [lang]);

  const chosen = settings.default_voice[lang] ?? null;
  const choose = (identifier: string | null) => {
    const next = { ...settings.default_voice };
    if (identifier) next[lang] = identifier;
    else delete next[lang];
    dispatch(updateSettings({ default_voice: next }));
  };

  return (
    <Screen>
      <AppText muted>{t('voices.help')}</AppText>
      <Row style={{ flexWrap: 'wrap' }}>
        {LANGUAGES.map((l) => (
          <Chip
            key={l.code}
            label={l.name}
            selected={lang === l.code}
            onPress={() => setLang(l.code)}
          />
        ))}
      </Row>

      <Card style={chosen === null ? { borderColor: palette.primary } : undefined}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <AppText variant="label">{t('voices.systemDefault')}</AppText>
            <AppText variant="caption" muted>
              {t('voices.systemDefaultHelp')}
            </AppText>
          </View>
          <Button
            variant={chosen === null ? 'primary' : 'secondary'}
            label={chosen === null ? t('voices.selected') : t('voices.use')}
            onPress={() => choose(null)}
          />
        </Row>
      </Card>

      {voices === null ? <AppText muted>{t('common.loading')}</AppText> : null}
      {voices?.map((v) => (
        <Card
          key={v.identifier}
          style={chosen === v.identifier ? { borderColor: palette.primary } : undefined}
        >
          <AppText variant="label">{v.name}</AppText>
          <AppText variant="caption" muted>
            {v.language}
            {v.quality === 'Enhanced' ? ` · ${t('voices.enhanced')}` : ''}
          </AppText>
          <Row style={{ flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              label={t('scene.test')}
              onPress={() => {
                stopSpeaking();
                speakAsync(t('voices.sample'), {
                  lang,
                  rate: settings.speech_rate,
                  voice: v.identifier,
                });
              }}
            />
            <Button
              variant={chosen === v.identifier ? 'primary' : 'secondary'}
              label={chosen === v.identifier ? t('voices.selected') : t('voices.use')}
              onPress={() => choose(v.identifier)}
            />
          </Row>
        </Card>
      ))}

      {voices?.length === 0 ? (
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="heading">{t('voices.noneTitle')}</AppText>
          <AppText>{t('voices.noneBody')}</AppText>
          <Button label={t('speechIssue.openTtsSettings')} onPress={() => openTtsSettings()} />
          <Button variant="secondary" label={t('voices.refresh')} onPress={load} />
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" muted>
            {t('voices.downloadHelp')}
          </AppText>
          <Button
            variant="ghost"
            label={t('speechIssue.openTtsSettings')}
            onPress={() => openTtsSettings()}
          />
        </View>
      )}
    </Screen>
  );
}
