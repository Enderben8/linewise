import { phrases, words } from '../engine';
import { pickDistractors, shuffle, trimPunctuation, type GameUnit } from './setup';
import { unitAsChunk } from './tokens';

export interface McQuestion {
  level: 'phrase' | 'word';
  /** What has been said so far (the end of it). */
  context: string;
  correct: string;
  options: string[];
  correctIndex: number;
}

function sampleIndexes(from: number, to: number, max: number): number[] {
  const count = to - from;
  if (count <= max) return Array.from({ length: count }, (_, i) => from + i);
  return Array.from({ length: max }, (_, i) => from + Math.floor((i * count) / max));
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
          .flatMap((u) =>
            u.lines.flatMap((l) => words(l.text, lang).map((t) => trimPunctuation(t.text))),
          )
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
      context: contextItems.join(' '),
      correct,
      options,
      correctIndex: options.indexOf(correct),
    });
  }
  return questions;
}
