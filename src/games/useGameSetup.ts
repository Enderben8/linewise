import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import type { MemorizationWithProgress } from '../db/repo';
import { useAppSelector } from '../store';
import {
  buildUnits,
  countWords,
  selectionRange,
  totalWords,
  type ChunkSelection,
  type GameUnit,
  type SelectionMode,
} from './setup';

export interface GameSetup {
  mem: MemorizationWithProgress;
  selection: ChunkSelection;
  units: GameUnit[];
  range: [number, number];
  lang: string;
  /** Words in the selection. */
  selectionWords: number;
  /** Words in the whole text (or the focus speaker's lines). */
  totalWords: number;
}

export interface SelectionParams extends Record<string, string> {
  id: string;
  mode: SelectionMode;
  from: string;
  to: string;
  speaker: string;
}

export function selectionToParams(id: string, sel: ChunkSelection): SelectionParams {
  return {
    id,
    mode: sel.mode,
    from: String(sel.from),
    to: String(sel.to),
    speaker: sel.speaker ?? '',
  };
}

export function paramsToSelection(
  p: Partial<Record<keyof SelectionParams, string>>,
): ChunkSelection {
  const mode: SelectionMode = p.mode === 'one' || p.mode === 'range' ? p.mode : 'all';
  const from = Number.parseInt(p.from ?? '0', 10);
  const to = Number.parseInt(p.to ?? '0', 10);
  return {
    mode,
    from: Number.isFinite(from) ? from : 0,
    to: Number.isFinite(to) ? to : 0,
    speaker: p.speaker ? p.speaker : undefined,
  };
}

/** Reads the memorization and chunk selection for a game screen from its route params. */
export function useGameSetup(): GameSetup | null {
  const params = useLocalSearchParams() as Partial<Record<keyof SelectionParams, string>>;
  const items = useAppSelector((s) => s.memorizations.items);
  const mem = items.find((m) => m.id === params.id) ?? null;
  const { mode, from, to, speaker } = params;

  return useMemo(() => {
    if (!mem) return null;
    const selection = paramsToSelection({ mode, from, to, speaker });
    const units = buildUnits(mem.chunks, selection);
    return {
      mem,
      selection,
      units,
      range: selectionRange(selection, mem.chunks.length),
      lang: mem.language,
      selectionWords: countWords(units, mem.language),
      totalWords: totalWords(mem.chunks, mem.language, selection.speaker),
    };
  }, [mem, mode, from, to, speaker]);
}
