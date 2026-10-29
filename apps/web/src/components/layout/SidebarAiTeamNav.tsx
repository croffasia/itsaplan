import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { aiAgentsPath, aiTeamPath } from '@/utils/paths';
import { AI_AGENTS_SECTION } from '@/utils/settingsSections';
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
  const sectionItem = (s: (typeof sections)[number]) => (
    <SidebarNavItem
      key={s.slug}
      href={projectKey ? aiTeamPath(projectKey, s.slug) : '#'}
      icon={s.icon}
      label={sectionText(s.slug).label}
      active={aiTeamSection === s.slug}
      disabled={disabled}
    />
  );

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('aiTeam')}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {sections.filter((s) => s.slug !== 'queue').map(sectionItem)}
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
