/* eslint-disable import/no-named-as-default-member */
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { I18nManager, Platform } from 'react-native';
import { initReactI18next } from 'react-i18next';
import { isRtl, LANGUAGES } from '../features/settings/defaults';
import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fil from './locales/fil.json';
import fr from './locales/fr.json';
import he from './locales/he.json';
import hi from './locales/hi.json';
import nl from './locales/nl.json';
import ptBR from './locales/pt-BR.json';
import zhHans from './locales/zh-Hans.json';

export const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  fil: { translation: fil },
  'pt-BR': { translation: ptBR },
  nl: { translation: nl },
  hi: { translation: hi },
  ar: { translation: ar },
  'zh-Hans': { translation: zhHans },
  he: { translation: he },
} as const;

/** Maps a BCP 47 tag from the phone (pt-PT, zh-Hant-TW, iw, tl...) to one of our 11 languages. */
export function matchSupported(tag: string | undefined): string {
  if (!tag) return 'en';
  const lower = tag.toLowerCase();
  const exact = LANGUAGES.find((l) => l.code.toLowerCase() === lower);
  if (exact) return exact.code;
  const base = lower.split(/[-_]/)[0];
  if (base === 'tl' || base === 'fil') return 'fil';
  if (base === 'iw') return 'he';
  if (base === 'pt') return 'pt-BR';
  if (base === 'zh') return 'zh-Hans';
  return LANGUAGES.find((l) => l.code === base)?.code ?? 'en';
}

/** The language to use for a `locale` setting ('system' or a code). */
export function resolveLocale(setting: string): string {
  if (setting !== 'system' && LANGUAGES.some((l) => l.code === setting)) return setting;
  return matchSupported(getLocales()[0]?.languageTag);
}

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
  compatibilityJSON: 'v4',
});

/**
 * Switches the UI language. Android only applies a layout direction change after a restart,
 * so the return value says whether the user needs to reopen the app.
 */
export async function applyLocale(
  setting: string,
): Promise<{ code: string; needsRestart: boolean }> {
  const code = resolveLocale(setting);
  await i18n.changeLanguage(code);
  const wantRtl = isRtl(code);
  if (Platform.OS === 'web') {
    document.documentElement.lang = code;
    document.documentElement.dir = wantRtl ? 'rtl' : 'ltr';
    return { code, needsRestart: false };
  }
  I18nManager.allowRTL(true);
  let needsRestart = false;
  if (I18nManager.isRTL !== wantRtl) {
    I18nManager.forceRTL(wantRtl);
    needsRestart = true;
  }
  return { code, needsRestart };
}

export default i18n;
