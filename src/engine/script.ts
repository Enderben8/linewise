import type { BodyType, Chunk, Line, ScriptIssue } from './types';

const ACTION_RE = /^\s*(\(.*\)|\[.*\])\s*$/;

export function isActionLine(line: string): boolean {
  return ACTION_RE.test(line);
}

const COLON = /[:：]$/;

/**
 * A speaker line is alone on a line. In scripts with capital letters it must be ALL CAPS
 * ("HAMLET", "LADY MACBETH:"). Scripts without case (Arabic, Hebrew, Hindi, Chinese) cannot use
 * capitals, so there the name must end with a colon ("هاملت:", "哈姆雷特：").
 */
export function isSpeakerLine(line: string): boolean {
  let t = line.trim();
  if (!t || isActionLine(t)) return false;
  const colon = COLON.test(t);
  if (colon) t = t.slice(0, -1).trim();
  if (!t) return false;
  if (/[.!?,;…"。！？，；]$/.test(t)) return false;
  if (t.split(/\s+/).length > 4 || t.length > 40) return false;
  const cased = t !== t.toLowerCase() || t !== t.toUpperCase();
  if (cased) return t === t.toUpperCase();
  return colon && /\p{L}/u.test(t);
}

export function speakerName(line: string): string {
  let t = line.trim();
  if (COLON.test(t)) t = t.slice(0, -1).trim();
  return t;
}

/** Splits into blocks separated by blank lines, remembering each line's 1-based number. */
function blocks(body: string): { text: string; line: number }[][] {
  const out: { text: string; line: number }[][] = [];
  let current: { text: string; line: number }[] = [];
  body
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach((raw, i) => {
      if (raw.trim() === '') {
        if (current.length) out.push(current);
        current = [];
      } else {
        current.push({ text: raw.trim(), line: i + 1 });
      }
    });
  if (current.length) out.push(current);
  return out;
}

export function parseBody(body: string, type: BodyType): Chunk[] {
  let speaker: string | undefined;
  return blocks(body).map((block, index) => {
    const lines: Line[] = block.map(({ text }): Line => {
      if (type === 'text') return { kind: 'text', text };
      if (isActionLine(text)) return { kind: 'action', text };
      if (isSpeakerLine(text)) {
        speaker = speakerName(text);
        return { kind: 'speaker', text: speaker, speaker };
      }
      return speaker ? { kind: 'dialogue', text, speaker } : { kind: 'text', text };
    });
    return { index, lines };
  });
}

function looksLikeSpeaker(text: string): boolean {
  let t = text.trim();
  if (isSpeakerLine(t) || isActionLine(t)) return false;
  const colon = t.endsWith(':');
  if (colon) t = t.slice(0, -1).trim();
  if (!t || /[.!?,;…"]$/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 3) return false;
  const capitalised = words.every((w) => w[0] !== w[0].toLowerCase());
  return colon || capitalised;
}

/** Warns about likely script formatting mistakes. Line numbers are 1-based. */
export function validateScript(body: string): ScriptIssue[] {
  const issues: ScriptIssue[] = [];
  const all = blocks(body);
  const hasSpeakers = all.some((b) => b.some((l) => isSpeakerLine(l.text)));
  for (const block of all) {
    block.forEach((entry, i) => {
      if (isSpeakerLine(entry.text)) {
        const next = block[i + 1];
        if (!next || isSpeakerLine(next.text)) {
          issues.push({ line: entry.line, code: 'SPEAKER_NO_DIALOGUE' });
        }
      } else if (i === 0 && block.length > 1 && hasSpeakers && looksLikeSpeaker(entry.text)) {
        issues.push({ line: entry.line, code: 'LOOKS_LIKE_SPEAKER' });
      }
    });
  }
  return issues.sort((a, b) => a.line - b.line);
}
