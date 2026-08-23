import { usePathname } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { aiSectionPath, aiTeamPath } from '@/utils/paths';
import { AI_SECTIONS, AI_TEAM_SECTIONS } from '@/utils/settingsSections';
import { usePermissions } from '@/hooks/usePermissions';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar';
import SidebarNavItem from '@/components/layout/SidebarNavItem';
import SidebarNavSubmenu from '@/components/layout/SidebarNavSubmenu';

// The AI Team sidebar group: the AI Team sections the viewer may read, and the
// "Configure" item holding the AI configuration sections. Renders nothing when none
// of them are readable.
export default function SidebarAiTeamNav({ projectKey }: { projectKey: string | null }) {
  const t = useTranslations('nav');
  const sectionText = useSettingsSectionText();
  const pathname = usePathname();
  const { can } = usePermissions();
  const disabled = !projectKey;

  const sections = AI_TEAM_SECTIONS.filter((s) => can(s.resource, 'read'));
  const configureItems = AI_SECTIONS.filter((s) => can(s.resource, 'read')).map((s) => ({
    key: s.slug,
    href: projectKey ? aiSectionPath(projectKey, s.slug) : '#',
    icon: s.icon,
    label: sectionText(s.slug).label,
    active: pathname.endsWith(`/${s.slug}`),
  }));
  if (sections.length === 0 && configureItems.length === 0) return null;

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
              active={pathname.endsWith(`/ai-team/${s.slug}`)}
              disabled={disabled}
            />
          ))}
          {configureItems.length > 0 && (
            <SidebarNavSubmenu
              icon={SlidersHorizontal}
              label={t('configure')}
              items={configureItems}
            />
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
