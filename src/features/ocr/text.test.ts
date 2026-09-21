import { blocksToText, ocrSupported, scriptForLanguage } from './text';

describe('ocr text', () => {
  it('joins blocks as paragraphs and keeps line breaks', () => {
    const text = blocksToText([
      { text: 'a b', lines: [{ text: 'Roses are red, ' }, { text: 'Violets are blue.' }] },
      { text: 'Sugar', lines: [] },
      { text: '  ', lines: [] },
    ]);
    expect(text).toBe('Roses are red,\nViolets are blue.\n\nSugar');
  });

  it('picks the script for a language and flags unsupported ones', () => {
    expect(scriptForLanguage('zh-Hans')).toBe('Chinese');
    expect(scriptForLanguage('hi')).toBe('Devanagari');
    expect(scriptForLanguage('pt-BR')).toBe('Latin');
    expect(ocrSupported('ar')).toBe(false);
    expect(ocrSupported('he')).toBe(false);
    expect(ocrSupported('fr')).toBe(true);
  });
});
