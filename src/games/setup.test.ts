import { parseBody } from '../engine';
import { makeResult } from './ids';
import {
  buildUnits,
  clampSelection,
  countWords,
  hiddenIndexes,
  seededRandom,
  selectionRange,
  shuffle,
  speakersOf,
  totalWords,
  unitsText,
} from './setup';

const poem = parseBody('a b c\nd e\n\nf g h i\n\nj', 'text');
const play = parseBody('ROMEO\nOne two.\n\nJULIET\nThree four five.\n\nROMEO\nSix.', 'script');

describe('selection', () => {
  it('clamps modes to the available chunks', () => {
    expect(clampSelection({ mode: 'one', from: 9, to: 9 }, 3)).toMatchObject({ from: 2, to: 2 });
    expect(clampSelection({ mode: 'range', from: 1, to: 0 }, 3)).toMatchObject({ from: 1, to: 1 });
    expect(selectionRange({ mode: 'all', from: 2, to: 2 }, 3)).toEqual([0, 2]);
    expect(selectionRange({ mode: 'all', from: 0, to: 0 }, 0)).toEqual([0, 0]);
  });

  it('builds units for one chunk, a range and all', () => {
    expect(buildUnits(poem, { mode: 'one', from: 1, to: 1 }).map((u) => u.chunkIndex)).toEqual([1]);
    expect(buildUnits(poem, { mode: 'range', from: 0, to: 1 })).toHaveLength(2);
    expect(buildUnits(poem, { mode: 'all', from: 0, to: 0 })).toHaveLength(3);
  });

  it('counts words and joins text', () => {
    const all = buildUnits(poem, { mode: 'all', from: 0, to: 0 });
    expect(countWords(all, 'en')).toBe(10);
    expect(unitsText(all.slice(0, 1))).toBe('a b c\nd e');
  });
});

describe('focus speaker', () => {
  it('lists speakers in order of appearance', () => {
    expect(speakersOf(play)).toEqual(['ROMEO', 'JULIET']);
  });

  it('keeps only the speaker lines and drops speaker labels', () => {
    const units = buildUnits(play, { mode: 'all', from: 0, to: 0, speaker: 'ROMEO' });
    expect(units.map((u) => u.chunkIndex)).toEqual([0, 2]);
    expect(unitsText(units)).toBe('One two.\nSix.');
    expect(totalWords(play, 'en', 'ROMEO')).toBe(3);
    expect(totalWords(play, 'en')).toBe(6);
  });
});

describe('random helpers', () => {
  it('seeds deterministically', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('shuffles without losing items', () => {
    expect(shuffle([1, 2, 3, 4, 5], seededRandom(3)).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('hides more words as the percent rises, never fewer', () => {
    let previous = new Set<number>();
    for (const pct of [0, 10, 25, 50, 75, 100]) {
      const now = hiddenIndexes(40, pct, 5);
      expect(now.size).toBe(Math.round((pct / 100) * 40));
      for (const i of previous) expect(now.has(i)).toBe(true);
      previous = now;
    }
  });
});

describe('makeResult', () => {
  it('clamps and weights', () => {
    expect(makeResult('type-it', 1.4, 5, 10, [0, 0])).toMatchObject({
      accuracy: 1,
      coverage: 0.5,
      weightedScore: 0.5,
    });
    expect(makeResult('type-it', 0.5, 5, 0, [0, 0]).weightedScore).toBe(0);
  });
});
