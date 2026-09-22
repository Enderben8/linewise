import { words, type Chunk } from '../engine';
import {
  hiddenIndexes,
  memorisable,
  pickDistractors,
  seededRandom,
  shuffle,
  selectionRange,
  trimPunctuation,
  type ChunkSelection,
} from './setup';
import type { TokenLine } from './tokens';

export interface KeyedLine extends TokenLine {
  /** Stable key per token: `${chunkIndex}:${wordIndexInChunk}`. Survives changing the selection or focus speaker. */
  keys: string[];
}

/**
 * Tokenises the selection with keys that only depend on the chunk's text, so the words a user
 * chose to hide stay hidden whatever range or speaker is selected. Keys are numbered across all
 * memorisable lines of the chunk, including other speakers' lines.
 */
export function keyedLines(chunks: Chunk[], sel: ChunkSelection, lang: string): KeyedLine[] {
  const [from, to] = selectionRange(sel, chunks.length);
  const out: KeyedLine[] = [];
  let globalIndex = 0;
  for (const chunk of chunks.slice(from, to + 1)) {
    let wordInChunk = 0;
    let firstInChunk = true;
    for (const line of chunk.lines) {
      if (line.kind !== 'text' && line.kind !== 'dialogue') continue;
      const tokens = words(line.text, lang);
      const keys = tokens.map((_, i) => `${chunk.index}:${wordInChunk + i}`);
      wordInChunk += tokens.length;
      if (!memorisable(line, sel.speaker) || tokens.length === 0) continue;
      out.push({
        chunkIndex: chunk.index,
        start: globalIndex,
        tokens,
        keys,
        chunkStart: firstInChunk,
      });
      firstInChunk = false;
      globalIndex += tokens.length;
    }
  }
  return out;
}

export function allKeys(lines: KeyedLine[]): string[] {
  return lines.flatMap((l) => l.keys);
}

/** Picks roughly `percent` of the keys to hide, spread by a seeded shuffle so it is stable. */
export function autoHide(keys: string[], percent: number, seed: number): string[] {
  const chosen = hiddenIndexes(keys.length, percent, seed);
  return keys.filter((_, i) => chosen.has(i));
}

/**
 * Answer choices for one blank: the right word (without its punctuation) plus look-alike words from
 * the same text.
 */
export function blankOptions(correct: string, pool: string[], seed: number, count = 4): string[] {
  const rand = seededRandom(seed);
  const right = trimPunctuation(correct);
  const distractors = pickDistractors(right, pool.map(trimPunctuation), rand, count - 1);
  return shuffle([right, ...distractors], rand);
}
