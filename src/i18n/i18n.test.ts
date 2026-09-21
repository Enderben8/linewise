import { GAME_IDS } from '../games/ids';
import { FAQ_ITEMS } from '../features/settings/faqItems';
import { LANGUAGES } from '../features/settings/defaults';
import { matchSupported, resources } from './index';
import en from './locales/en.json';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { extractKeys } = require('../../scripts/extract-keys') as { extractKeys: () => string[] };

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
const base = flatten(en as Tree);

const codes = LANGUAGES.map((l) => l.code);

describe('English source strings', () => {
  it('has every key the code uses', () => {
    const missing = extractKeys()
      .filter((k) => !k.includes('${'))
      .filter((k) => base[k] === undefined);
    expect(missing).toEqual([]);
  });

  it('has every dynamically built key', () => {
    const wanted: string[] = [];
    for (const id of GAME_IDS) wanted.push(`games.${id}.name`, `games.${id}.blurb`);
    for (const g of ['practice', 'solidify', 'evaluate'])
      wanted.push(`groups.${g}`, `groups.${g}Help`);
    for (const m of ['phrase', 'sentence', 'word']) wanted.push(`tap.mode.${m}`);
    for (const c of ['SPEAKER_NO_DIALOGUE', 'LOOKS_LIKE_SPEAKER'])
      wanted.push(`editor.issues.${c}`);
    for (const i of FAQ_ITEMS) wanted.push(`faq.items.${i}.q`, `faq.items.${i}.a`);
    for (const g of ['poem', 'speech', 'script', 'verse', 'other'])
      wanted.push(`onboarding.goals.${g}`);
    for (const s of ['Latin', 'Chinese', 'Devanagari', 'Japanese', 'Korean'])
      wanted.push(`camera.scripts.${s}`);
    for (const i of [
      'permission',
      'permission-blocked',
      'unavailable',
      'no-on-device',
      'language-missing',
      'no-voice',
    ]) {
      wanted.push(`speechIssue.${i}.title`, `speechIssue.${i}.body`);
    }
    expect(wanted.filter((k) => base[k] === undefined)).toEqual([]);
  });

  it('has no unused keys', () => {
    const used = new Set(extractKeys());
    const prefixes = extractKeys()
      .filter((k) => k.includes('${'))
      .map((k) => k.split('${')[0]);
    const unused = Object.keys(base).filter(
      (k) => !used.has(k) && !prefixes.some((p) => k.startsWith(p)),
    );
    expect(unused).toEqual([]);
  });
});

describe.each(codes.filter((c) => c !== 'en'))('locale %s', (code) => {
  const locale = flatten((resources as Record<string, { translation: Tree }>)[code].translation);

  it('has exactly the same keys as English', () => {
    expect(Object.keys(locale).sort()).toEqual(Object.keys(base).sort());
  });

  it('has no empty strings', () => {
    expect(
      Object.entries(locale)
        .filter(([, v]) => !v.trim())
        .map(([k]) => k),
    ).toEqual([]);
  });

  it('keeps every {{placeholder}} of the English string', () => {
    const wrong = Object.keys(base).filter(
      (k) =>
        JSON.stringify(placeholders(locale[k] ?? '')) !== JSON.stringify(placeholders(base[k])),
    );
    expect(wrong).toEqual([]);
  });

  it('translates the text instead of copying English', () => {
    // Short strings, names and units may legitimately match; most of the file must differ.
    const same = Object.keys(base).filter((k) => locale[k] === base[k]).length;
    expect(same / Object.keys(base).length).toBeLessThan(0.12);
  });
});

describe('device language matching', () => {
  it('maps phone locale tags to the 11 supported languages', () => {
    expect(matchSupported('en-GB')).toBe('en');
    expect(matchSupported('pt-PT')).toBe('pt-BR');
    expect(matchSupported('zh-Hans-CN')).toBe('zh-Hans');
    expect(matchSupported('zh-Hant-TW')).toBe('zh-Hans');
    expect(matchSupported('fil-PH')).toBe('fil');
    expect(matchSupported('tl-PH')).toBe('fil');
    expect(matchSupported('iw-IL')).toBe('he');
    expect(matchSupported('ar-EG')).toBe('ar');
    expect(matchSupported('ja-JP')).toBe('en');
    expect(matchSupported(undefined)).toBe('en');
  });
});
