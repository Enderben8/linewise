export const GAME_IDS = [
  'tap-to-reveal',
  'slider',
  'listen',
  'first-letter',
  'fill-in-the-blank',
  'sentence-scramble',
  'type-it',
  'multiple-choice',
  'speak',
  'run-scene',
  'my-recordings',
] as const;

export type GameId = (typeof GAME_IDS)[number];
export type GameGroup = 'practice' | 'solidify' | 'evaluate';

export const GAME_GROUP: Record<GameId, GameGroup> = {
  'tap-to-reveal': 'practice',
  slider: 'practice',
  listen: 'practice',
  'my-recordings': 'practice',
  'first-letter': 'solidify',
  'fill-in-the-blank': 'solidify',
  'sentence-scramble': 'solidify',
  'type-it': 'evaluate',
  'multiple-choice': 'evaluate',
  speak: 'evaluate',
  'run-scene': 'evaluate',
};

export const SCORED_GAMES = GAME_IDS.filter((g) => GAME_GROUP[g] !== 'practice');

export function isScored(game: GameId): boolean {
  return GAME_GROUP[game] !== 'practice';
}

export interface SessionResult {
  game: GameId;
  accuracy: number;
  /** words practised / total words */
  coverage: number;
  /** accuracy * coverage */
  weightedScore: number;
  chunkRange: [number, number];
}

export function makeResult(
  game: GameId,
  accuracy: number,
  practisedWords: number,
  totalWords: number,
  chunkRange: [number, number],
): SessionResult {
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const acc = clamp(accuracy);
  const coverage = totalWords <= 0 ? 0 : clamp(practisedWords / totalWords);
  return { game, accuracy: acc, coverage, weightedScore: acc * coverage, chunkRange };
}
