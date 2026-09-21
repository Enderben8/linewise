import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sameLanguage, speechLocale } from './locales';

export type SpeechProblem =
  'permission' | 'permission-blocked' | 'unavailable' | 'no-on-device' | 'language-missing';

export type SpeechCheck = { ok: true } | { ok: false; reason: SpeechProblem };

/**
 * Everything a speech game needs before it starts: microphone permission,
 * a recogniser on the phone, on-device support and the language pack.
 */
export async function checkSpeechReady(lang: string): Promise<SpeechCheck> {
  const module = ExpoSpeechRecognitionModule;
  let perm = await module.getPermissionsAsync();
  if (!perm.granted) {
    if (!perm.canAskAgain) return { ok: false, reason: 'permission-blocked' };
    perm = await module.requestPermissionsAsync();
    if (!perm.granted) {
      return { ok: false, reason: perm.canAskAgain ? 'permission' : 'permission-blocked' };
    }
  }
  if (!module.isRecognitionAvailable()) return { ok: false, reason: 'unavailable' };
  if (!module.supportsOnDeviceRecognition()) return { ok: false, reason: 'no-on-device' };
  try {
    const { installedLocales } = await module.getSupportedLocales({});
    if (installedLocales.length > 0 && !installedLocales.some((l) => sameLanguage(l, lang))) {
      return { ok: false, reason: 'language-missing' };
    }
  } catch {
    // Older Android versions cannot list installed packs; start and let the engine report errors.
  }
  return { ok: true };
}

/** Asks Android to download the offline speech pack for the language. */
export async function downloadLanguagePack(lang: string): Promise<string> {
  try {
    const res = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
      locale: speechLocale(lang),
    });
    return res.message;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export interface RecognizerState {
  listening: boolean;
  /** Final and in-progress text so far. */
  transcript: string;
  error: string | null;
}

/**
 * Maps an error the speech engine reports while listening to something the user can fix.
 * Returns null for errors that are just a bad take (no speech, aborted...).
 */
export function issueFromError(code: string | null): SpeechProblem | null {
  switch (code) {
    case 'language-not-supported':
      return 'language-missing';
    case 'not-allowed':
      return 'permission-blocked';
    case 'service-not-allowed':
      return 'unavailable';
    case 'network':
      return 'no-on-device';
    default:
      return null;
  }
}

export interface RecognizerOptions {
  lang: string;
  continuous: boolean;
  onEnd?: (transcript: string) => void;
  onError?: (code: string) => void;
}

/** Wraps expo-speech-recognition: accumulates final results and reports the full transcript when it stops. */
export function useRecognizer({ lang, continuous, onEnd, onError }: RecognizerOptions) {
  const [state, setState] = useState<RecognizerState>({
    listening: false,
    transcript: '',
    error: null,
  });
  const finals = useRef<string[]>([]);
  const interim = useRef('');
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onEndRef.current = onEnd;
    onErrorRef.current = onError;
  }, [onEnd, onError]);

  // Leaving the screen aborts listening without scoring a half-finished attempt.
  useEffect(
    () => () => {
      onEndRef.current = undefined;
      ExpoSpeechRecognitionModule.abort();
    },
    [],
  );

  const full = () => [...finals.current, interim.current].filter(Boolean).join(' ').trim();

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      if (text) finals.current.push(text);
      interim.current = '';
    } else {
      interim.current = text;
    }
    setState((s) => ({ ...s, transcript: full() }));
  });
  useSpeechRecognitionEvent('error', (event) => {
    setState((s) => ({ ...s, error: event.error }));
    onErrorRef.current?.(event.error);
  });
  useSpeechRecognitionEvent('end', () => {
    const transcript = full();
    setState((s) => ({ ...s, listening: false, transcript }));
    onEndRef.current?.(transcript);
  });

  const start = useCallback(
    (contextualStrings?: string[]) => {
      finals.current = [];
      interim.current = '';
      setState({ listening: true, transcript: '', error: null });
      ExpoSpeechRecognitionModule.start({
        lang: speechLocale(lang),
        interimResults: true,
        continuous,
        maxAlternatives: 1,
        requiresOnDeviceRecognition: true,
        addsPunctuation: false,
        contextualStrings,
      });
    },
    [lang, continuous],
  );

  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);
  const abort = useCallback(() => ExpoSpeechRecognitionModule.abort(), []);

  return { ...state, issue: issueFromError(state.error), start, stop, abort };
}
