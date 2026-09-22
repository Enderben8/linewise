export const LANGUAGES = [
  { code: 'en', name: 'English', rtl: false },
  { code: 'es', name: 'Español', rtl: false },
  { code: 'fr', name: 'Français', rtl: false },
  { code: 'de', name: 'Deutsch', rtl: false },
  { code: 'fil', name: 'Filipino', rtl: false },
  { code: 'pt-BR', name: 'Português (Brasil)', rtl: false },
  { code: 'nl', name: 'Nederlands', rtl: false },
  { code: 'hi', name: 'हिन्दी', rtl: false },
  { code: 'ar', name: 'العربية', rtl: true },
  { code: 'zh-Hans', name: '简体中文', rtl: false },
  { code: 'he', name: 'עברית', rtl: true },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

/** Arabic, Hebrew, Hindi and Chinese have no capital letters, so scripts mark speakers with a colon instead. */
export function hasCapitals(code: string): boolean {
  return !['ar', 'he', 'hi', 'zh-Hans'].includes(code);
}

export function isRtl(code: string): boolean {
  return LANGUAGES.find((l) => l.code === code)?.rtl ?? false;
}

/** Keys mirror the `settings` table in SPEC.md §9. */
export interface Settings {
  /** UI language, or 'system' to follow the phone. */
  locale: string;
  /** Language new memorizations start with. */
  default_language: string;
  /** Text scale, 0.8 to 1.6. */
  font_size: number;
  /** Speech rate for text to speech, 0.5 to 2. */
  speech_rate: number;
  /** Chosen device voice per text language, e.g. { en: 'en-us-x-tpd-local' }. */
  default_voice: Record<string, string>;
  notifications_enabled: boolean;
  reset_solidify_each_interval: boolean;
  onboarding_done: boolean;
  backup_reminder_enabled: boolean;
  last_backup_at: number | null;
  /** Ask GitHub for a newer release each time the app opens (Android). */
  update_check_enabled: boolean;
  /** The release the user chose not to download, so the app does not offer it again at start. */
  update_dismissed_version: string;
}

export const DEFAULT_SETTINGS: Settings = {
  locale: 'system',
  default_language: 'en',
  font_size: 1,
  speech_rate: 1,
  default_voice: {},
  notifications_enabled: true,
  reset_solidify_each_interval: false,
  onboarding_done: false,
  backup_reminder_enabled: true,
  last_backup_at: null,
  update_check_enabled: true,
  update_dismissed_version: '',
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

/** Merges stored rows over the defaults, ignoring unknown keys and values of the wrong type. */
export function mergeSettings(stored: Record<string, unknown>): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const key of SETTING_KEYS) {
    const value = stored[key];
    if (value === undefined) continue;
    const expected = DEFAULT_SETTINGS[key];
    const ok =
      value === null
        ? key === 'last_backup_at'
        : key === 'last_backup_at'
          ? typeof value === 'number'
          : typeof value === typeof expected && !Array.isArray(value);
    if (ok) (out as unknown as Record<string, unknown>)[key] = value;
  }
  return out;
}
