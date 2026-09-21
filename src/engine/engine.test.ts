import {
  align,
  hashBody,
  isSpeakerLine,
  normalize,
  parseBody,
  phrases,
  scoreAlignment,
  sentences,
  validateScript,
  wordCount,
  words,
} from './index';

const tokens = (s: string, lang = 'en') => words(s, lang);
const norms = (s: string, lang = 'en') => tokens(s, lang).map((t) => t.norm);

describe('parseBody (text)', () => {
  it('splits chunks on blank lines and keeps single line breaks', () => {
    const chunks = parseBody('Roses are red,\nViolets are blue.\n\nSugar is sweet.\n', 'text');
    expect(chunks).toHaveLength(2);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].lines.map((l) => l.text)).toEqual(['Roses are red,', 'Violets are blue.']);
    expect(chunks[1].lines).toEqual([{ kind: 'text', text: 'Sugar is sweet.' }]);
  });

  it('treats several blank lines and CRLF as one separator', () => {
    const chunks = parseBody('a\r\nb\r\n\r\n\r\n   \r\nc', 'text');
    expect(chunks.map((c) => c.lines.map((l) => l.text))).toEqual([['a', 'b'], ['c']]);
  });

  it('returns no chunks for an empty body', () => {
    expect(parseBody('  \n \n', 'text')).toEqual([]);
  });
});

const SCRIPT = `ROMEO
But soft, what light through yonder window breaks?
(He looks up.)

JULIET
O Romeo, Romeo, wherefore art thou Romeo?

[Enter NURSE]

NURSE:
Madam!
Madam, come away.

ROMEO
It is the east.`;

describe('parseBody (script)', () => {
  const chunks = parseBody(SCRIPT, 'script');

  it('recognises speakers, dialogue and actions', () => {
    expect(chunks).toHaveLength(5);
    expect(chunks[0].lines.map((l) => l.kind)).toEqual(['speaker', 'dialogue', 'action']);
    expect(chunks[0].lines[1].speaker).toBe('ROMEO');
    expect(chunks[1].lines[0]).toEqual({ kind: 'speaker', text: 'JULIET', speaker: 'JULIET' });
    expect(chunks[2].lines.map((l) => l.kind)).toEqual(['action']);
    expect(chunks[3].lines.map((l) => l.kind)).toEqual(['speaker', 'dialogue', 'dialogue']);
    expect(chunks[3].lines[0].text).toBe('NURSE');
  });

  it('supports three or more speakers and action-only blocks', () => {
    const speakers = new Set(
      chunks.flatMap((c) => c.lines.filter((l) => l.kind === 'speaker')).map((l) => l.text),
    );
    expect([...speakers].sort()).toEqual(['JULIET', 'NURSE', 'ROMEO']);
    const actionOnly = parseBody('[Enter NURSE]', 'script')[0];
    expect(actionOnly.lines).toEqual([{ kind: 'action', text: '[Enter NURSE]' }]);
  });

  it('carries the speaker over a blank line inside a long speech', () => {
    const c = parseBody('HAMLET\nTo be,\n\nor not to be.', 'script');
    expect(c[1].lines[0]).toEqual({ kind: 'dialogue', text: 'or not to be.', speaker: 'HAMLET' });
  });

  it('does not treat shouted dialogue or lowercase names as speakers', () => {
    expect(isSpeakerLine('I AM SO ANGRY!')).toBe(false);
    expect(isSpeakerLine('Hamlet')).toBe(false);
    expect(isSpeakerLine('LADY MACBETH')).toBe(true);
    expect(isSpeakerLine('(EXIT)')).toBe(false);
    expect(isSpeakerLine('12345')).toBe(false);
  });
});

describe('scripts in languages without capital letters', () => {
  it('recognises a speaker written with a trailing colon', () => {
    expect(isSpeakerLine('هاملت:')).toBe(true);
    expect(isSpeakerLine('哈姆雷特：')).toBe(true);
    expect(isSpeakerLine('הַמְלֶט:')).toBe(true);
    expect(isSpeakerLine('हैमलेट:')).toBe(true);
  });

  it('does not treat plain uncased lines as speakers', () => {
    expect(isSpeakerLine('هاملت')).toBe(false);
    expect(isSpeakerLine('أكون أو لا أكون.')).toBe(false);
    expect(isSpeakerLine('12345:')).toBe(false);
    expect(isSpeakerLine(':')).toBe(false);
  });

  it('parses an Arabic script with three speakers and an action line', () => {
    const body = 'هاملت:\nأكون أو لا أكون\n(ينظر إلى السماء)\n\nأوفيليا:\nمولاي\n\nالملك:\nتعال';
    const chunks = parseBody(body, 'script');
    expect(chunks).toHaveLength(3);
    expect(chunks[0].lines.map((l) => l.kind)).toEqual(['speaker', 'dialogue', 'action']);
    expect(chunks[0].lines[0].text).toBe('هاملت');
    expect(chunks[1].lines[1]).toEqual({ kind: 'dialogue', text: 'مولاي', speaker: 'أوفيليا' });
    expect(validateScript(body)).toEqual([]);
  });

  it('parses a Chinese script with full-width colons', () => {
    const chunks = parseBody('哈姆雷特：\n生存还是毁灭\n\n奥菲莉亚：\n殿下', 'script');
    expect(chunks.map((c) => c.lines.map((l) => l.kind))).toEqual([
      ['speaker', 'dialogue'],
      ['speaker', 'dialogue'],
    ]);
  });
});

