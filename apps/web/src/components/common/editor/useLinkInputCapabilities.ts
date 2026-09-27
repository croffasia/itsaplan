import { useSyncExternalStore } from 'react';

const compactQuery = '(pointer: coarse), (hover: none)';
const explicitQuery = '(pointer: coarse), (hover: none), (any-pointer: coarse)';
let penAvailable = false;

function subscribe(notify: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const queries = [window.matchMedia(compactQuery), window.matchMedia(explicitQuery)];
  const pointer = (event: PointerEvent) => {
    if (event.pointerType !== 'pen') return;
    penAvailable = true;
    notify();
  };
  for (const query of queries) query.addEventListener('change', notify);
  window.addEventListener('pointerdown', pointer, true);
  return () => {
    for (const query of queries) query.removeEventListener('change', notify);
    window.removeEventListener('pointerdown', pointer, true);
  };
}

function snapshot() {
  if (typeof window.matchMedia !== 'function') return 'none';
  if (window.matchMedia(compactQuery).matches) return 'compact';
  return penAvailable || window.matchMedia(explicitQuery).matches ? 'explicit' : 'none';
}

export function useLinkInputCapabilities() {
  const value = useSyncExternalStore(subscribe, snapshot, () => 'none');
  return { compact: value === 'compact', explicit: value !== 'none' };
}
