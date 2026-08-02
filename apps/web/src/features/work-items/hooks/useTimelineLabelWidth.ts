import { useCallback, useEffect, useState } from 'react';
import { LABEL_MAX_W, LABEL_MIN_W, LABEL_W } from '../utils/timeline';

// Width of the Timeline's label column, dragged by the header's resize handle and
// stored under `storageKey` (see labelWidthKey: one width per project and view).
// Reloads when the key changes, so switching tabs picks up that tab's width.
//
// The stored value is read in an effect, not in the state initializer: the
// initializer also runs in the server render, where a client-only value would not
// match the markup.
export function useTimelineLabelWidth(storageKey: string): {
  width: number;
  setWidth: (width: number) => void;
} {
  const [width, setStored] = useState(LABEL_W);

  useEffect(() => {
    setStored(load(storageKey));
  }, [storageKey]);

  const setWidth = useCallback(
    (next: number) => {
      const clamped = clamp(next);
      setStored(clamped);
      try {
        localStorage.setItem(storageKey, String(clamped));
      } catch {
        // ignore write failures (private mode / quota); the width still applies.
      }
    },
    [storageKey],
  );

  return { width, setWidth };
}

function load(storageKey: string): number {
  try {
    const stored = Number(localStorage.getItem(storageKey));
    return stored ? clamp(stored) : LABEL_W;
  } catch {
    return LABEL_W;
  }
}

function clamp(width: number): number {
  return Math.min(LABEL_MAX_W, Math.max(LABEL_MIN_W, Math.round(width)));
}
