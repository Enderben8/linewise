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

describe('speech engine errors', () => {
  jest.mock('expo-speech-recognition', () => ({
    ExpoSpeechRecognitionModule: {},
    useSpeechRecognitionEvent: () => {},
  }));

  it('turns fixable engine errors into guidance and ignores bad takes', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { issueFromError } = require('./recognition') as typeof import('./recognition');
    expect(issueFromError('language-not-supported')).toBe('language-missing');
    expect(issueFromError('not-allowed')).toBe('permission-blocked');
    expect(issueFromError('service-not-allowed')).toBe('unavailable');
    expect(issueFromError('network')).toBe('no-on-device');
    expect(issueFromError('no-speech')).toBeNull();
    expect(issueFromError('aborted')).toBeNull();
    expect(issueFromError(null)).toBeNull();
  });
});
