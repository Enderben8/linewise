import type { Token } from '../engine';

/** Lowercase, accent-free form of one character, so typing "e" matches "é". */
export function baseLetter(ch: string): string {
  return ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function firstChar(s: string): string {
  return Array.from(s)[0] ?? '';
}

/** Does the typed character match the first letter of the word? Numbers match either the digit or the spoken form. */
export function firstLetterMatches(typed: string, token: Token): boolean {
  const t = baseLetter(firstChar(typed.trim()));
  if (!t) return false;
  const fromNorm = baseLetter(firstChar(token.norm));
  const fromText = baseLetter(firstChar(token.text.replace(/^[^\p{L}\p{N}]+/u, '')));
  return t === fromNorm || t === fromText;
}

export type Mark = 'ok' | 'wrong';

export interface FirstLetterState {
  index: number;
  marks: Mark[];
}

export const initialFirstLetter: FirstLetterState = { index: 0, marks: [] };

/** Records one typed letter. A wrong letter is marked and the game moves on. */
export function typeLetter(
  state: FirstLetterState,
  typed: string,
  tokens: Token[],
): { state: FirstLetterState; correct: boolean } | null {
  const token = tokens[state.index];
  if (!token || !firstChar(typed.trim())) return null;
  const correct = firstLetterMatches(typed, token);
  return {
    correct,
    state: { index: state.index + 1, marks: [...state.marks, correct ? 'ok' : 'wrong'] },
  };
}

export function isFinished(state: FirstLetterState, total: number): boolean {
  return state.index >= total;
}

export function accuracyOf(state: FirstLetterState): number {
  if (state.marks.length === 0) return 0;
  return state.marks.filter((m) => m === 'ok').length / state.marks.length;
}
