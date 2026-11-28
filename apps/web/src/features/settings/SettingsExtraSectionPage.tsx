'use client';

import { useIsFetching } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { useTranslations } from 'next-intl';
import SectionPageView from '@/components/common/page/SectionPageView';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import { useProjectSections } from '@/hooks/useSettingsNavGroups';
import { ROUTED_GROUPS } from '@/utils/settingsSections';

// A project section without a route of its own: one the hosted build adds, at
// /settings/:section, in the AI Team group at /agents/:section, or in the 'work' group at
// /:section. Its sections can depend on queries of their own, so a link straight to one
// waits for those to load before it calls the section unknown. A link to a section the
// person may not read, which the menus leave out, shows its page with a notice, as the
// core's sections do.
export default function SettingsExtraSectionPage({
  slug,
  group = 'settings',
}: {
  slug: string;
  group?: 'settings' | 'ai-team' | 'work';
}) {
  const tCommon = useTranslations('common');
  const sectionText = useSettingsSectionText();
  const { project } = useShell();
  const { can } = usePermissions();
  const section = useProjectSections().find(
    (entry) =>
      entry.slug === slug &&
      (group === 'settings' ? !ROUTED_GROUPS.includes(entry.group) : entry.group === group),
  );
  const Component = section?.Component;
  const loading = useIsFetching() > 0;
  if (!section || !Component) {
    if (!project || loading) return null;
    notFound();
  }
  if (!can(section.resource, section.viewAction ?? 'read')) {
    const text = sectionText(section.slug);
    return (
      <SectionPageView title={text.label} description={text.description}>
        <p className="text-sm text-muted-foreground">{tCommon('noSectionAccess')}</p>
      </SectionPageView>
    );
  }
  return <Component />;
}
