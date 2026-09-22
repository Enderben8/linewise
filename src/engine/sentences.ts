import type { Chunk } from './types';
import { chunkLines } from './words';

// Includes the Arabic question mark and the Devanagari danda, which end sentences in ar and hi.
const SENTENCE_END = /[.!?…。！？؟।॥]/;
const CLOSERS = /["'”’)\]»」』]/;
const PHRASE_DELIMS = /[,;:，；：、،؛]/;

function splitSentences(text: string): string[] {
  const out: string[] = [];
  let buf = '';
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    buf += chars[i];
    if (SENTENCE_END.test(chars[i])) {
      // Consume repeated terminators and closing quotes, as in: Really?!"
      while (
        i + 1 < chars.length &&
        (SENTENCE_END.test(chars[i + 1]) || CLOSERS.test(chars[i + 1]))
      ) {
        buf += chars[++i];
      }
      const next = chars[i + 1];
      const cjk = /[。！？]/.test(chars[i]);
      if (next === undefined || /\s/.test(next) || cjk) {
        out.push(buf.trim());
        buf = '';
      }
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

/** Sentences of a chunk. Sentences may span the line breaks of a poem. */
export function sentences(chunk: Chunk): string[] {
  return splitSentences(chunkLines(chunk).join(' '));
}

/** Phrases: split after , ; : and at line breaks. Delimiters stay attached. */
export function phrases(chunk: Chunk): string[] {
  const out: string[] = [];
  for (const line of chunkLines(chunk)) {
    let buf = '';
    for (const ch of Array.from(line)) {
      buf += ch;
      if (PHRASE_DELIMS.test(ch)) {
        if (buf.trim()) out.push(buf.trim());
        buf = '';
      }
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out;
}
