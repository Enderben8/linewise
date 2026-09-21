import { LIMITS } from '../../config';
import { guessTitle, utf8Bytes, validateInput } from './validate';

describe('utf8Bytes', () => {
  it('counts ASCII, accents, CJK and emoji', () => {
    expect(utf8Bytes('abc')).toBe(3);
    expect(utf8Bytes('é')).toBe(2);
    expect(utf8Bytes('中')).toBe(3);
    expect(utf8Bytes('😀')).toBe(4);
  });
});

describe('validateInput', () => {
  it('requires a title and a body', () => {
    expect(validateInput({ title: ' ', body: '' })).toEqual(['TITLE_REQUIRED', 'BODY_REQUIRED']);
    expect(validateInput({ title: 'x', body: 'y' })).toEqual([]);
  });

  it('rejects bodies over the size limit', () => {
    const ok = 'a'.repeat(LIMITS.maxBodyBytes);
    expect(validateInput({ title: 'x', body: ok })).toEqual([]);
    expect(validateInput({ title: 'x', body: ok + 'a' })).toEqual(['BODY_TOO_LARGE']);
  });
});

describe('guessTitle', () => {
  it('uses the first non-empty line, shortened', () => {
    expect(guessTitle('\n\n  Ozymandias  \nI met')).toBe('Ozymandias');
    expect(guessTitle('x'.repeat(100))).toHaveLength(60);
    expect(guessTitle('   ')).toBe('');
  });
});
