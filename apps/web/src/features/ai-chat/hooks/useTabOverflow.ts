'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChatSession } from './useChatSessions';

// The gap between two tabs, and the room the control that opens the rest takes next to
// them. Both are in the tab row's own classes.
const GAP = 4;
const OVERFLOW_WIDTH = 32;

function countThatFit(widths: number[], available: number) {
  let used = 0;
  for (let i = 0; i < widths.length; i += 1) {
    used += widths[i] + (i > 0 ? GAP : 0);
    if (used > available) return i;
  }
  return widths.length;
}

// Splits the sessions into the tabs the row shows and the ones its menu lists. The
// widths are read from a copy of the row that is laid out but not shown: the visible
// row holds only what fits, so it cannot report the width of a tab it does not render.
export function useTabOverflow(sessions: ChatSession[], activeId: string | null) {
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(sessions.length);
  // The row loses this room to the control the moment it appears, so the width it
  // reports has to be read back to what the tabs alone have.
  const overflowShown = useRef(false);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;

    const apply = () => {
      const widths = Array.from(measure.children, (tab) => tab.getBoundingClientRect().width);
      const available = row.clientWidth + (overflowShown.current ? OVERFLOW_WIDTH : 0);
      const fit = countThatFit(widths, available);
      let next = fit === widths.length ? fit : countThatFit(widths, available - OVERFLOW_WIDTH);
      // The tab in front takes the last slot when its place in the row is past the ones
      // that fit, and it can be wider than the tab it stands in for: the room the rest
      // are measured against is what is left of the row once it has taken its own.
      const activeIndex = sessions.findIndex((session) => session.id === activeId);
      if (activeIndex >= next) {
        next = countThatFit(widths, available - OVERFLOW_WIDTH - GAP - widths[activeIndex]) + 1;
      }
      overflowShown.current = next < widths.length;
      setCount(next);
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(row);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [sessions, activeId]);

  return useMemo(() => {
    if (count >= sessions.length) return { rowRef, measureRef, visible: sessions, hidden: [] };

    const visible = sessions.slice(0, count);
    // The session in front keeps its tab whatever its place in the row, so it takes the
    // last slot when it did not fit.
    if (activeId && !visible.some((session) => session.id === activeId)) {
      const active = sessions.find((session) => session.id === activeId);
      if (active) visible.splice(Math.max(count - 1, 0), 1, active);
    }
    const shown = new Set(visible.map((session) => session.id));

    return {
      rowRef,
      measureRef,
      visible,
      hidden: sessions.filter((session) => !shown.has(session.id)),
    };
  }, [sessions, count, activeId]);
}
