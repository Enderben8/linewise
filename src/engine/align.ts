import type { AlignItem, Token } from './types';

/** Largest table (in cells) filled in full. */
const FULL_LIMIT = 4_000_000;
/** How far a long alignment may stray from the diagonals between (0, 0) and (n, m). */
const BAND_SLACK = 150;

/**
 * Word-level Levenshtein alignment on `norm`.
 * Ties prefer match, then wrong (substitution), then missed, then extra.
 * Long inputs use a banded table so memory stays bounded.
 */
export function align(target: Token[], attempt: Token[]): AlignItem[] {
  // Trim the common prefix and suffix; most attempts are mostly right.
  let lo = 0;
  while (lo < target.length && lo < attempt.length && target[lo].norm === attempt[lo].norm) lo++;
  let tHi = target.length;
  let aHi = attempt.length;
  while (tHi > lo && aHi > lo && target[tHi - 1].norm === attempt[aHi - 1].norm) {
    tHi--;
    aHi--;
  }

  const result: AlignItem[] = [];
  for (let i = 0; i < lo; i++) result.push({ op: 'match', target: target[i], attempt: attempt[i] });
  result.push(...alignCore(target.slice(lo, tHi), attempt.slice(lo, aHi)));
  const tailLen = target.length - tHi;
  for (let k = 0; k < tailLen; k++) {
    result.push({ op: 'match', target: target[tHi + k], attempt: attempt[aHi + k] });
  }
  return result;
}

function alignCore(target: Token[], attempt: Token[]): AlignItem[] {
  const n = target.length;
  const m = attempt.length;
  if (n === 0) return attempt.map((a) => ({ op: 'extra' as const, attempt: a }));
  if (m === 0) return target.map((t) => ({ op: 'missed' as const, target: t }));

  // Row i keeps columns rowStart(i) .. rowStart(i) + width - 1. A short input keeps every column,
  // so the alignment is exact. A long one keeps only the diagonals (j - i) between the start (0)
  // and the end (m - n), plus some slack, unless every column takes less room than that band.
  const lowest = Math.min(0, m - n) - BAND_SLACK;
  const bandWidth = Math.abs(m - n) + 2 * BAND_SLACK + 1;
  const full = (n + 1) * (m + 1) <= FULL_LIMIT || m + 1 <= bandWidth;
  const width = full ? m + 1 : bandWidth;
  const rowStart = (i: number) => (full ? 0 : i + lowest);
  const at = (i: number, j: number) => i * width + (j - rowStart(i));
  const inBand = (i: number, j: number) => j - rowStart(i) >= 0 && j - rowStart(i) < width;
  // A cost never exceeds n + m, so 16-bit cells are enough for any text Linewise accepts.
  const INF = n + m + 1;
  const size = (n + 1) * width;
  const dp = INF < 0xffff ? new Uint16Array(size).fill(INF) : new Int32Array(size).fill(INF);

  dp[at(0, 0)] = 0;
  for (let i = 0; i <= n; i++) {
    const jMin = Math.max(0, rowStart(i));
    const jMax = Math.min(m, rowStart(i) + width - 1);
    for (let j = jMin; j <= jMax; j++) {
      if (i === 0 && j === 0) continue;
      let best = INF;
      if (i > 0 && j > 0 && inBand(i - 1, j - 1)) {
        const cost = target[i - 1].norm === attempt[j - 1].norm ? 0 : 1;
        best = dp[at(i - 1, j - 1)] + cost;
      }
      if (i > 0 && inBand(i - 1, j)) best = Math.min(best, dp[at(i - 1, j)] + 1);
      if (j > 0 && inBand(i, j - 1)) best = Math.min(best, dp[at(i, j - 1)] + 1);
      dp[at(i, j)] = best;
    }
  }

  const out: AlignItem[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const here = dp[at(i, j)];
    if (i > 0 && j > 0 && inBand(i - 1, j - 1)) {
      const same = target[i - 1].norm === attempt[j - 1].norm;
      if (dp[at(i - 1, j - 1)] + (same ? 0 : 1) === here) {
        out.push({
          op: same ? 'match' : 'wrong',
          target: target[i - 1],
          attempt: attempt[j - 1],
        });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && inBand(i - 1, j) && dp[at(i - 1, j)] + 1 === here) {
      out.push({ op: 'missed', target: target[i - 1] });
      i--;
      continue;
    }
    out.push({ op: 'extra', attempt: attempt[j - 1] });
    j--;
  }
  return out.reverse();
}

export interface AlignScore {
  matched: number;
  wrong: number;
  missed: number;
  extra: number;
  targetCount: number;
  /** matched / (target words + extra words), 0..1 */
  accuracy: number;
}

export function scoreAlignment(items: AlignItem[]): AlignScore {
  let matched = 0;
  let wrong = 0;
  let missed = 0;
  let extra = 0;
  for (const it of items) {
    if (it.op === 'match') matched++;
    else if (it.op === 'wrong') wrong++;
    else if (it.op === 'missed') missed++;
    else extra++;
  }
  const targetCount = matched + wrong + missed;
  const denom = targetCount + extra;
  return {
    matched,
    wrong,
    missed,
    extra,
    targetCount,
    accuracy: denom === 0 ? 0 : matched / denom,
  };
}
