import { gamesFor, isAvailableOn } from './registry';

describe('gamesFor', () => {
  it('offers the speech games on Android', () => {
    const ids = gamesFor('script', 'android').map((g) => g.id);
    expect(ids).toEqual(expect.arrayContaining(['speak', 'run-scene']));
  });

  it('hides the speech games on the web, where recognition would leave the device', () => {
    const ids = gamesFor('script', 'web').map((g) => g.id);
    expect(ids).not.toContain('speak');
    expect(ids).not.toContain('run-scene');
    expect(ids).toContain('type-it');
    expect(isAvailableOn('speak', 'web')).toBe(false);
    expect(isAvailableOn('first-letter', 'web')).toBe(true);
  });

  it('keeps Run Scene to scripts', () => {
    expect(gamesFor('text', 'android').map((g) => g.id)).not.toContain('run-scene');
  });
});
