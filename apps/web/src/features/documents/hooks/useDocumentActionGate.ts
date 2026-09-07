import { useCallback, useRef, useState } from 'react';

// A document lifecycle mutation is a two-step optimistic-concurrency operation:
// flush the editor draft, then mutate the returned version. This gate is both a
// synchronous mutex (for two clicks before React rerenders) and a render signal
// used to make the title/editor read-only for the complete sequence.
export function useDocumentActionGate() {
  const runningRef = useRef(false);
  const [pending, setPending] = useState(false);

  const run = useCallback(async <T>(action: () => Promise<T>): Promise<T | null> => {
    if (runningRef.current) return null;
    runningRef.current = true;
    setPending(true);
    try {
      return await action();
    } finally {
      runningRef.current = false;
      setPending(false);
    }
  }, []);

  return { pending, run };
}
