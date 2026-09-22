import { phrases, sentences } from '../engine';
import { shuffle, type GameUnit } from './setup';
import { unitAsChunk } from './tokens';

/** Sentences of the selection; falls back to phrases when there are fewer than two sentences. */
export function scrambleItems(units: GameUnit[]): string[] {
  const s = units.flatMap((u) => sentences(unitAsChunk(u)));
  if (s.length >= 2) return s;
  return units.flatMap((u) => phrases(unitAsChunk(u)));
}

/** Splits items into consecutive rounds of about `size`; a leftover single item joins the previous round. */
export function buildRounds(items: string[], size = 6): string[][] {
  const rounds: string[][] = [];
  for (let i = 0; i < items.length; i += size) rounds.push(items.slice(i, i + size));
  if (rounds.length > 1 && rounds[rounds.length - 1].length < 2) {
    const last = rounds.pop() as string[];
    rounds[rounds.length - 1].push(...last);
  }
  return rounds;
}

/**
 * How many items of `order` (indexes into `items`) are in a right place. Repeated items, such as a
 * refrain, are interchangeable.
 */
export function correctPositions(order: readonly number[], items: readonly string[]): number {
  return order.filter((v, i) => items[v] === items[i]).length;
}

/** A shuffled order of `items` that does not already read in the right order (unless all are the same). */
export function scrambleOrder(
  items: readonly string[],
  rand: () => number = Math.random,
): number[] {
  const identity = items.map((_, i) => i);
  if (new Set(items).size < 2) return identity;
  for (let attempt = 0; attempt < 20; attempt++) {
    const order = shuffle(identity, rand);
    if (correctPositions(order, items) < items.length) return order;
  }
  // Moving the first item to the end changes how the items read unless they are all the same.
  return [...identity.slice(1), identity[0]];
}
