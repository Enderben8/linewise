import { phrases, sentences } from '../engine';
import type { GameUnit } from './setup';
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

/** A shuffled order of 0..n-1 that is never the correct order (for n >= 2). */
export function scrambleOrder(n: number, rand: () => number = Math.random): number[] {
  const identity = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return identity;
  for (let attempt = 0; attempt < 20; attempt++) {
    const order = [...identity];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.some((v, i) => v !== i)) return order;
  }
  return [...identity.slice(1), identity[0]];
}

/** Number of items already in their correct position. */
export function correctPositions(order: number[]): number {
  return order.filter((v, i) => v === i).length;
}
