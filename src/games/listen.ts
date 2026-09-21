import { sentences } from '../engine';
import type { GameUnit } from './setup';

export interface Segment {
  text: string;
  chunkIndex: number;
  /** True for the first segment of a chunk (leave a gap above it). */
  chunkStart: boolean;
}

/**
 * Pieces read aloud one at a time so the screen can follow along: one per line, and a line
 * with several sentences is split further.
 */
export function buildSegments(units: GameUnit[]): Segment[] {
  const out: Segment[] = [];
  for (const unit of units) {
    let first = true;
    for (const line of unit.lines) {
      const parts = sentences({ index: unit.chunkIndex, lines: [line] });
      const pieces = parts.length ? parts : [line.text];
      for (const text of pieces) {
        out.push({ text, chunkIndex: unit.chunkIndex, chunkStart: first });
        first = false;
      }
    }
  }
  return out;
}

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** Text to speech rate for a chosen speed, relative to the user's base rate, kept in a range engines accept. */
export function effectiveRate(base: number, speed: number): number {
  return Math.min(3, Math.max(0.3, base * speed));
}
