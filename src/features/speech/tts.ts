import * as IntentLauncher from 'expo-intent-launcher';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { sameLanguage, speechLocale } from './locales';

export type TtsCheck = { ok: true; voices: Speech.Voice[] } | { ok: false; reason: 'no-voice' };

export async function voicesFor(lang: string): Promise<Speech.Voice[]> {
  try {
    const all = await Speech.getAvailableVoicesAsync();
    return all
      .filter((v) => sameLanguage(v.language, lang))
      .sort((a, b) => a.language.localeCompare(b.language) || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** Text to speech is usable when the device has at least one voice for the language. */
export async function checkTts(lang: string): Promise<TtsCheck> {
  const voices = await voicesFor(lang);
  return voices.length > 0 ? { ok: true, voices } : { ok: false, reason: 'no-voice' };
}

/** Opens the Android "Text-to-speech output" settings, where voice data can be downloaded. */
export async function openTtsSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync('com.android.settings.TTS_SETTINGS');
  } catch {
    await IntentLauncher.startActivityAsync('android.settings.SETTINGS');
  }
}

export interface SpeakOptions {
  lang: string;
  rate: number;
  voice?: string | null;
  /** 0.5 to 2. Used to tell roles apart when they share a voice. */
  pitch?: number;
}

/** Speaks one piece of text and resolves when it ends (or is stopped). */
export function speakAsync(text: string, opts: SpeakOptions): Promise<void> {
  return new Promise((resolve) => {
    Speech.speak(text, {
      language: speechLocale(opts.lang),
      rate: opts.rate,
      voice: opts.voice ?? undefined,
      pitch: opts.pitch,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: () => resolve(),
    });
  });
}

export function stopSpeaking(): void {
  Speech.stop().catch(() => {});
}
