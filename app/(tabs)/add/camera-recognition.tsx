import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { spacing, useTheme } from '../../../src/components/theme';
import { AppText, Button, Chip, Field, Row, Screen } from '../../../src/components/ui';
import {
  OCR_SCRIPTS,
  blocksToText,
  ocrSupported,
  scriptForLanguage,
  type OcrScript,
} from '../../../src/features/ocr/text';
import { useAppDispatch, useAppSelector } from '../../../src/store';
import { draftActions } from '../../../src/store/draftSlice';

const SCRIPT_ENUM: Record<OcrScript, TextRecognitionScript> = {
  Latin: TextRecognitionScript.LATIN,
  Chinese: TextRecognitionScript.CHINESE,
  Devanagari: TextRecognitionScript.DEVANAGARI,
  Japanese: TextRecognitionScript.JAPANESE,
  Korean: TextRecognitionScript.KOREAN,
};

export default function CameraRecognition() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const defaultLanguage = useAppSelector((s) => s.settings.values.default_language);
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [script, setScript] = useState<OcrScript>(scriptForLanguage(defaultLanguage));
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recognise = async (uri: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await TextRecognition.recognize(uri, SCRIPT_ENUM[script]);
      const out = blocksToText(result.blocks);
      if (!out) setError(t('camera.nothingFound'));
      else setText(out);
    } catch (e) {
      setError(t('camera.failed', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    if (!camera.current || busy) return;
    const photo = await camera.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
    if (photo?.uri) await recognise(photo.uri);
  };

  const fromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!res.canceled && res.assets[0]) await recognise(res.assets[0].uri);
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
      <AppText muted>{t('camera.help')}</AppText>
      {!ocrSupported(defaultLanguage) ? (
        <AppText color={palette.warning}>{t('camera.unsupported')}</AppText>
      ) : null}
      <View style={{ gap: spacing.xs }}>
        <AppText variant="label" muted>
          {t('camera.script')}
        </AppText>
        <Row style={{ flexWrap: 'wrap' }}>
          {OCR_SCRIPTS.map((s) => (
            <Chip
              key={s}
              label={t(`camera.scripts.${s}`)}
              selected={script === s}
              onPress={() => setScript(s)}
            />
          ))}
        </Row>
      </View>

      {permission?.granted ? (
        <View style={{ height: 380, borderRadius: 16, overflow: 'hidden' }}>
          <CameraView ref={camera} style={{ flex: 1 }} facing="back" />
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <AppText>{t('camera.permissionBody')}</AppText>
          {permission && !permission.canAskAgain ? (
            <Button label={t('speechIssue.openSettings')} onPress={() => Linking.openSettings()} />
          ) : (
            <Button label={t('camera.allow')} onPress={requestPermission} />
          )}
        </View>
      )}

      {error ? <AppText color={palette.danger}>{error}</AppText> : null}
      {permission?.granted ? (
        <Button testID="ocr-capture" label={t('camera.capture')} onPress={capture} loading={busy} />
      ) : null}
      <Button
        testID="ocr-gallery"
        variant="secondary"
        label={t('camera.gallery')}
        onPress={fromGallery}
        disabled={busy}
      />
      <AppText variant="caption" muted>
        {t('camera.privacy')}
      </AppText>
    </Screen>
  );
}
