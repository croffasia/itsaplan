import { useCallback, useEffect, useState } from 'react';

// Whether a collapsible section is open, remembered in localStorage under
// `storageKey`. A section starts open, so only a closed one is stored.
//
// The stored value is read in an effect, not in the state initializer: the
// initializer also runs during the server render, where there is no localStorage,
// and a client-only initial value would not match the server markup.
export function usePersistedOpen(storageKey: string) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(storageKey) !== 'closed');
    } catch {
      // Storage unavailable (private mode): the section stays open.
    }
  }, [storageKey]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? 'open' : 'closed');
      } catch {
        // Ignore write failures (private mode / quota); the state still updates.
      }
      return next;
    });
  }, [storageKey]);

  return { open, toggle };
}
