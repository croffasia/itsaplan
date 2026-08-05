import { useCallback, useEffect, useState } from 'react';

export type CyclesView = 'table' | 'timeline';

const storageKey = (projectKey: string) => `cycles-view:${projectKey}`;

// Which layout the cycles list opens in, remembered per project. The stored value
// is read in an effect rather than in the state initializer, which also runs in the
// server render where there is no localStorage.
export function useCyclesView(projectKey: string) {
  const [view, setView] = useState<CyclesView>('table');

  useEffect(() => {
    try {
      setView(localStorage.getItem(storageKey(projectKey)) === 'timeline' ? 'timeline' : 'table');
    } catch {
      // Storage unavailable (private mode): the list opens as a table.
    }
  }, [projectKey]);

  const change = useCallback(
    (next: CyclesView) => {
      setView(next);
      try {
        localStorage.setItem(storageKey(projectKey), next);
      } catch {
        // ignore write failures (private mode / quota); the view still switches.
      }
    },
    [projectKey],
  );

  return { view, setView: change };
}
