import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  BookOpenText,
  Inbox,
  LayoutDashboard,
  RefreshCw,
  SquareKanban,
  StickyNote,
  Target,
} from 'lucide-react';
import {
  cyclesPath,
  dashboardsPath,
  documentsPath,
  inboxPath,
  initiativesPath,
  notesPath,
  projectPath,
  viewPath,
} from '@/utils/paths';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjectFeatures } from '@/hooks/useProjectFeatures';
import { useInboxUnread } from '@/hooks/useInboxUnread';
import { useViewsQuery } from '@/services/views.service';
import { viewIcon } from '@/utils/viewIcons';
import { SidebarGroup, SidebarGroupContent, SidebarMenu } from '@/components/ui/sidebar';
import SidebarNavItem from '@/components/layout/SidebarNavItem';
import SidebarNavSubmenu from '@/components/layout/SidebarNavSubmenu';

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
  const { data: views } = useViewsQuery(projectKey);
  const favorites = views?.filter((v) => v.favorite) ?? [];

  // "Work items" is the default view: active on the project root and any segment
  // that is not one of the other top-level destinations.
  const onWorkItems =
    !!projectKey &&
    (pathname === projectPath(projectKey) ||
      pathname.startsWith(`${projectPath(projectKey)}/view`) ||
      pathname.startsWith(`${projectPath(projectKey)}/issue`));

  // With favorites, Work items becomes a sub-list: the unfiltered board plus one
  // entry per favorite view.
  const workItemsSubmenu =
    projectKey && favorites.length > 0
      ? [
          {
            key: 'all',
            href: projectPath(projectKey),
            icon: SquareKanban,
            label: t('allWorkItems'),
            // Also the entry for a saved view that is not a favorite: it has no
            // row of its own, and the group would otherwise show nothing active.
            active: onWorkItems && !favorites.some((v) => pathname === viewPath(projectKey, v.id)),
          },
          ...favorites.map((v) => ({
            key: String(v.id),
            href: viewPath(projectKey, v.id),
            icon: viewIcon(v.icon),
            label: v.name,
            active: pathname === viewPath(projectKey, v.id),
          })),
        ]
      : null;

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
          {workItemsSubmenu ? (
            <SidebarNavSubmenu
              icon={SquareKanban}
              label={t('workItems')}
              items={workItemsSubmenu}
            />
          ) : (
            <SidebarNavItem
              href={projectKey ? projectPath(projectKey) : '#'}
              icon={SquareKanban}
              label={t('workItems')}
              active={onWorkItems}
              disabled={disabled}
            />
          )}
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
          {features.documents && can('documents', 'read') && (
            <SidebarNavItem
              href={projectKey ? documentsPath(projectKey) : '#'}
              icon={BookOpenText}
              label={t('documents')}
              active={pathname.includes('/docs')}
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
