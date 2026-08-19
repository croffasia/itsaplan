import { useCallback, useEffect, useState } from 'react';

// A width the user drags, clamped to [min, max] and stored under `storageKey`
// (see labelWidthKey, cycleLabelWidthKey and propertiesWidthKey for what each
// width is scoped to). Reloads when the key changes, so switching tab or project
// picks up its own width.
//
// The stored value is read in an effect, not in the state initializer: the
// initializer also runs in the server render, where a client-only value would not
// match the markup.
export function usePersistedWidth(
  storageKey: string,
  initial: number,
  min: number,
  max: number,
): { width: number; setWidth: (width: number) => void } {
  const [width, setStored] = useState(initial);

  useEffect(() => {
    setStored(load(storageKey, initial, min, max));
  }, [storageKey, initial, min, max]);

  const setWidth = useCallback(
    (next: number) => {
      const clamped = clamp(next, min, max);
      setStored(clamped);
      try {
        localStorage.setItem(storageKey, String(clamped));
      } catch {
        // ignore write failures (private mode / quota); the width still applies.
      }
    },
    [storageKey, min, max],
  );

  return { width, setWidth };
}

function load(storageKey: string, initial: number, min: number, max: number): number {
  try {
    const stored = Number(localStorage.getItem(storageKey));
    return stored ? clamp(stored, min, max) : initial;
  } catch {
    return initial;
  }
}

function clamp(width: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(width)));
}