describe('validateScript', () => {
  it('flags a speaker with no dialogue', () => {
    const issues = validateScript('ROMEO\n\nJULIET\nHi.');
    expect(issues).toEqual([{ line: 1, code: 'SPEAKER_NO_DIALOGUE' }]);
  });

  it('flags a speaker followed directly by another speaker', () => {
    expect(validateScript('ROMEO\nJULIET\nHi.')).toEqual([
      { line: 1, code: 'SPEAKER_NO_DIALOGUE' },
    ]);
  });

  it('flags a name that looks like a speaker but is not all caps', () => {
    const issues = validateScript('ROMEO\nHi.\n\nJuliet\nHello.');
    expect(issues).toEqual([{ line: 4, code: 'LOOKS_LIKE_SPEAKER' }]);
  });

  it('is quiet for a well formed script', () => {
    expect(validateScript(SCRIPT)).toEqual([]);
  });
});

describe('sentences and phrases', () => {
  const chunk = parseBody('Hello there, friend. How are you?\nI am fine; thanks!', 'text')[0];

  it('splits sentences across line breaks', () => {
    expect(sentences(chunk)).toEqual([
      'Hello there, friend.',
      'How are you?',
      'I am fine; thanks!',
    ]);
  });

  it('keeps closing quotes and repeated terminators', () => {
    const c = parseBody('He said "Really?!" Then left.', 'text')[0];
    expect(sentences(c)).toEqual(['He said "Really?!"', 'Then left.']);
  });

  it('does not split on abbreviations inside words like 3.5', () => {
    const c = parseBody('It costs 3.5 dollars. Fine.', 'text')[0];
    expect(sentences(c)).toEqual(['It costs 3.5 dollars.', 'Fine.']);
  });

  it('splits phrases on , ; : and line breaks', () => {
    expect(phrases(chunk)).toEqual([
      'Hello there,',
      'friend. How are you?',
      'I am fine;',
      'thanks!',
    ]);
  });

  it('splits CJK sentences without spaces', () => {
    const c = parseBody('你好。今天怎么样？很好！', 'text')[0];
    expect(sentences(c)).toEqual(['你好。', '今天怎么样？', '很好！']);
  });

  it('ignores speaker and action lines', () => {
    const c = parseBody('ROMEO\nHi there.\n(He waves.)', 'script')[0];
    expect(sentences(c)).toEqual(['Hi there.']);
  });
});

describe('words and normalize', () => {
  it('keeps punctuation for display but not in norm', () => {
    const t = tokens('Hello, "World"!');
    expect(t.map((x) => x.text)).toEqual(['Hello,', '"World"!']);
    expect(t.map((x) => x.norm)).toEqual(['hello', 'world']);
  });

  it('reports spans that slice back to the token text', () => {
    const s = 'One  two,\nthree';
    for (const t of tokens(s)) expect(s.slice(t.start, t.end)).toBe(t.text);
  });

  it('attaches stand-alone punctuation to the previous word', () => {
    const t = tokens('wait — what');
    expect(t.map((x) => x.text)).toEqual(['wait —', 'what']);
  });

  it('treats digits and number words as equal in English', () => {
    expect(normalize('3')).toBe('three');
    expect(norms('I have 3 apples')).toEqual(['i', 'have', 'three', 'apples']);
    expect(normalize('three')).toBe('three');
    expect(normalize('3', 'fr')).toBe('3');
  });

  it('counts words in a chunk', () => {
    expect(wordCount(parseBody('a b c\nd', 'text')[0])).toBe(4);
  });

  it('hashes bodies deterministically', () => {
    expect(hashBody('abc')).toBe(hashBody('abc'));
    expect(hashBody('abc')).not.toBe(hashBody('abd'));
  });
});

