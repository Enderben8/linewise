import { useCallback, useRef, useState } from 'react';
import type { ApplyOutcome } from '../scheduler';
import { useAppDispatch } from '../store';
import { completeSession } from '../store/sessionThunks';
import type { SessionResult } from './ids';

export interface Finished {
  result: SessionResult;
  outcome: ApplyOutcome | null;
}

/** Saves a finished scored session once and remembers the result so the screen can show it. */
export function useScoredGame(memorizationId: string | undefined) {
  const dispatch = useAppDispatch();
  const [finished, setFinished] = useState<Finished | null>(null);
  const saving = useRef(false);

  const finish = useCallback(
    async (result: SessionResult) => {
      if (!memorizationId || saving.current) return;
      saving.current = true;
      try {
        const outcome = await dispatch(completeSession(memorizationId, result));
        setFinished({ result, outcome });
      } finally {
        saving.current = false;
      }
    },
    [dispatch, memorizationId],
  );

  const reset = useCallback(() => setFinished(null), []);
  return { finished, finish, reset };
}
