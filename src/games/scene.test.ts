import { parseBody } from '../engine';
import { buildScene, pitchFor, roleWordCount, rolesOf, voiceFor } from './scene';

const play = parseBody(
  'ROMEO\nBut soft, what light?\n(He looks up.)\n\nJULIET\nO Romeo, Romeo!\n\n[Enter NURSE]\n\nNURSE\nMadam!\n\nROMEO\nHush now.',
  'script',
);

describe('scene', () => {
  const steps = buildScene(play, { mode: 'all', from: 0, to: 0 });

  it('turns chunks into ordered steps without speaker labels', () => {
    expect(steps.map((s) => `${s.kind}:${s.speaker}`)).toEqual([
      'line:ROMEO',
      'action:',
      'line:JULIET',
      'action:',
      'line:NURSE',
      'line:ROMEO',
    ]);
  });

  it("lists roles in order of appearance and counts a role's words", () => {
    expect(rolesOf(steps)).toEqual(['ROMEO', 'JULIET', 'NURSE']);
    expect(roleWordCount(steps, 'ROMEO', 'en')).toBe(6);
    expect(roleWordCount(steps, 'NURSE', 'en')).toBe(1);
  });

  it('respects the chunk range', () => {
    const part = buildScene(play, { mode: 'one', from: 1, to: 1 });
    expect(part.map((s) => s.text)).toEqual(['O Romeo, Romeo!']);
  });

  it('gives each role a stable pitch and honours voice overrides', () => {
    const roles = rolesOf(steps);
    expect(pitchFor('ROMEO', roles)).toBe(1);
    expect(pitchFor('JULIET', roles)).not.toBe(pitchFor('ROMEO', roles));
    expect(pitchFor('', roles)).toBe(1);
    expect(voiceFor('ROMEO', { ROMEO: 'v1' }, 'def')).toBe('v1');
    expect(voiceFor('JULIET', { ROMEO: 'v1' }, 'def')).toBe('def');
    expect(voiceFor('JULIET', {}, null)).toBeNull();
  });
});
