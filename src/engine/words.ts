import type { Chunk, Token } from './types';

const NO_SPACE_LANGS = ['zh', 'ja', 'th', 'km', 'lo', 'my'];
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const HEBREW_MARKS = /[֑-ׇֽֿׁׂׅׄ]/g;

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];
const TENS: Record<number, string> = {
  30: 'thirty',
  40: 'forty',
  50: 'fifty',
  60: 'sixty',
  70: 'seventy',
  80: 'eighty',
  90: 'ninety',
  100: 'hundred',
  1000: 'thousand',
};

/** Single-word English numbers only (0-20, round tens, 100, 1000). */
function numberWord(digits: string): string | undefined {
  if (!/^\d{1,4}$/.test(digits)) return undefined;
  const n = Number(digits);
  return n <= 20 ? ONES[n] : TENS[n];
}

/** False for scripts written without spaces between words (zh, ja, th...). */
export function usesSpaces(lang: string): boolean {
  return !NO_SPACE_LANGS.includes(baseLang(lang));
}

export function baseLang(lang: string): string {
  return lang.toLowerCase().split(/[-_]/)[0];
}

/** Lowercase, strip punctuation and symbols, drop Arabic/Hebrew vowel marks. */
export function normalize(text: string, lang = 'en'): string {
  let s = text.normalize('NFC').toLowerCase();
  s = s.replace(ARABIC_MARKS, '').replace(HEBREW_MARKS, '');
  s = s.replace(/[\p{P}\p{S}]/gu, '');
  if (baseLang(lang) === 'en') s = numberWord(s) ?? s;
  return s;
}

interface Span {
  start: number;
  end: number;
}

interface SegmenterLike {
  segment(input: string): Iterable<{ segment: string; index: number }>;
}

function makeSegmenter(lang: string): SegmenterLike | null {
  const Ctor = (Intl as unknown as { Segmenter?: new (l: string, o: object) => SegmenterLike })
    .Segmenter;
  if (typeof Ctor !== 'function') return null;
  try {
    return new Ctor(lang, { granularity: 'word' });
  } catch {
    return null;
  }
}

function whitespaceSpans(text: string): Span[] {
  const spans: Span[] = [];
  const re = /\S+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) spans.push({ start: m.index, end: m.index + m[0].length });
  return spans;
}

function segmenterSpans(text: string, seg: SegmenterLike): Span[] {
  const spans: Span[] = [];
  for (const part of seg.segment(text)) {
    if (/\S/u.test(part.segment)) {
      spans.push({ start: part.index, end: part.index + part.segment.length });
    }
  }
  return spans;
}

const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}';

/** Fallback for engines without Intl.Segmenter: one token per CJK character. */
function cjkFallbackSpans(text: string): Span[] {
  const spans: Span[] = [];
  const re = new RegExp(`[${CJK}]|[^\\s${CJK}]+`, 'gu');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) spans.push({ start: m.index, end: m.index + m[0].length });
  return spans;
}

/**
 * Splits text into word tokens. Tokens that are only punctuation are attached to the
 * previous word (or the next one, at the start) so the whole string can still be displayed.
 */
export function words(text: string, lang = 'en'): Token[] {
  const base = baseLang(lang);
  let spans: Span[];
  if (NO_SPACE_LANGS.includes(base)) {
    const seg = makeSegmenter(lang);
    spans = seg ? segmenterSpans(text, seg) : cjkFallbackSpans(text);
  } else {
    spans = whitespaceSpans(text);
  }

  const tokens: Token[] = [];
  let pendingStart: number | null = null;
  for (const span of spans) {
    const start = pendingStart ?? span.start;
    const raw = text.slice(span.start, span.end);
    const norm = normalize(raw, lang);
    if (norm === '') {
      const prev = tokens[tokens.length - 1];
      if (prev && pendingStart === null) {
        prev.end = span.end;
        prev.text = text.slice(prev.start, prev.end);
      } else if (pendingStart === null) {
        pendingStart = span.start;
      }
      continue;
    }
    pendingStart = null;
    tokens.push({ text: text.slice(start, span.end), norm, start, end: span.end });
  }
  return tokens;
}

/** Text of the memorisable lines (text and dialogue) of a chunk. Speaker and action lines are skipped. */
export function chunkLines(chunk: Chunk): string[] {
  return chunk.lines.filter((l) => l.kind === 'text' || l.kind === 'dialogue').map((l) => l.text);
}

export function chunkText(chunk: Chunk): string {
  return chunkLines(chunk).join('\n');
}

export function wordCount(chunk: Chunk, lang = 'en'): number {
  return chunkLines(chunk).reduce((n, line) => n + words(line, lang).length, 0);
}
