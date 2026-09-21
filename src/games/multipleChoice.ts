import { phrases, words } from '../engine';
import { shuffle, type GameUnit } from './setup';
import { unitAsChunk } from './tokens';

export interface McQuestion {
  level: 'phrase' | 'word';
  /** What has been said so far (the end of it). */
  context: string;
  correct: string;
  options: string[];
  correctIndex: number;
}

const strip = (s: string) => s.replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '');

function sampleIndexes(from: number, to: number, max: number): number[] {
  const count = to - from;
  if (count <= max) return Array.from({ length: count }, (_, i) => from + i);
  return Array.from({ length: max }, (_, i) => from + Math.floor((i * count) / max));
}

function pickDistractors(correct: string, pool: string[], rand: () => number, n: number): string[] {
  const seen = new Set([correct.toLowerCase()]);
  const unique: string[] = [];
  for (const p of pool) {
    const k = p.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(p);
    }
  }
  // Prefer look-alikes: similar length reads as a fair alternative.
  const near = [...unique].sort(
    (a, b) => Math.abs(a.length - correct.length) - Math.abs(b.length - correct.length),
  );
  return shuffle(near.slice(0, Math.max(n * 3, n)), rand).slice(0, n);
}

/**
 * Builds "what comes next?" questions. Uses phrases when the text has enough of them,
 * otherwise single words. At most `max` questions, spread evenly over the selection.
 */
export function buildQuestions(
  units: GameUnit[],
  lang: string,
  rand: () => number = Math.random,
  max = 10,
): McQuestion[] {
  const phraseList = units.flatMap((u) => phrases(unitAsChunk(u)));
  const level: 'phrase' | 'word' = phraseList.length >= 5 ? 'phrase' : 'word';
  const seq =
    level === 'phrase'
      ? phraseList
      : units
          .flatMap((u) => u.lines.flatMap((l) => words(l.text, lang).map((t) => strip(t.text))))
          .filter(Boolean);
  if (seq.length < 3) return [];

  const questions: McQuestion[] = [];
  for (const i of sampleIndexes(1, seq.length, max)) {
    const correct = seq[i];
    const distractors = pickDistractors(correct, seq, rand, 3);
    if (distractors.length < 1) continue;
    const options = shuffle([correct, ...distractors], rand);
    const contextItems = seq.slice(Math.max(0, i - (level === 'phrase' ? 2 : 8)), i);
    questions.push({
      level,
      context: contextItems.join(level === 'phrase' ? ' ' : ' '),
      correct,
      options,
      correctIndex: options.indexOf(correct),
    });
  }
  return questions;
}
