import { parseBody } from '../engine';
import { buildSegments, effectiveRate } from './listen';
import { buildUnits } from './setup';

describe('listen segments', () => {
  it('splits by line and by sentence within a line', () => {
    const chunks = parseBody(
      'Roses are red.\nViolets are blue. Sugar is sweet.\n\nAnd so are you.',
      'text',
    );
    const segs = buildSegments(buildUnits(chunks, { mode: 'all', from: 0, to: 0 }));
    expect(segs.map((s) => s.text)).toEqual([
      'Roses are red.',
      'Violets are blue.',
      'Sugar is sweet.',
      'And so are you.',
    ]);
    expect(segs.map((s) => s.chunkStart)).toEqual([true, false, false, true]);
  });

  it('keeps a line without punctuation as one segment', () => {
    const chunks = parseBody('no punctuation here', 'text');
    expect(
      buildSegments(buildUnits(chunks, { mode: 'all', from: 0, to: 0 })).map((s) => s.text),
    ).toEqual(['no punctuation here']);
  });

  it('clamps the speech rate', () => {
    expect(effectiveRate(1, 1.5)).toBe(1.5);
    expect(effectiveRate(2, 2)).toBe(3);
    expect(effectiveRate(0.5, 0.5)).toBe(0.3);
  });
});
