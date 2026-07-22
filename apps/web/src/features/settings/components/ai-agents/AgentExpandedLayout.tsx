'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AgentSectionNav, type AgentNavSection } from './AgentSectionNav';

// Content width of the full-width internal editor. The sheet sizes its footer to
// match, so the two must stay in sync.
export const AGENT_EXPANDED_WIDTH = 'max-w-[860px]';

// The scroll container + section nav for the full-width internal editor. It owns the
// scroll root so the nav can spy on which section is in view and jump to one on click.
export default function AgentExpandedLayout({
  navSections,
  banner,
  onExpand,
  children,
}: {
  navSections: AgentNavSection[];
  banner?: ReactNode;
  // Ensure a section is open before scrolling to it (jumping to a collapsed section
  // would land on just its header).
  onExpand: (id: string) => void;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(navSections[0]?.id ?? null);
  const ids = navSections.map((s) => s.id).join(',');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const order = ids.split(',');
    // The active section is the last one whose header has scrolled above a line near
    // the top of the container (offset). A position check is used rather than
    // IntersectionObserver so a tall section still counts as active while it fills the
    // viewport, instead of an earlier section that only just touches the top edge.
    const offset = 96;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = container.getBoundingClientRect().top + offset;
      let current = order[0];
      for (const id of order) {
        const el = container.querySelector(`#${CSS.escape(id)}`);
        if (el && el.getBoundingClientRect().top <= top) current = id;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);

  function jump(id: string) {
    onExpand(id);
    setActiveId(id);
    // The section may have just expanded; wait a frame so its final position is
    // known. Instant scroll, not smooth: the Radix sheet's scroll lock swallows
    // programmatic smooth scrolling.
    requestAnimationFrame(() => {
      containerRef.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: 'start' });
    });
  }

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-10">
      {banner && <div className={`mx-auto mb-6 w-full ${AGENT_EXPANDED_WIDTH}`}>{banner}</div>}
      <div className={`mx-auto flex w-full gap-10 ${AGENT_EXPANDED_WIDTH}`}>
        <AgentSectionNav sections={navSections} activeId={activeId} onJump={jump} />
        <div className="min-w-0 flex-1 space-y-8">{children}</div>
      </div>
    </div>
  );
}
