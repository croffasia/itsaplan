import { useSyncExternalStore } from 'react';

// True on phone-width viewports, matching the app's Tailwind `sm` breakpoint
// (640px). Below it the project views disable drag so a touch scrolls the list.
const QUERY = '(max-width: 639px)';

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

export function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
