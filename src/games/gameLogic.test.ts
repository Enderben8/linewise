import { parseBody, words } from '../engine';
import { allKeys, autoHide, blankOptions, keyedLines } from './fillBlank';
import {
  accuracyOf,
  firstLetterMatches,
  initialFirstLetter,
  isFinished,
  splitLetters,
  typeLetter,
  typeLetters,
} from './firstLetter';
import { buildQuestions } from './multipleChoice';
import { buildRounds, correctPositions, scrambleItems, scrambleOrder } from './scramble';
import { buildUnits, seededRandom } from './setup';

const tok = (text: string, lang = 'en') => words(text, lang);

describe('first letter', () => {
  it('matches the first letter, ignoring case, accents and leading punctuation', () => {
    const [t] = tok('"Été,');
    expect(firstLetterMatches('e', t)).toBe(true);
    expect(firstLetterMatches('É', t)).toBe(true);
    expect(firstLetterMatches('x', t)).toBe(false);
    expect(firstLetterMatches('', t)).toBe(false);
  });

  it('accepts the digit or the number word', () => {
    const [t] = tok('3');
    expect(firstLetterMatches('3', t)).toBe(true);
    expect(firstLetterMatches('t', t)).toBe(true);
  });

  it('marks wrong letters and moves on', () => {
    const tokens = tok('one two three');
    let s = initialFirstLetter;
    for (const ch of ['o', 'x', 't']) {
      const step = typeLetter(s, ch, tokens)!;
      s = step.state;
    }
    expect(s.marks).toEqual(['ok', 'wrong', 'ok']);
    expect(isFinished(s, 3)).toBe(true);
    expect(accuracyOf(s)).toBeCloseTo(2 / 3);
    expect(typeLetter(s, 'a', tokens)).toBeNull();
    expect(typeLetter(initialFirstLetter, ' ', tokens)).toBeNull();
  });

  it('works for scripts without capitals', () => {
    const tokens = tok('שלום עולם', 'he');
    expect(firstLetterMatches('ש', tokens[0])).toBe(true);
    expect(firstLetterMatches('ע', tokens[1])).toBe(true);
  });
});

describe('multiple choice', () => {
  const poem = parseBody(
    'Roses are red,\nViolets are blue,\nSugar is sweet,\nAnd so are you.\n\nThe rose is red;\nThe violet is blue.',
    'text',
  );
  const units = buildUnits(poem, { mode: 'all', from: 0, to: 0 });

  it('asks for the next phrase with four unique options', () => {
    const qs = buildQuestions(units, 'en', seededRandom(1));
    expect(qs.length).toBeGreaterThan(3);
    for (const q of qs) {
      expect(q.level).toBe('phrase');
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.options).toHaveLength(4);
      expect(q.options[q.correctIndex]).toBe(q.correct);
    }
  });

  it('caps the number of questions', () => {
    expect(buildQuestions(units, 'en', seededRandom(1), 3)).toHaveLength(3);
  });

  it('falls back to words for a short text', () => {
    const short = buildUnits(parseBody('The quick brown fox jumps over', 'text'), {
      mode: 'all',
      from: 0,
      to: 0,
    });
    const qs = buildQuestions(short, 'en', seededRandom(2));
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.every((q) => q.level === 'word')).toBe(true);
  });

  it('returns nothing when there is too little text', () => {
    const tiny = buildUnits(parseBody('Hi there', 'text'), { mode: 'all', from: 0, to: 0 });
    expect(buildQuestions(tiny, 'en')).toEqual([]);
  });

  it('never offers two options that differ only in case or punctuation', () => {
    const raven = buildUnits(
      parseBody(
        'Nevermore.\nQuoth the raven, nevermore!\nOnce upon a midnight, dreary;\nNevermore, and more.',
        'text',
      ),
      { mode: 'all', from: 0, to: 0 },
    );
    const key = (s: string) => s.toLowerCase().replace(/[\p{P}\p{S}]/gu, '');
    for (let seed = 0; seed < 10; seed++) {
      for (const q of buildQuestions(raven, 'en', seededRandom(seed))) {
        expect(new Set(q.options.map(key)).size).toBe(q.options.length);
      }
    }
  });
});

