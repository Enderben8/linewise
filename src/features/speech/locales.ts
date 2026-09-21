/** BCP 47 tags the Android speech engines understand, for each Linewise text language. */
const TAGS: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  fil: 'fil-PH',
  'pt-BR': 'pt-BR',
  nl: 'nl-NL',
  hi: 'hi-IN',
  ar: 'ar-SA',
  'zh-Hans': 'zh-CN',
  he: 'he-IL',
};

export function speechLocale(lang: string): string {
  return TAGS[lang] ?? lang;
}

/** True when a voice/locale tag belongs to the same language as `lang` (en-GB matches en). */
export function sameLanguage(tag: string, lang: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace('_', '-');
  const a = norm(tag);
  const b = norm(speechLocale(lang));
  if (a === b) return true;
  const baseA = a.split('-')[0];
  const baseB = b.split('-')[0];
  // Android reports Filipino as "fil" or the older "tl"; Hebrew as "he" or "iw".
  const alias = (x: string) => (x === 'tl' ? 'fil' : x === 'iw' ? 'he' : x === 'in' ? 'id' : x);
  return alias(baseA) === alias(baseB);
}

/** The user's chosen device voice for a text language, or null to use the system default. */
export function defaultVoiceFor(
  voices: Record<string, string> | null | undefined,
  lang: string,
): string | null {
  return voices?.[lang] ?? null;
}
