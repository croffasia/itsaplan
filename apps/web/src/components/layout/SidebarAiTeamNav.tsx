import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { aiAgentsPath, aiTeamPath } from '@/utils/paths';
import { AI_AGENTS_SECTION, aiTeamEntries, type AiTeamEntry } from '@/utils/settingsSections';
import { useAiTeamSections } from '@/hooks/useSettingsNavGroups';
import { usePermissions } from '@/hooks/usePermissions';
import { useShellRoute } from '@/hooks/useShellRoute';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar';
import SidebarNavItem from '@/components/layout/SidebarNavItem';
import SidebarNavSubmenu from '@/components/layout/SidebarNavSubmenu';

// The AI Team sidebar group: the AI Team sections the viewer may read, then the
// agents of the project, then their runs. Renders nothing when none of them are readable.
export default function SidebarAiTeamNav({ projectKey }: { projectKey: string | null }) {
  const t = useTranslations('nav');
  const sectionText = useSettingsSectionText();
  const pathname = usePathname();
  const { aiTeamSection } = useShellRoute();
  const { can, isAdmin } = usePermissions();
  const disabled = !projectKey;

  // The run list also opens to whoever runs the team, as its route does.
  const sections = useAiTeamSections().filter(
    (s) => can(s.resource, 'read') || (s.slug === 'queue' && isAdmin),
  );
  const showAgents = can(AI_AGENTS_SECTION.resource, 'read');
  if (sections.length === 0 && !showAgents) return null;
  const href = (slug: string) => (projectKey ? aiTeamPath(projectKey, slug) : '#');
  const sectionItem = (s: (typeof sections)[number]) => (
    <SidebarNavItem
      key={s.slug}
      href={href(s.slug)}
      icon={s.icon}
      label={sectionText(s.slug).label}
      active={aiTeamSection === s.slug}
      disabled={disabled}
    />
  );
  const listed = sections.filter((s) => s.slug !== 'queue');
  // A menu opens to links, so with no project to link to each section is an item of its own.
  const entries: AiTeamEntry[] = projectKey
    ? aiTeamEntries(listed)
    : listed.map((section) => ({ section }));
  const entryItem = (entry: AiTeamEntry) =>
    'section' in entry ? (
      sectionItem(entry.section)
    ) : (
      <SidebarNavSubmenu
        key={`menu:${entry.menu}`}
        icon={entry.sections[0]!.icon}
        label={sectionText(entry.menu).label}
        items={entry.sections.map((s) => ({
          key: s.slug,
          href: href(s.slug),
          icon: s.icon,
          label: sectionText(s.slug).label,
          active: aiTeamSection === s.slug,
        }))}
      />
    );

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('aiTeam')}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {entries.map(entryItem)}
          {showAgents && (
            <SidebarNavItem
              href={projectKey ? aiAgentsPath(projectKey) : '#'}
              icon={AI_AGENTS_SECTION.icon}
              label={sectionText(AI_AGENTS_SECTION.slug).label}
              active={pathname.endsWith('/agents')}
              disabled={disabled}
            />
          )}
          {sections.filter((s) => s.slug === 'queue').map(sectionItem)}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
