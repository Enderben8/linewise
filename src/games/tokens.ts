import { words, type Chunk, type Token } from '../engine';
import type { GameUnit } from './setup';

export interface TokenLine {
  /** Chunk the line belongs to. */
  chunkIndex: number;
  /** Position of the line's first word among all words of the selection. */
  start: number;
  tokens: Token[];
  /** First line of a new chunk (draw a gap above it). */
  chunkStart: boolean;
}

export interface TokenizedUnits {
  lines: TokenLine[];
  /** Every token of the selection in order. */
  all: Token[];
}

/** Tokenises the selection line by line, numbering words across the whole selection. */
export function tokenizeUnits(units: GameUnit[], lang: string): TokenizedUnits {
  const lines: TokenLine[] = [];
  const all: Token[] = [];
  for (const unit of units) {
    unit.lines.forEach((line, i) => {
      const tokens = words(line.text, lang);
      if (!tokens.length) return;
      lines.push({ chunkIndex: unit.chunkIndex, start: all.length, tokens, chunkStart: i === 0 });
      all.push(...tokens);
    });
  }
  return { lines, all };
}

/** A GameUnit as the Chunk shape the engine's sentence and phrase splitters expect. */
export function unitAsChunk(unit: GameUnit): Chunk {
  return { index: unit.chunkIndex, lines: unit.lines };
}
