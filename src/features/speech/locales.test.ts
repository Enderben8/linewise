import { sameLanguage, speechLocale } from './locales';

describe('speech locales', () => {
  it('maps text languages to engine tags', () => {
    expect(speechLocale('en')).toBe('en-US');
    expect(speechLocale('zh-Hans')).toBe('zh-CN');
    expect(speechLocale('pt-BR')).toBe('pt-BR');
    expect(speechLocale('xx')).toBe('xx');
  });

  it('matches regional variants and legacy codes', () => {
    expect(sameLanguage('en-GB', 'en')).toBe(true);
    expect(sameLanguage('en_AU', 'en')).toBe(true);
    expect(sameLanguage('tl-PH', 'fil')).toBe(true);
    expect(sameLanguage('iw-IL', 'he')).toBe(true);
    expect(sameLanguage('pt-PT', 'pt-BR')).toBe(true);
    expect(sameLanguage('fr-FR', 'en')).toBe(false);
  });
});
