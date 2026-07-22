import { useRouter } from 'next/navigation';
import {
  Bell,
  Braces,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  Server,
  Shield,
  SquareKanban,
  Target,
  Users,
} from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import {
  aiChatPath,
  aiTeamPath,
  apiDocsPath,
  dashboardsPath,
  godPath,
  inboxPath,
  initiativesPath,
  manageProjectsPath,
  mcpServerPath,
  membersPath,
  notificationsPath,
  projectPath,
} from '@/utils/paths';
import { ACCOUNT_SECTIONS, accountPath } from '@/utils/accountSections';
import { AI_TEAM_SECTIONS } from '@/utils/settingsSections';
import { GOD_SECTIONS } from '@/utils/godSections';
import { usePermissions } from '@/hooks/usePermissions';
import { useSettingsNavGroups } from '@/hooks/useSettingsNavGroups';
import type { Command, CommandSection } from '@/utils/commands';

// Every place the palette can navigate to, filtered by what the viewer may read.
// The destinations mirror the sidebars one-to-one: the main nav (SidebarMainNav),
// the project settings nav (useSettingsNavGroups, which already applies the
// permission gate), the sidebar footer, the account pages and god mode. Grouped
// under one "Sections" heading so a search separates them from commands and
// issues.
export function useNavigationCommands(projectKey: string | null): CommandSection | null {
  const router = useRouter();
  const { can } = usePermissions();
  const { data: session } = useSession();
  const { groups } = useSettingsNavGroups(projectKey);
  const isGod = session?.user.role === 'god';

  const items: Command[] = [];

  function add(id: string, label: string, icon: Command['icon'], href: string, keywords?: string) {
    items.push({ id, label, icon, keywords, run: () => router.push(href) });
  }

  if (projectKey) {
    const key = projectKey;
    add('nav.inbox', 'Inbox', <Inbox />, inboxPath(key), 'notifications unread');
    if (can('dashboards', 'read'))
      add('nav.dashboards', 'Dashboards', <LayoutDashboard />, dashboardsPath(key), 'charts');
    add('nav.work-items', 'Work items', <SquareKanban />, projectPath(key), 'board issues kanban');
    if (can('initiatives', 'read'))
      add('nav.initiatives', 'Initiatives', <Target />, initiativesPath(key), 'epics');
    if (can('ai_agents', 'read'))
      add('nav.ai-chat', 'Chat with AI Team', <MessagesSquare />, aiChatPath(key), 'ai agents');
    for (const s of AI_TEAM_SECTIONS) {
      if (can(s.resource, 'read'))
        add(`nav.ai-team.${s.slug}`, s.label, <s.icon />, aiTeamPath(key, s.slug), 'ai team');
    }
    add('nav.members', 'Members', <Users />, membersPath(key), 'team people invite');
    add(
      'nav.notifications',
      'Notification preferences',
      <Bell />,
      notificationsPath(key),
      'email telegram',
    );
    // The settings destinations, already permission-filtered by the hook the
    // settings sidebar uses. The group label is a keyword so "workflow" or
    // "automation" finds its sections.
    for (const group of groups) {
      for (const item of group.items) {
        items.push({
          id: `nav.settings.${item.key}`,
          label: item.label,
          icon: <item.icon />,
          keywords: `settings ${group.label}`,
          run: () => router.push(item.href),
        });
      }
    }
    add('nav.api', 'API docs', <Braces />, apiDocsPath(key), 'rest openapi');
    add('nav.mcp', 'MCP Server', <Server />, mcpServerPath(key), 'model context protocol');
  }

  add(
    'nav.manage-projects',
    'Manage projects',
    <FolderKanban />,
    manageProjectsPath(),
    'account leave delete copy',
  );
  for (const s of ACCOUNT_SECTIONS) {
    add(`nav.account.${s.slug}`, s.label, <s.icon />, accountPath(s.slug), 'account');
  }

  // Instance administration, owner account only. The API enforces the same, so
  // hiding it here is about noise, not access.
  if (isGod) {
    for (const s of GOD_SECTIONS) {
      add(
        `nav.god.${s.slug}`,
        `God mode: ${s.label}`,
        <Shield />,
        godPath(s.slug),
        'instance admin',
      );
    }
  }

  if (items.length === 0) return null;
  return { id: 'sections', heading: 'Sections', items };
}
