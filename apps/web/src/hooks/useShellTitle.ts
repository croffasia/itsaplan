import { useTranslations } from 'next-intl';
import type { View } from '@/lib/api/endpoints/views';
import { AI_AGENTS_SECTION, SETTINGS_SECTIONS } from '@/utils/settingsSections';
import type { ShellRoute } from '@/hooks/useShellRoute';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import { titlePath, useDocumentTitle } from '@/hooks/useDocumentTitle';

const SECTION_LABELS = {
  inbox: 'inbox',
  dashboards: 'dashboards',
  initiatives: 'initiatives',
  cycles: 'cycles',
  docs: 'documents',
  notes: 'notes',
  members: 'members',
  notifications: 'notifications',
  api: 'apiDocs',
  mcp: 'mcpServer',
} as const;

// The tab title of a project route: the project and the section the route opens. A
// detail page names its entity over it, so this is also what the tab shows while that
// entity loads or when it cannot be read.
export function useShellTitle(route: ShellRoute, projectName: string, views: View[]) {
  const t = useTranslations('nav');
  const tScreens = useTranslations('meta.screens');
  const sectionText = useSettingsSectionText();
  const known = (slug: string | null): slug is string =>
    SETTINGS_SECTIONS.some((s) => s.slug === slug);

  function sectionParts(): string[] {
    const { sub, section, aiTeamSection } = route;
    if (sub === 'settings')
      return [tScreens('settings'), ...(known(section) ? [sectionText(section).label] : [])];
    if (sub === 'agents') {
      if (!aiTeamSection) return [sectionText(AI_AGENTS_SECTION.slug).label];
      return [known(aiTeamSection) ? sectionText(aiTeamSection).label : t('aiTeam')];
    }
    if (sub === 'view') {
      const view = views.find((v) => v.id === route.activeViewId);
      return view ? [view.name] : [];
    }
    if (sub && sub in SECTION_LABELS)
      return [t(SECTION_LABELS[sub as keyof typeof SECTION_LABELS])];
    return [];
  }

  useDocumentTitle(titlePath(projectName, ...sectionParts()), 'section');
}