describe('all 11 languages', () => {
  const samples: [string, string, string[]][] = [
    ['en', 'The quick brown fox, jumps.', ['the', 'quick', 'brown', 'fox', 'jumps']],
    ['es', '¡El veloz zorro salta!', ['el', 'veloz', 'zorro', 'salta']],
    ['fr', "L'été, le renard saute.", ['lété', 'le', 'renard', 'saute']],
    ['de', 'Der schnelle Fuchs springt.', ['der', 'schnelle', 'fuchs', 'springt']],
    [
      'fil',
      'Ang mabilis na soro ay tumatalon.',
      ['ang', 'mabilis', 'na', 'soro', 'ay', 'tumatalon'],
    ],
    ['pt-BR', 'A rápida raposa marrom pula.', ['a', 'rápida', 'raposa', 'marrom', 'pula']],
    ['nl', 'De snelle bruine vos springt.', ['de', 'snelle', 'bruine', 'vos', 'springt']],
    ['hi', 'तेज़ भूरी लोमड़ी कूदती है।', ['तेज़', 'भूरी', 'लोमड़ी', 'कूदती', 'है']],
    ['ar', 'الثعلب البُنّي السريع يقفز.', ['الثعلب', 'البني', 'السريع', 'يقفز']],
    ['he', 'השועל החום המהיר קופץ.', ['השועל', 'החום', 'המהיר', 'קופץ']],
  ];

  it.each(samples)('%s tokenises and normalises', (lang, text, expected) => {
    const t = words(text, lang);
    expect(t.map((x) => x.norm)).toEqual(expected);
    for (const tok of t) expect(text.slice(tok.start, tok.end)).toBe(tok.text);
  });

  it('zh-Hans segments without spaces', () => {
    const text = '敏捷的棕色狐狸跳跃。';
    const t = words(text, 'zh-Hans');
    expect(t.length).toBeGreaterThan(2);
    expect(t.every((x) => !x.norm.includes('。'))).toBe(true);
    expect(t.map((x) => x.text).join('')).toBe(text);
  });

  it('handles RTL text through parse, phrases and align', () => {
    const chunk = parseBody('الثعلب البني، السريع\nيقفز فوق الكلب.', 'text')[0];
    expect(phrases(chunk)).toEqual(['الثعلب البني،', 'السريع', 'يقفز فوق الكلب.']);
    const target = words('الثعلب البني السريع', 'ar');
    const attempt = words('الثعلب السريع', 'ar');
    expect(align(target, attempt).map((a) => a.op)).toEqual(['match', 'missed', 'match']);
  });

  it('handles Hebrew with niqqud and a script parse', () => {
    expect(normalize('שָׁלוֹם', 'he')).toBe('שלום');
    expect(parseBody('שלום עולם', 'script')[0].lines[0].kind).toBe('text');
  });
});

describe('align', () => {
  const ops = (a: string, b: string) => align(words(a), words(b)).map((x) => x.op);

  it('matches identical text', () => {
    expect(ops('a b c', 'A, B, C!')).toEqual(['match', 'match', 'match']);
  });

  it('finds missed, extra and wrong words', () => {
    expect(ops('the quick brown fox', 'the brown fox')).toEqual([
      'match',
      'missed',
      'match',
      'match',
    ]);
    expect(ops('the brown fox', 'the quick brown fox')).toEqual([
      'match',
      'extra',
      'match',
      'match',
    ]);
    expect(ops('the quick fox', 'the slow fox')).toEqual(['match', 'wrong', 'match']);
  });

  it('handles empty sides', () => {
    expect(ops('a b', '')).toEqual(['missed', 'missed']);
    expect(ops('', 'a b')).toEqual(['extra', 'extra']);
    expect(ops('', '')).toEqual([]);
  });

  it('keeps the token references', () => {
    const [item] = align(words('hello'), words('hallo'));
    expect(item.op).toBe('wrong');
    expect(item.target?.norm).toBe('hello');
    expect(item.attempt?.norm).toBe('hallo');
  });

  it('scores an alignment', () => {
    const s = scoreAlignment(align(words('a b c d'), words('a x c d e')));
    expect(s).toMatchObject({ matched: 3, wrong: 1, missed: 0, extra: 1, targetCount: 4 });
    expect(s.accuracy).toBeCloseTo(3 / 5);
    expect(scoreAlignment([]).accuracy).toBe(0);
  });

  it('is bounded and correct for long inputs', () => {
    const base = Array.from({ length: 3000 }, (_, i) => `w${i}`);
    const target = words(base.join(' '));
    const attemptWords = base.filter((_, i) => i % 50 !== 7);
    const result = align(target, words(attemptWords.join(' ')));
    const s = scoreAlignment(result);
    expect(s.missed).toBe(60);
    expect(s.matched).toBe(2940);
    expect(s.extra).toBe(0);
  });
});
