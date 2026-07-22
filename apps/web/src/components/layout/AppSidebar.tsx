'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Braces, Server, Shield } from 'lucide-react';
import type { Project } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { apiDocsPath, godPath, mcpServerPath } from '@/utils/paths';
import { GOD_SECTIONS } from '@/utils/godSections';
import { useSettingsNavGroups } from '@/hooks/useSettingsNavGroups';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import ProjectSwitcher from '@/components/layout/ProjectSwitcher';
import SidebarNavItem from '@/components/layout/SidebarNavItem';
import SidebarMainNav from '@/components/layout/SidebarMainNav';
import SidebarSettingsNav from '@/components/layout/SidebarSettingsNav';
import SidebarBrandFooter from '@/components/brand/SidebarBrandFooter';

// The app sidebar. It has two modes driven by the route: the main work
// navigation, and the project settings navigation reached through the "Project
// settings" entry. The project switcher header and the footer (API docs, MCP
// server, brand mark) are shared by both modes. Project deletion lives on the
// standalone Manage projects page, not here.
export default function AppSidebar({
  projects,
  currentProjectKey,
  onSelectProject,
  onNewProject,
}: {
  projects: Project[];
  currentProjectKey: string | null;
  onSelectProject: (key: string) => void;
  onNewProject: () => void;
}) {
  const pathname = usePathname();
  const disabled = !currentProjectKey;
  const projectId = projects.find((p) => p.key === currentProjectKey)?.id ?? null;

  const { data: session } = useSession();
  // The session store can already be filled by the time React hydrates, while the
  // server rendered without it. Reading it only after mount keeps the server and
  // the first client render identical, so the God mode entry does not break
  // hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isGod = mounted && session?.user.role === 'god';

  // Settings mode is on whenever the route matches one of the settings nav items.
  // Members and the AI Team Schedules page are not in those groups, so they keep
  // the main sidebar.
  const settingsNav = useSettingsNavGroups(currentProjectKey);
  const settingsMode = settingsNav.groups.some((g) => g.items.some((i) => i.active));
  const onApiDocs = pathname.endsWith('/api');
  const onMcp = pathname.endsWith('/mcp');

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <ProjectSwitcher
          projects={projects}
          currentProjectKey={currentProjectKey}
          onSelectProject={onSelectProject}
          onNewProject={onNewProject}
        />
      </SidebarHeader>

      <SidebarContent>
        {settingsMode ? (
          <SidebarSettingsNav projectKey={currentProjectKey} />
        ) : (
          <SidebarMainNav projectKey={currentProjectKey} projectId={projectId} />
        )}
      </SidebarContent>

      <SidebarFooter>
        {!settingsMode && (
          <>
            <SidebarMenu>
              <SidebarNavItem
                href={currentProjectKey ? apiDocsPath(currentProjectKey) : '#'}
                icon={Braces}
                label="API docs"
                active={onApiDocs}
                disabled={disabled}
              />
              <SidebarNavItem
                href={currentProjectKey ? mcpServerPath(currentProjectKey) : '#'}
                icon={Server}
                label="MCP Server"
                active={onMcp}
                disabled={disabled}
              />
              {/* Instance administration, only for the owner account. The API
                  enforces the same, so hiding it here is about noise, not access. */}
              {isGod && (
                <SidebarNavItem
                  href={godPath(GOD_SECTIONS[0]!.slug)}
                  icon={Shield}
                  label="God mode"
                  active={false}
                  disabled={false}
                />
              )}
            </SidebarMenu>

            <SidebarSeparator />
          </>
        )}

        <SidebarBrandFooter />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
