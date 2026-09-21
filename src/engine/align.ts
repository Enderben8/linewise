import type { AlignItem, Token } from './types';

const FULL_LIMIT = 4_000_000;

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

  const band = n * m <= FULL_LIMIT ? Math.max(n, m) : Math.abs(n - m) + 150;
  const width = 2 * band + 1;
  const INF = 1 << 28;
  const dp = new Int32Array((n + 1) * width).fill(INF);
  const at = (i: number, j: number) => i * width + (j - i + band);
  const inBand = (i: number, j: number) => Math.abs(j - i) <= band;

  dp[at(0, 0)] = 0;
  for (let i = 0; i <= n; i++) {
    const jMin = Math.max(0, i - band);
    const jMax = Math.min(m, i + band);
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
