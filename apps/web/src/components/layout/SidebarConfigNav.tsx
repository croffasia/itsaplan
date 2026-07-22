import { usePathname } from 'next/navigation';
import { Bell, Settings, Users } from 'lucide-react';
import { membersPath, notificationsPath } from '@/utils/paths';
import { useSettingsNavGroups } from '@/hooks/useSettingsNavGroups';
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
  const pathname = usePathname();
  const disabled = !projectKey;
  const { firstHref } = useSettingsNavGroups(projectKey);

  const onRoles = pathname.endsWith('/members/roles');

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Configuration</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarNavItem
            href={projectKey ? membersPath(projectKey) : '#'}
            icon={Users}
            label="Members"
            active={pathname.includes('/members') && !onRoles}
            disabled={disabled}
          />
          <SidebarNavItem
            href={projectKey ? notificationsPath(projectKey) : '#'}
            icon={Bell}
            label="Notifications"
            active={!!projectKey && pathname === notificationsPath(projectKey)}
            disabled={disabled}
          />
          {firstHref && (
            <SidebarNavItem
              href={firstHref}
              icon={Settings}
              label="Project settings"
              active={false}
              disabled={disabled}
            />
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
