import { useEffect, useState } from 'react';

// Returns a copy of `value` that only updates after it has stayed unchanged for
// `delayMs`. Used to debounce a fast-changing input (a search box) before it
// drives a network request.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
