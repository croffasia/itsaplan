'use client';

import { Bell, Bot, Clock, Compass, Keyboard, ListChecks, Palette } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SectionNav, type SectionNavItem } from '@/components/common/page/SectionNav';
import { useSectionScrollSpy } from '@/hooks/useSectionScrollSpy';

// The blocks of the preferences page, in the order they are rendered. The ids match
// the ones the page gives its sections.
const SECTIONS = [
  { id: 'appearance', labelKey: 'appearance', icon: Palette },
  { id: 'date-and-time', labelKey: 'dateAndTime', icon: Clock },
  { id: 'navigation', labelKey: 'navigation', icon: Compass },
  { id: 'issue-settings', labelKey: 'issueSettings', icon: ListChecks },
  { id: 'notifications', labelKey: 'notifications', icon: Bell },
  { id: 'ai-chat', labelKey: 'aiChat', icon: Bot },
  { id: 'shortcuts', labelKey: 'shortcuts', icon: Keyboard },
] as const;

// The section rail for the preferences page: it follows the page scroll and jumps
// to a block on click.
export default function AccountPreferencesNav() {
  const t = useTranslations('account.preferences');
  const { activeId, setActiveId } = useSectionScrollSpy(SECTIONS.map((s) => s.id));
  const sections: SectionNavItem[] = SECTIONS.map(({ id, labelKey, icon }) => ({
    id,
    label: t(`sections.${labelKey}`),
    icon,
  }));

  function jump(id: string) {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  return (
    <SectionNav
      sections={sections}
      activeId={activeId}
      label={t('label')}
      onJump={jump}
      className="top-16"
    />
  );
}