describe('sentence scramble', () => {
  it('uses sentences, or phrases when there is only one sentence', () => {
    const two = buildUnits(parseBody('One is here. Two is there.', 'text'), {
      mode: 'all',
      from: 0,
      to: 0,
    });
    expect(scrambleItems(two)).toEqual(['One is here.', 'Two is there.']);
    const one = buildUnits(parseBody('Wait, what is this, really?', 'text'), {
      mode: 'all',
      from: 0,
      to: 0,
    });
    expect(scrambleItems(one)).toEqual(['Wait,', 'what is this,', 'really?']);
  });

  it('builds rounds without a lonely last item', () => {
    const items = Array.from({ length: 7 }, (_, i) => `s${i}`);
    expect(buildRounds(items, 3).map((r) => r.length)).toEqual([3, 4]);
    expect(buildRounds(items.slice(0, 2), 6)).toHaveLength(1);
  });

  it('never returns the solved order and scores positions', () => {
    for (let n = 2; n < 8; n++) {
      const items = Array.from({ length: n }, (_, i) => `s${i}`);
      for (let seed = 0; seed < 10; seed++) {
        const order = scrambleOrder(items, seededRandom(seed));
        expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
        expect(correctPositions(order, items)).toBeLessThan(n);
      }
    }
    expect(correctPositions([0, 1, 2], ['a', 'b', 'c'])).toBe(3);
    expect(correctPositions([1, 0, 2], ['a', 'b', 'c'])).toBe(1);
  });

  it('treats a repeated sentence as right in either of its places', () => {
    const items = ['Row, row.', 'Row your boat.', 'Row, row.'];
    expect(correctPositions([2, 1, 0], items)).toBe(3);
    for (let seed = 0; seed < 20; seed++) {
      expect(correctPositions(scrambleOrder(items, seededRandom(seed)), items)).toBeLessThan(3);
    }
    expect(scrambleOrder(['Again.', 'Again.'])).toEqual([0, 1]);
  });
});

describe('fill in the blank', () => {
  const play = parseBody('ROMEO\nOne two three.\n\nJULIET\nFour five.', 'script');

  it('keys words by chunk so choices survive changing the selection', () => {
    const all = keyedLines(play, { mode: 'all', from: 0, to: 0 }, 'en');
    expect(allKeys(all)).toEqual(['0:0', '0:1', '0:2', '1:0', '1:1']);
    const second = keyedLines(play, { mode: 'one', from: 1, to: 1 }, 'en');
    expect(allKeys(second)).toEqual(['1:0', '1:1']);
    expect(second[0].start).toBe(0);
  });

  it('honours the focus speaker without shifting keys', () => {
    const lines = keyedLines(play, { mode: 'all', from: 0, to: 0, speaker: 'JULIET' }, 'en');
    expect(allKeys(lines)).toEqual(['1:0', '1:1']);
  });

  it('picks a stable share of words to hide', () => {
    const keys = Array.from({ length: 40 }, (_, i) => `0:${i}`);
    const a = autoHide(keys, 25, 3);
    expect(a).toHaveLength(10);
    expect(autoHide(keys, 25, 3)).toEqual(a);
  });

  it('offers the right word among unique look-alikes', () => {
    const opts = blankOptions('"Sweet,"', ['sweet', 'sugar', 'is', 'so', 'are', 'you', 'and'], 4);
    expect(opts).toHaveLength(4);
    expect(opts.filter((o) => o.toLowerCase() === 'sweet')).toHaveLength(1);
    expect(new Set(opts.map((o) => o.toLowerCase())).size).toBe(4);
    expect(blankOptions('a', ['a'], 1)).toEqual(['a']);
  });
});

describe('first letter with batched input', () => {
  it('splits typed text into letters, keeping combining marks with their letter', () => {
    expect(splitLetters('ab c')).toEqual(['a', 'b', 'c']);
    expect(splitLetters('कि')).toEqual(['कि']);
    expect(splitLetters('  ')).toEqual([]);
  });

  it('applies every letter that arrives in one change event', () => {
    const tokens = tok('Twinkle twinkle little star how');
    const step = typeLetters(initialFirstLetter, 'ttlsx', tokens)!;
    expect(step.state.marks).toEqual(['ok', 'ok', 'ok', 'ok', 'wrong']);
    expect(step.anyWrong).toBe(true);
    expect(typeLetters(initialFirstLetter, '   ', tokens)).toBeNull();
  });

  it('stops at the end of the text instead of overrunning', () => {
    const step = typeLetters(initialFirstLetter, 'abcdef', tok('a b c'))!;
    expect(step.state.marks).toHaveLength(3);
    expect(step.state.index).toBe(3);
  });
});
