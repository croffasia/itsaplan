import { useCallback, useEffect, useState } from 'react';

// A Set<string> of keys persisted in localStorage under `storageKey`, used for
// client-only per-project preferences like hidden columns and collapsed sections.
// Reloads when `storageKey` changes (e.g. the project or grouping field switches),
// so each project+field remembers its own set independently.
//
// The stored values are read in an effect, not in the state initializer: the
// initializer also runs during the server render, where there is no localStorage,
// and a client-only initial value would not match the server markup.
export function usePersistedSet(storageKey: string) {
  const [values, setValues] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setValues(load(storageKey));
  }, [storageKey]);

  const update = useCallback(
    (change: (next: Set<string>) => void) => {
      setValues((prev) => {
        const next = new Set(prev);
        change(next);
        try {
          localStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {
          // ignore write failures (private mode / quota); state still updates.
        }
        return next;
      });
    },
    [storageKey],
  );

  // Adds `key` when `member` is true, removes it otherwise.
  const setMember = useCallback(
    (key: string, member: boolean) => update((next) => (member ? next.add(key) : next.delete(key))),
    [update],
  );

  const toggle = useCallback(
    (key: string) => update((next) => (next.has(key) ? next.delete(key) : next.add(key))),
    [update],
  );

  return { values, setMember, toggle };
}

function load(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}
