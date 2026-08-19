'use client';

import { type ReactNode, useRef } from 'react';
import { SectionNav, type SectionNavItem } from '@/components/common/page/SectionNav';
import { useSectionScrollSpy } from '@/hooks/useSectionScrollSpy';
import { useTranslations } from 'next-intl';

// Content width of the full-width internal editor. The sheet sizes its footer to
// match, so the two must stay in sync.
export const AGENT_EXPANDED_WIDTH = 'max-w-[860px]';

// The scroll container + section nav for the full-width internal editor. It owns the
// scroll root so the nav can spy on which section is in view and jump to one on click.
export default function AgentExpandedLayout({
  navSections,
  onExpand,
  children,
}: {
  navSections: SectionNavItem[];
  // Ensure a section is open before scrolling to it (jumping to a collapsed section
  // would land on just its header).
  onExpand: (id: string) => void;
  children: ReactNode;
}) {
  const t = useTranslations('settings.agents');
  const containerRef = useRef<HTMLDivElement>(null);
  const { activeId, setActiveId } = useSectionScrollSpy(
    navSections.map((s) => s.id),
    containerRef,
  );

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
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-10 sm:px-6 sm:pt-2"
    >
      <div className={`mx-auto flex w-full gap-10 ${AGENT_EXPANDED_WIDTH}`}>
        <SectionNav
          sections={navSections}
          activeId={activeId}
          label={t('agentSettings')}
          onJump={jump}
        />
        <div className="min-w-0 flex-1 space-y-8">{children}</div>
      </div>
    </div>
  );
}
