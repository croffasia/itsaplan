'use client';

import { Bell, Bot, Clock, Compass, Keyboard, ListChecks, Palette } from 'lucide-react';
import { SectionNav, type SectionNavItem } from '@/components/common/page/SectionNav';
import { useSectionScrollSpy } from '@/hooks/useSectionScrollSpy';

// The blocks of the preferences page, in the order they are rendered. The ids match
// the ones the page gives its sections.
const SECTIONS: SectionNavItem[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'date-and-time', label: 'Date and time', icon: Clock },
  { id: 'navigation', label: 'Navigation', icon: Compass },
  { id: 'issue-settings', label: 'Issue settings', icon: ListChecks },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'ai-chat', label: 'AI chat', icon: Bot },
  { id: 'shortcuts', label: 'Keyboard shortcuts', icon: Keyboard },
];

// The section rail for the preferences page: it follows the page scroll and jumps
// to a block on click.
export default function AccountPreferencesNav() {
  const { activeId, setActiveId } = useSectionScrollSpy(SECTIONS.map((s) => s.id));

  function jump(id: string) {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  return (
    <SectionNav
      sections={SECTIONS}
      activeId={activeId}
      label="Preferences"
      onJump={jump}
      // The page scrolls under a static top bar, so the rail keeps a margin of its
      // own once it pins.
      className="top-8"
    />
  );
}
