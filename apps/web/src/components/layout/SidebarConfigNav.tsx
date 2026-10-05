import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bell, Settings, Users } from 'lucide-react';
import { membersPath, notificationsPath } from '@/utils/paths';
import { useSettingsNavGroups } from '@/hooks/useSettingsNavGroups';
import { usePermissions } from '@/hooks/usePermissions';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar';
import SidebarNavItem from '@/components/layout/SidebarNavItem';

// The Configuration sidebar group: Members, Notifications and the "Project
// settings" entry. That entry links to the first settings section the viewer may
// read and switches the sidebar into settings mode (see AppSidebar).
export default function SidebarConfigNav({ projectKey }: { projectKey: string | null }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const disabled = !projectKey;
  const { firstHref } = useSettingsNavGroups(projectKey);
  const { can, isMember } = usePermissions();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('configuration')}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {can('members_manage', 'read') && (
            <SidebarNavItem
              href={projectKey ? membersPath(projectKey) : '#'}
              icon={Users}
              label={t('members')}
              active={pathname.includes('/members')}
              disabled={disabled}
            />
          )}
          {isMember && (
            <SidebarNavItem
              href={projectKey ? notificationsPath(projectKey) : '#'}
              icon={Bell}
              label={t('notifications')}
              active={!!projectKey && pathname === notificationsPath(projectKey)}
              disabled={disabled}
            />
          )}
          {firstHref && (
            <SidebarNavItem
              href={firstHref}
              icon={Settings}
              label={t('projectSettings')}
              active={false}
              disabled={disabled}
            />
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
