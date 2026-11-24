import { useEffect, useState } from 'react';

export type PaletteSearchScope = 'current' | 'all';

const STORAGE_KEY = 'command-palette:search-scope';

// Which projects the palette searches while a project is open, remembered for this
// browser. Read in an effect: the initializer also runs in the server render, where
// there is no localStorage.
export function usePaletteSearchScope() {
  const [scope, setStoredScope] = useState<PaletteSearchScope>('all');

  useEffect(() => {
    try {
      setStoredScope(localStorage.getItem(STORAGE_KEY) === 'current' ? 'current' : 'all');
    } catch {
      setStoredScope('all');
    }
  }, []);

  function setScope(next: PaletteSearchScope) {
    setStoredScope(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies when browser storage is unavailable.
    }
  }

  return { scope, setScope };
}
