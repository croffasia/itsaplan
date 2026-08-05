import { useEffect, useState, type RefObject } from 'react';

// Live width of the element `ref` points at, for layouts that size themselves to
// the room they are given. Until the element is measured it reports the window
// width, which is also what the server render has to go on.
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);

  return width;
}
