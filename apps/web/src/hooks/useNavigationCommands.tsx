import { useRouter } from 'next/navigation';
import {
  Bell,
  BookOpenText,
  Braces,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  Server,
  Shield,
  SquareKanban,
  Target,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSession } from '@/lib/auth-client';
import {
  aiSectionPath,
  aiTeamPath,
  apiDocsPath,
  dashboardsPath,
  documentsPath,
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
import { AI_SECTIONS, AI_TEAM_SECTIONS } from '@/utils/settingsSections';
import { GOD_SECTIONS } from '@/utils/godSections';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjectFeatures } from '@/hooks/useProjectFeatures';
import { useSettingsNavGroups } from '@/hooks/useSettingsNavGroups';
import {
  useAccountSectionLabel,
  useGodSectionText,
  useSettingsSectionText,
} from '@/hooks/useSectionLabels';
import type { Command, CommandSection } from '@/utils/commands';

// Every place the palette can navigate to, filtered by what the viewer may read.
// The destinations mirror the sidebars one-to-one: the main nav (SidebarMainNav),
// the project settings nav (useSettingsNavGroups, which already applies the
// permission gate), the sidebar footer, the account pages and god mode. Grouped
// under one "Sections" heading so a search separates them from commands and
// issues.
export function useNavigationCommands(projectKey: string | null): CommandSection | null {
  const t = useTranslations('nav');
  const sectionText = useSettingsSectionText();
  const godText = useGodSectionText();
  const accountLabel = useAccountSectionLabel();
  const router = useRouter();
  const { can } = usePermissions();
  const features = useProjectFeatures();
  const { data: session } = useSession();
  const { groups } = useSettingsNavGroups(projectKey);
  const isGod = session?.user.role === 'god';

  const items: Command[] = [];

  function add(id: string, label: string, icon: Command['icon'], href: string, keywords?: string) {
    items.push({ id, label, icon, keywords, run: () => router.push(href) });
  }

  if (projectKey) {
    const key = projectKey;
    add('nav.inbox', t('inbox'), <Inbox />, inboxPath(key), 'notifications unread');
    if (features.dashboards && can('dashboards', 'read'))
      add('nav.dashboards', t('dashboards'), <LayoutDashboard />, dashboardsPath(key), 'charts');
    add(
      'nav.work-items',
      t('workItems'),
      <SquareKanban />,
      projectPath(key),
      'board issues kanban',
    );
    if (features.initiatives && can('initiatives', 'read'))
      add('nav.initiatives', t('initiatives'), <Target />, initiativesPath(key), 'epics');
    if (features.documents && can('documents', 'read'))
      add(
        'nav.documents',
        t('documents'),
        <BookOpenText />,
        documentsPath(key),
        'docs pages documentation',
      );
    for (const s of AI_TEAM_SECTIONS) {
      if (can(s.resource, 'read'))
        add(
          `nav.ai-team.${s.slug}`,
          sectionText(s.slug).label,
          <s.icon />,
          aiTeamPath(key, s.slug),
          'ai team',
        );
    }
    for (const s of AI_SECTIONS) {
      if (can(s.resource, 'read'))
        add(
          `nav.ai.${s.slug}`,
          sectionText(s.slug).label,
          <s.icon />,
          aiSectionPath(key, s.slug),
          'ai team configure',
        );
    }
    add('nav.members', t('members'), <Users />, membersPath(key), 'team people invite');
    add(
      'nav.notifications',
      t('notificationPreferences'),
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
    add('nav.api', t('apiDocs'), <Braces />, apiDocsPath(key), 'rest openapi');
    add('nav.mcp', t('mcpServer'), <Server />, mcpServerPath(key), 'model context protocol');
  }

  add(
    'nav.manage-projects',
    t('manageProjects'),
    <FolderKanban />,
    manageProjectsPath(),
    'account leave delete copy',
  );
  for (const s of ACCOUNT_SECTIONS) {
    add(`nav.account.${s.slug}`, accountLabel(s.slug), <s.icon />, accountPath(s.slug), 'account');
  }

  // Instance administration, owner account only. The API enforces the same, so
  // hiding it here is about noise, not access.
  if (isGod) {
    for (const s of GOD_SECTIONS) {
      add(
        `nav.god.${s.slug}`,
        t('godModeSection', { section: godText.section(s.slug).label }),
        <Shield />,
        godPath(s.slug),
        'instance admin',
      );
    }
  }

  if (items.length === 0) return null;
  return { id: 'sections', heading: t('sections'), items };
}
