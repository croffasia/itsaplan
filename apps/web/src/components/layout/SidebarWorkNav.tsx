import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Inbox, LayoutDashboard, RefreshCw, SquareKanban, StickyNote, Target } from 'lucide-react';
import {
  cyclesPath,
  dashboardsPath,
  inboxPath,
  initiativesPath,
  notesPath,
  projectPath,
} from '@/utils/paths';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjectFeatures } from '@/hooks/useProjectFeatures';
import { useInboxUnread } from '@/hooks/useInboxUnread';
import { SidebarGroup, SidebarGroupContent, SidebarMenu } from '@/components/ui/sidebar';
import SidebarNavItem from '@/components/layout/SidebarNavItem';

// The top sidebar group. An entry appears only when its project feature is on and
// the user may read the section.
export default function SidebarWorkNav({
  projectKey,
  projectId,
}: {
  projectKey: string | null;
  projectId: number | null;
}) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { can } = usePermissions();
  const features = useProjectFeatures();
  const disabled = !projectKey;
  const { data: inboxUnread } = useInboxUnread(projectKey, projectId);

  // "Work items" is the default view: active on the project root and any segment
  // that is not one of the other top-level destinations.
  const onWorkItems =
    !!projectKey &&
    (pathname === projectPath(projectKey) ||
      pathname.startsWith(`${projectPath(projectKey)}/view`) ||
      pathname.startsWith(`${projectPath(projectKey)}/issue`));

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarNavItem
            href={projectKey ? inboxPath(projectKey) : '#'}
            icon={Inbox}
            label={t('inbox')}
            active={pathname.endsWith('/inbox')}
            disabled={disabled}
            badge={inboxUnread}
          />
          {features.dashboards && can('dashboards', 'read') && (
            <SidebarNavItem
              href={projectKey ? dashboardsPath(projectKey) : '#'}
              icon={LayoutDashboard}
              label={t('dashboards')}
              active={pathname.includes('/dashboard')}
              disabled={disabled}
            />
          )}
          <SidebarNavItem
            href={projectKey ? projectPath(projectKey) : '#'}
            icon={SquareKanban}
            label={t('workItems')}
            active={onWorkItems}
            disabled={disabled}
          />
          {features.initiatives && can('initiatives', 'read') && (
            <SidebarNavItem
              href={projectKey ? initiativesPath(projectKey) : '#'}
              icon={Target}
              label={t('initiatives')}
              active={pathname.includes('/initiatives')}
              disabled={disabled}
            />
          )}
          {features.cycles && can('cycles', 'read') && (
            <SidebarNavItem
              href={projectKey ? cyclesPath(projectKey) : '#'}
              icon={RefreshCw}
              label={t('cycles')}
              active={pathname.includes('/cycles')}
              disabled={disabled}
            />
          )}
          {features.notes && can('note_boards', 'read') && (
            <SidebarNavItem
              href={projectKey ? notesPath(projectKey) : '#'}
              icon={StickyNote}
              label={t('notes')}
              active={pathname.includes('/notes')}
              disabled={disabled}
            />
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
