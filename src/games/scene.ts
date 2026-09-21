import { words, type Chunk } from '../engine';
import { selectionRange, type ChunkSelection } from './setup';

export interface SceneStep {
  kind: 'line' | 'action';
  /** Empty for action cues and unattributed text (spoken by the narrator). */
  speaker: string;
  text: string;
  chunkIndex: number;
}

/** The scene as it is played: speaker labels drop out, each dialogue line carries its speaker. */
export function buildScene(chunks: Chunk[], sel: ChunkSelection): SceneStep[] {
  const [from, to] = selectionRange(sel, chunks.length);
  const steps: SceneStep[] = [];
  for (const chunk of chunks.slice(from, to + 1)) {
    for (const line of chunk.lines) {
      if (line.kind === 'speaker') continue;
      if (line.kind === 'action') {
        steps.push({ kind: 'action', speaker: '', text: line.text, chunkIndex: chunk.index });
      } else {
        steps.push({
          kind: 'line',
          speaker: line.speaker ?? '',
          text: line.text,
          chunkIndex: chunk.index,
        });
      }
    }
  }
  return steps;
}

/** Roles that speak in the scene, in order of first appearance. */
export function rolesOf(steps: SceneStep[]): string[] {
  const out: string[] = [];
  for (const s of steps) {
    if (s.kind === 'line' && s.speaker && !out.includes(s.speaker)) out.push(s.speaker);
  }
  return out;
}

/** Words the user has to say for a role. */
export function roleWordCount(steps: SceneStep[], role: string, lang: string): number {
  return steps
    .filter((s) => s.kind === 'line' && s.speaker === role)
    .reduce((n, s) => n + words(s.text, lang).length, 0);
}

const PITCHES = [1, 0.85, 1.2, 0.95, 1.1, 0.8];

/** A stable pitch per role so voices sound different even when the phone has only one. */
export function pitchFor(role: string, roles: string[]): number {
  if (!role) return 1;
  const i = Math.max(0, roles.indexOf(role));
  return PITCHES[i % PITCHES.length];
}

/** Voice for a role: its override, or the default voice. The narrator is the empty string. */
export function voiceFor(
  role: string,
  overrides: Record<string, string>,
  fallback: string | null,
): string | null {
  return overrides[role] ?? fallback;
}
