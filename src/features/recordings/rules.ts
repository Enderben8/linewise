import { LIMITS } from '../../config';

/** Key inside `progress.voice_overrides` that stores which recording Listen should play. */
export const LISTEN_SOURCE_KEY = '__listen_source';

export function canAddRecording(count: number): boolean {
  return count < LIMITS.maxRecordingsPerMemorization;
}

/** True when the text changed after the recording was made, so it may no longer match the words. */
export function isOutOfDate(recordingBodyHash: string, currentBodyHash: string): boolean {
  return recordingBodyHash !== currentBodyHash;
}

export function defaultRecordingName(existingNames: string[], base: string): string {
  let n = existingNames.length + 1;
  let name = `${base} ${n}`;
  while (existingNames.includes(name)) name = `${base} ${++n}`;
  return name;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Picks the source Listen should use: the saved recording if it still exists, otherwise text to speech. */
export function listenSource(
  overrides: Record<string, string>,
  recordingIds: string[],
): { kind: 'recording'; id: string } | { kind: 'tts' } {
  const id = overrides[LISTEN_SOURCE_KEY];
  return id && recordingIds.includes(id) ? { kind: 'recording', id } : { kind: 'tts' };
}
