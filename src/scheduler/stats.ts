import type { GameId } from '../games/ids';
import { isScored } from '../games/ids';

export interface StatSession {
  game: GameId;
  weightedScore: number;
  createdAt: number;
}

export interface DayStats {
  day: number; // 1-31
  count: number;
  sessions: StatSession[];
}

/** Scored sessions grouped by day of the given month (month is 0-based, local time). Returns one entry per day. */
export function monthStats(
  sessions: readonly StatSession[],
  year: number,
  month: number,
): DayStats[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: DayStats[] = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    count: 0,
    sessions: [],
  }));
  for (const s of sessions) {
    if (!isScored(s.game)) continue;
    const d = new Date(s.createdAt);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const entry = days[d.getDate() - 1];
    entry.count += 1;
    entry.sessions.push(s);
  }
  for (const d of days) d.sessions.sort((a, b) => a.createdAt - b.createdAt);
  return days;
}
