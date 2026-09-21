import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking } from 'react-native';
import { AppText, Button, Card } from '../../components/ui';
import { checkSpeechReady, downloadLanguagePack, type SpeechProblem } from './recognition';
import { checkTts, openTtsSettings } from './tts';

export type SpeechIssue = SpeechProblem | 'no-voice';

/**
 * Runs the checks a speech game needs before it starts (microphone, recogniser, on-device pack,
 * text-to-speech voice) and offers what to do when one fails.
 */
export function useSpeechGate(
  lang: string,
  opts: { needsRecognition: boolean; needsTts: boolean },
) {
  const [issue, setIssue] = useState<SpeechIssue | null>(null);
  const [checking, setChecking] = useState(false);
  const { needsRecognition, needsTts } = opts;

  /** Returns true when everything needed is ready. */
  const check = useCallback(async (): Promise<boolean> => {
    setChecking(true);
    try {
      if (needsTts) {
        const tts = await checkTts(lang);
        if (!tts.ok) {
          setIssue('no-voice');
          return false;
        }
      }
      if (needsRecognition) {
        const res = await checkSpeechReady(lang);
        if (!res.ok) {
          setIssue(res.reason);
          return false;
        }
      }
      setIssue(null);
      return true;
    } catch {
      setIssue('unavailable');
      return false;
    } finally {
      setChecking(false);
    }
  }, [lang, needsRecognition, needsTts]);

  return { issue, checking, check, clear: () => setIssue(null) };
}

export function SpeechIssueCard({
  issue,
  lang,
  onRetry,
}: {
  issue: SpeechIssue;
  lang: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <AppText variant="heading">{t(`speechIssue.${issue}.title`)}</AppText>
      <AppText>{t(`speechIssue.${issue}.body`)}</AppText>
      {issue === 'permission-blocked' ? (
        <Button label={t('speechIssue.openSettings')} onPress={() => Linking.openSettings()} />
      ) : null}
      {issue === 'language-missing' ? (
        <Button
          label={t('speechIssue.downloadPack')}
          onPress={async () =>
            Alert.alert(t('speechIssue.downloadPack'), await downloadLanguagePack(lang))
          }
        />
      ) : null}
      {issue === 'no-voice' ? (
        <Button label={t('speechIssue.openTtsSettings')} onPress={() => openTtsSettings()} />
      ) : null}
      <Button variant="secondary" label={t('speechIssue.retry')} onPress={onRetry} />
    </Card>
  );
}
