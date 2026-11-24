import { useCallback, useLayoutEffect, useRef } from 'react';

// A function with the same identity on every render that calls the latest `fn`. A
// memoized child that takes it does not render again when only the parent's closure
// changed. Call it from event handlers, not during render: until the commit it still
// runs the `fn` of the previous render.
export function useStableCallback<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  const latest = useRef(fn);
  useLayoutEffect(() => {
    latest.current = fn;
  });
  return useCallback((...args: Args) => latest.current(...args), []);
}
