export type OcrScript = 'Latin' | 'Chinese' | 'Devanagari' | 'Japanese' | 'Korean';

export const OCR_SCRIPTS: OcrScript[] = ['Latin', 'Chinese', 'Devanagari', 'Japanese', 'Korean'];

/** ML Kit has no Arabic or Hebrew model, so those languages cannot be scanned. */
export function ocrSupported(lang: string): boolean {
  const base = lang.toLowerCase().split('-')[0];
  return base !== 'ar' && base !== 'he';
}

export function scriptForLanguage(lang: string): OcrScript {
  const base = lang.toLowerCase().split('-')[0];
  if (base === 'zh') return 'Chinese';
  if (base === 'hi') return 'Devanagari';
  if (base === 'ja') return 'Japanese';
  if (base === 'ko') return 'Korean';
  return 'Latin';
}

/**
 * Tesseract language data bundled with the web app, for each scannable Linewise language.
 * Must match LANGS in scripts/copy-ocr-assets.js.
 */
export const TESSERACT_LANG: Record<string, string> = {
  en: 'eng',
  es: 'spa',
  fr: 'fra',
  de: 'deu',
  fil: 'tgl',
  'pt-BR': 'por',
  nl: 'nld',
  hi: 'hin',
  'zh-Hans': 'chi_sim',
};

interface BlockLike {
  text: string;
  lines: { text: string }[];
}

/** Recognised blocks become paragraphs (blank line between blocks); lines inside a block are kept as line breaks. */
export function blocksToText(blocks: BlockLike[]): string {
  return blocks
    .map((b) => (b.lines.length ? b.lines.map((l) => l.text.trim()).join('\n') : b.text.trim()))
    .filter(Boolean)
    .join('\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
