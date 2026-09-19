import { usePathname } from 'next/navigation';
import {
  ContactRound,
  BadgeEuro,
  BookOpenText,
  Building2,
  CalendarDays,
  Files,
  Inbox,
  PhoneCall,
  LayoutDashboard,
  Server,
  SquareKanban,
  StickyNote,
  Target,
} from 'lucide-react';
import {
  accountingPath,
  calendarPath,
  crmPath,
  dashboardsPath,
  filesPath,
  financePath,
  inboxPath,
  phonePath,
  initiativesPath,
  isLeadsPath,
  leadsPath,
  notesPath,
  projectPath,
  serversPath,
} from '@/utils/paths';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjectFeatures } from '@/hooks/useProjectFeatures';
import { useInboxUnread } from '@/hooks/useInboxUnread';
import { SidebarGroup, SidebarGroupContent, SidebarMenu } from '@/components/ui/sidebar';
import SidebarNavItem from '@/components/layout/SidebarNavItem';
import SidebarCommandCenterItem from '@/components/layout/SidebarCommandCenterItem';

// The top sidebar group. An entry appears only when its project feature is on and
// the user may read the section.
export default function SidebarWorkNav({
  projectKey,
  projectId,
}: {
  projectKey: string | null;
  projectId: number | null;
}) {
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
          <SidebarCommandCenterItem
            projectKey={projectKey}
            active={pathname.includes('/command-center')}
            disabled={disabled}
          />
          <SidebarNavItem
            href={projectKey ? inboxPath(projectKey) : '#'}
            icon={Inbox}
            label="Inbox"
            active={pathname.endsWith('/inbox')}
            disabled={disabled}
            badge={inboxUnread}
          />
          {can('phone', 'read') && (
            <SidebarNavItem
              href={projectKey ? phonePath(projectKey) : '#'}
              icon={PhoneCall}
              label="Business number"
              active={pathname.includes('/phone')}
              disabled={disabled}
            />
          )}
          {can('calendar', 'read') && (
            <SidebarNavItem
              href={projectKey ? calendarPath(projectKey) : '#'}
              icon={CalendarDays}
              label="Calendar"
              active={pathname.includes('/calendar')}
              disabled={disabled}
            />
          )}
          {features.dashboards && can('dashboards', 'read') && (
            <SidebarNavItem
              href={projectKey ? dashboardsPath(projectKey) : '#'}
              icon={LayoutDashboard}
              label="Dashboards"
              active={pathname.includes('/dashboard')}
              disabled={disabled}
            />
          )}
          <SidebarNavItem
            href={projectKey ? projectPath(projectKey) : '#'}
            icon={SquareKanban}
            label="Work items"
            active={onWorkItems}
            disabled={disabled}
          />
          {features.initiatives && can('initiatives', 'read') && (
            <SidebarNavItem
              href={projectKey ? initiativesPath(projectKey) : '#'}
              icon={Target}
              label="Initiatives"
              active={pathname.includes('/initiatives')}
              disabled={disabled}
            />
          )}
          {features.notes && can('note_boards', 'read') && (
            <SidebarNavItem
              href={projectKey ? notesPath(projectKey) : '#'}
              icon={StickyNote}
              label="Notes"
              active={pathname.includes('/notes')}
              disabled={disabled}
            />
          )}
          {can('files', 'read') && (
            <SidebarNavItem
              href={projectKey ? filesPath(projectKey) : '#'}
              icon={Files}
              label="Files"
              active={pathname.includes('/files')}
              disabled={disabled}
            />
          )}
          {can('crm', 'read') && (
            <SidebarNavItem
              href={projectKey ? crmPath(projectKey) : '#'}
              icon={ContactRound}
              label="CRM"
              active={pathname.includes('/crm')}
              disabled={disabled}
            />
          )}
          {can('finance', 'read') && (
            <>
              <SidebarNavItem
                href={projectKey ? financePath(projectKey) : '#'}
                icon={BadgeEuro}
                label="Finance"
                active={pathname.includes('/finance')}
                disabled={disabled}
              />
              <SidebarNavItem
                href={projectKey ? accountingPath(projectKey) : '#'}
                icon={BookOpenText}
                label="Accounting"
                active={pathname.includes('/accounting')}
                disabled={disabled}
              />
            </>
          )}
          {can('leads', 'read') && (
            <SidebarNavItem
              href={projectKey ? leadsPath(projectKey) : '#'}
              icon={Building2}
              label="Leads"
              active={isLeadsPath(pathname)}
              disabled={disabled}
            />
          )}
          <SidebarNavItem
            href={projectKey ? serversPath(projectKey) : '#'}
            icon={Server}
            label="Servers"
            active={pathname.includes('/servers')}
            disabled={disabled}
          />
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
