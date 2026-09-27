import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { aiAgentsPath, aiTeamPath } from '@/utils/paths';
import { AI_AGENTS_SECTION, AI_TEAM_SECTIONS } from '@/utils/settingsSections';
import { usePermissions } from '@/hooks/usePermissions';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar';
import SidebarNavItem from '@/components/layout/SidebarNavItem';

// The AI Team sidebar group: the AI Team sections the viewer may read, then the
// agents of the project. Renders nothing when none of them are readable.
export default function SidebarAiTeamNav({ projectKey }: { projectKey: string | null }) {
  const t = useTranslations('nav');
  const sectionText = useSettingsSectionText();
  const pathname = usePathname();
  const { can } = usePermissions();
  const disabled = !projectKey;

  const sections = AI_TEAM_SECTIONS.filter((s) => can(s.resource, 'read'));
  const showAgents = can(AI_AGENTS_SECTION.resource, 'read');
  if (sections.length === 0 && !showAgents) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('aiTeam')}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {sections.map((s) => (
            <SidebarNavItem
              key={s.slug}
              href={projectKey ? aiTeamPath(projectKey, s.slug) : '#'}
              icon={s.icon}
              label={sectionText(s.slug).label}
              active={pathname.endsWith(`/agents/${s.slug}`)}
              disabled={disabled}
            />
          ))}
          {showAgents && (
            <SidebarNavItem
              href={projectKey ? aiAgentsPath(projectKey) : '#'}
              icon={AI_AGENTS_SECTION.icon}
              label={sectionText(AI_AGENTS_SECTION.slug).label}
              active={pathname.endsWith('/agents')}
              disabled={disabled}
            />
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
