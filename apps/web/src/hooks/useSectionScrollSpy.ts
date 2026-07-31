'use client';

import { useEffect, useState, type RefObject } from 'react';

// Which section of a page is being read: the last one whose header has scrolled
// above a line near the top of the scroll root (offset). A position check is used
// rather than IntersectionObserver so a tall section still counts as active while
// it fills the viewport, instead of an earlier section that only just touches the
// top edge. Pass `container` when the sections scroll inside an element; without it
// the page itself is the scroll root. The returned setter lets the caller mark a
// section active right away when it jumps to one.
export function useSectionScrollSpy(ids: string[], container?: RefObject<HTMLElement | null>) {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);
  const key = ids.join(',');

  useEffect(() => {
    const root = container?.current;
    if (container && !root) return;
    const order = key.split(',').filter(Boolean);
    const scope = root ?? document;
    const target = root ?? window;
    const offset = 96;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = (root?.getBoundingClientRect().top ?? 0) + offset;
      let current = order[0] ?? null;
      for (const id of order) {
        const el = scope.querySelector(`#${CSS.escape(id)}`);
        if (el && el.getBoundingClientRect().top <= top) current = id;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      target.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key, container]);

  return { activeId, setActiveId };
}
