import { words, type Chunk, type Line } from '../engine';

export type SelectionMode = 'one' | 'range' | 'all';

export interface ChunkSelection {
  mode: SelectionMode;
  /** 0-based first chunk (inclusive). */
  from: number;
  /** 0-based last chunk (inclusive). */
  to: number;
  /** Scripts only: practise only this speaker's lines. */
  speaker?: string;
}

/** One chunk's worth of memorisable lines (text and dialogue), after any speaker filter. */
export interface GameUnit {
  chunkIndex: number;
  lines: Line[];
}

export function clampSelection(sel: ChunkSelection, chunkCount: number): ChunkSelection {
  const last = Math.max(0, chunkCount - 1);
  if (sel.mode === 'all') return { ...sel, from: 0, to: last };
  const from = Math.min(Math.max(0, sel.from), last);
  if (sel.mode === 'one') return { ...sel, from, to: from };
  const to = Math.min(Math.max(from, sel.to), last);
  return { ...sel, from, to };
}

export function selectionRange(sel: ChunkSelection, chunkCount: number): [number, number] {
  const c = clampSelection(sel, chunkCount);
  return [c.from, c.to];
}

export function speakersOf(chunks: Chunk[]): string[] {
  const seen: string[] = [];
  for (const c of chunks) {
    for (const l of c.lines) {
      if (l.kind === 'speaker' && l.speaker && !seen.includes(l.speaker)) seen.push(l.speaker);
    }
  }
  return seen;
}

export function memorisable(line: Line, speaker?: string): boolean {
  if (line.kind !== 'text' && line.kind !== 'dialogue') return false;
  return !speaker || line.speaker === speaker;
}

export function buildUnits(chunks: Chunk[], sel: ChunkSelection): GameUnit[] {
  const [from, to] = selectionRange(sel, chunks.length);
  const units: GameUnit[] = [];
  for (const chunk of chunks.slice(from, to + 1)) {
    const lines = chunk.lines.filter((l) => memorisable(l, sel.speaker));
    if (lines.length) units.push({ chunkIndex: chunk.index, lines });
  }
  return units;
}

export function countWords(units: GameUnit[], lang: string): number {
  return units.reduce((n, u) => n + u.lines.reduce((m, l) => m + words(l.text, lang).length, 0), 0);
}

/** Words in the whole text (or one speaker's lines): the denominator of `coverage`. */
export function totalWords(chunks: Chunk[], lang: string, speaker?: string): number {
  const all = buildUnits(chunks, { mode: 'all', from: 0, to: chunks.length - 1, speaker });
  return countWords(all, lang);
}

export function unitsText(units: GameUnit[]): string {
  return units.map((u) => u.lines.map((l) => l.text).join('\n')).join('\n');
}

/** Deterministic PRNG so shuffles and hidden words stay stable while a screen is open. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Which of `total` words are hidden at `percent` (0-100). Raising percent only ever hides more. */
export function hiddenIndexes(total: number, percent: number, seed: number): Set<number> {
  const order = shuffle(
    Array.from({ length: total }, (_, i) => i),
    seededRandom(seed),
  );
  const count = Math.round((Math.min(100, Math.max(0, percent)) / 100) * total);
  return new Set(order.slice(0, count));
}
