import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { spacing, useTheme } from '../../../src/components/theme';
import { AppText, Button, Chip, Field, Row, Screen } from '../../../src/components/ui';
import { TESSERACT_LANG } from '../../../src/features/ocr/text';
import { LANGUAGES } from '../../../src/features/settings/defaults';
import { pickBrowserFile } from '../../../src/lib/browserFiles.web';
import { useAppDispatch, useAppSelector } from '../../../src/store';
import { draftActions } from '../../../src/store/draftSlice';

/**
 * Web version of scanning: ML Kit is Android only, so the browser runs Tesseract.js instead.
 * Every file it needs is served from this site under /ocr (see scripts/copy-ocr-assets.js), so
 * nothing is downloaded from anywhere else and the page's Content-Security-Policy would block it anyway.
 */
async function recognise(image: File, lang: string): Promise<string> {
  const { createWorker, OEM } = await import('tesseract.js');
  const base = `${window.location.origin}/ocr`;
  const worker = await createWorker(TESSERACT_LANG[lang], OEM.LSTM_ONLY, {
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}/core`,
    langPath: `${base}/lang`,
    workerBlobURL: false,
    gzip: true,
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } finally {
    await worker.terminate();
  }
}

const SCANNABLE = LANGUAGES.filter((l) => TESSERACT_LANG[l.code]);

export default function CameraRecognitionWeb() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const defaultLanguage = useAppSelector((s) => s.settings.values.default_language);
  const [lang, setLang] = useState(TESSERACT_LANG[defaultLanguage] ? defaultLanguage : 'en');
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = async (capture?: 'environment') => {
    const file = await pickBrowserFile('image/*', capture);
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const out = await recognise(file, lang);
      if (!out) setError(t('camera.nothingFound'));
      else setText(out);
    } catch (e) {
      setError(t('camera.failed', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  if (text !== null) {
    return (
      <Screen>
        <AppText muted>{t('camera.reviewHelp')}</AppText>
        <Field
          testID="ocr-text"
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          style={{ minHeight: 260 }}
        />
        <Button
          testID="ocr-use"
          label={t('camera.use')}
          onPress={() => {
            dispatch(draftActions.setDraft({ body: text.trim() }));
            router.replace('/add/edit-text');
          }}
          disabled={!text.trim()}
        />
        <Button variant="secondary" label={t('camera.retake')} onPress={() => setText(null)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText muted>{t('camera.webHelp')}</AppText>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="label" muted>
          {t('editor.language')}
        </AppText>
        <Row style={{ flexWrap: 'wrap' }}>
          {SCANNABLE.map((l) => (
            <Chip
              key={l.code}
              label={l.name}
              selected={lang === l.code}
              onPress={() => setLang(l.code)}
            />
          ))}
        </Row>
        <AppText variant="caption" muted>
          {t('camera.unsupported')}
        </AppText>
      </View>

      {busy ? <AppText muted>{t('camera.loadingModel')}</AppText> : null}
      {error ? <AppText color={palette.danger}>{error}</AppText> : null}
      <Button
        testID="ocr-capture"
        label={t('camera.capture')}
        onPress={() => scan('environment')}
        loading={busy}
      />
      <Button
        testID="ocr-gallery"
        variant="secondary"
        label={t('camera.gallery')}
        onPress={() => scan()}
        disabled={busy}
      />
      <AppText variant="caption" muted>
        {t('camera.privacy')}
      </AppText>
    </Screen>
  );
}
