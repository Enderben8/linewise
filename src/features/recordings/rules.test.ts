import { LIMITS } from '../../config';
import {
  LISTEN_SOURCE_KEY,
  canAddRecording,
  defaultRecordingName,
  formatDuration,
  isOutOfDate,
  listenSource,
} from './rules';

describe('recording rules', () => {
  it('limits recordings per memorization', () => {
    expect(canAddRecording(LIMITS.maxRecordingsPerMemorization - 1)).toBe(true);
    expect(canAddRecording(LIMITS.maxRecordingsPerMemorization)).toBe(false);
  });

  it('flags recordings made before the text changed', () => {
    expect(isOutOfDate('a', 'a')).toBe(false);
    expect(isOutOfDate('a', 'b')).toBe(true);
  });

  it('names recordings without clashes', () => {
    expect(defaultRecordingName([], 'Take')).toBe('Take 1');
    expect(defaultRecordingName(['Take 1', 'Take 2'], 'Take')).toBe('Take 3');
    expect(defaultRecordingName(['Take 2'], 'Take')).toBe('Take 3');
  });

  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65.4)).toBe('1:05');
    expect(formatDuration(600)).toBe('10:00');
  });

  it('falls back to text to speech when the chosen recording is gone', () => {
    expect(listenSource({ [LISTEN_SOURCE_KEY]: 'r1' }, ['r1', 'r2'])).toEqual({
      kind: 'recording',
      id: 'r1',
    });
    expect(listenSource({ [LISTEN_SOURCE_KEY]: 'gone' }, ['r1'])).toEqual({ kind: 'tts' });
    expect(listenSource({}, ['r1'])).toEqual({ kind: 'tts' });
  });
});
