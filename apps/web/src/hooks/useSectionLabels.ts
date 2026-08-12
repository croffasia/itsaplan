'use client';

import { useTranslations } from 'next-intl';
import type { GodGroup } from '@/utils/godSections';
import { byKey } from '@/utils/messageKey';

// The names and blurbs of the navigable sections — project settings, god mode and
// the account pages. The slug is a route param typed as a plain string, so the
// message key is built at runtime and the cast is what lets it be.
type SectionText = { label: string; description: string };

function sectionText(t: ReturnType<typeof useTranslations>, slug: string): SectionText {
  const read = byKey(t);
  return { label: read(`${slug}.label`), description: read(`${slug}.description`) };
}

export function useSettingsSectionText() {
  const t = useTranslations('sections.settings');
  return (slug: string) => sectionText(t, slug);
}

export function useGodSectionText() {
  const t = useTranslations('sections.god');
  const tGroup = useTranslations('sections.godGroups');
  return {
    section: (slug: string) => sectionText(t, slug),
    group: (group: GodGroup) => tGroup(group),
  };
}

export function useAccountSectionLabel() {
  const t = useTranslations('sections.account');
  return (slug: string) => byKey(t)(slug);
}
