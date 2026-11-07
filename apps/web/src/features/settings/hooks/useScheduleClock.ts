import { useCallback, useEffect, useState } from 'react';

type ScheduleClock = 'utc' | 'local';

const STORAGE_KEY = 'schedule-clock';

// The clock schedules are written on: the one last picked in this browser, on any schedule input.
// The stored value is read in an effect, not in the state initializer: the initializer also runs
// during the server render, where there is no localStorage.
export function useScheduleClock() {
  const [clock, setClock] = useState<ScheduleClock>('utc');

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'local') setClock('local');
    } catch {
      // Storage unavailable (private mode): the input stays on UTC.
    }
  }, []);

  const pick = useCallback((next: ScheduleClock) => {
    setClock(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore write failures (private mode / quota); the state still updates.
    }
  }, []);

  return { clock, pick };
}
