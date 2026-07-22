'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useIssueBySeqQuery } from '@/services/issues.service';
import { useAccountPreferences } from '@/services/preferences.service';
import type { IssueOpenMode } from '@/lib/api';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useOverlays } from '@/hooks/useOverlays';
import { useSettingsNavGroups } from '@/hooks/useSettingsNavGroups';
import { useShellProject } from '@/hooks/useShellProject';
import { useShellRoute } from '@/hooks/useShellRoute';
import { useProjectRouteSync } from '@/hooks/useProjectRouteSync';
import { projectPath, issuePath } from '@/utils/paths';
import { ShellCtx, type ShellContext } from '@/context/shellContext';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/AppSidebar';
import AppHeader from '@/components/layout/AppHeader';
import CommandLayer from '@/components/layout/CommandLayer';
import ShellBody from '@/components/layout/ShellBody';
import ShellHeaderTitle from '@/components/layout/ShellHeaderTitle';
import ShellOverlays from '@/components/layout/ShellOverlays';

// The layout for /project/:projectKey and its children (the work items view and the
// settings pages). It owns the project data, the view editor and the
// project-level overlays, renders the sidebar + header chrome, and passes the
// project state to the active child through React context (see lib/shellContext).
export default function Shell({
  children,
  defaultSidebarOpen = true,
}: {
  children: ReactNode;
  defaultSidebarOpen?: boolean;
}) {
  const router = useRouter();
  const route = useShellRoute();
  const { projectKey, routeIssueSeq } = route;

  const {
    projects,
    projectsLoaded,
    project,
    filteredProject,
    views,
    editor,
    customFields,
    canCreateIssue,
    errorMsg,
    forbidden,
  } = useShellProject(projectKey, route.activeViewId);

  const { issueOpenMode, showChatByDefault } = useAccountPreferences();
  const overlays = useOverlays(showChatByDefault);
  const issueQuery = useIssueBySeqQuery(projectKey, routeIssueSeq);

  useProjectRouteSync({ projects, projectsLoaded, projectKey });

  // The settings sections the member may open; the hotkey lands on the first of
  // them, the same entry the sidebar links to.
  const { firstHref: firstSettingsHref } = useSettingsNavGroups(projectKey, project);

  const openNewIssue = () =>
    project && overlays.setNewIssueDefaults({ columnId: project.columns[0]?.id ?? 0 });

  // The issue the palette builds its issue commands for: the open detail panel
  // takes precedence over the issue page behind it.
  const currentIssueId = overlays.openIssueId ?? issueQuery.data?.id ?? null;
  // After deleting or archiving from the palette: close the panel, or leave the
  // issue page it was run from.
  const onIssueDeleted = () => {
    if (overlays.openIssueId != null) overlays.setOpenIssueId(null);
    else if (projectKey && routeIssueSeq != null) router.push(projectPath(projectKey));
  };

  useKeyboardShortcuts({
    hasProject: !!project,
    projects,
    overlayOpen: overlays.anyOpen,
    onToggleCommand: () => overlays.setShowCommand((v) => !v),
    onSelectProject: (key) => router.push(projectPath(key)),
    onChangeView: editor.changeView,
    onNewIssue: () => canCreateIssue && openNewIssue(),
    onNewProject: () => overlays.setShowNewProject(true),
    onSettings: () => firstSettingsHref && router.push(firstSettingsHref),
  });

  // Every view opens an issue through this one callback, so the user's choice
  // between the side panel and a full page is applied here rather than at each call
  // site. `mode` overrides that choice for a call site that means one of them (the
  // context menu's Preview / Go to issue). The views pass the internal issue id
  // while the URL addresses an issue by its project-scoped number, so the page route
  // resolves the number first and falls back to the panel when the issue is not on
  // the loaded board.
  const openIssue = (id: number, mode: IssueOpenMode = issueOpenMode) => {
    if (mode === 'page' && projectKey) {
      const seq = project?.issues.find((i) => i.id === id)?.sequenceNumber;
      if (seq != null) {
        router.push(issuePath(projectKey, seq));
        return;
      }
    }
    overlays.setOpenIssueId(id);
  };

  const context: ShellContext = {
    project,
    filteredProject,
    views,
    editor,
    customFields,
    onOpenIssue: openIssue,
    onAddIssue: overlays.setNewIssueDefaults,
  };

  return (
    <ShellCtx.Provider value={context}>
      <SidebarProvider defaultOpen={defaultSidebarOpen} className="h-svh overflow-hidden">
        <AppSidebar
          projects={projects}
          currentProjectKey={projectKey}
          onSelectProject={(key) => router.push(projectPath(key))}
          onNewProject={() => overlays.setShowNewProject(true)}
        />
        <SidebarInset className="min-w-0">
          <AppHeader
            title={
              <ShellHeaderTitle
                route={route}
                projectName={project?.project.name ?? 'Project'}
                issueIdentifier={issueQuery.data?.identifier ?? null}
              />
            }
            hasProject={!!project}
            onOpenCommand={() => overlays.setShowCommand(true)}
            onNewIssue={openNewIssue}
            chatActive={overlays.chatEnabled}
            onToggleChat={overlays.toggleChat}
          />

          {errorMsg && !forbidden && (
            <div className="border-b border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {errorMsg}
            </div>
          )}

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <ShellBody
              forbidden={forbidden}
              hasProject={!!project}
              hasError={!!errorMsg}
              projectsLoaded={projectsLoaded}
              projectCount={projects.length}
            >
              {children}
            </ShellBody>
          </div>
        </SidebarInset>

        <CommandLayer
          open={overlays.showCommand}
          onOpenChange={overlays.setShowCommand}
          projects={projects}
          currentProjectKey={projectKey}
          onBoard={route.onBoard}
          view={editor.view}
          currentIssueId={currentIssueId}
          onViewChange={editor.changeView}
          onNewIssue={openNewIssue}
          // Handled by the kanban board's selection provider (mounted only on the
          // board); the constant matches BOARD_SELECT_ALL_EVENT in useSelection.
          onSelectAll={() => window.dispatchEvent(new Event('board:select-all'))}
          onNewProject={() => overlays.setShowNewProject(true)}
          onSelectProject={(key) => router.push(projectPath(key))}
          onOpenIssue={(seq) => projectKey && router.push(issuePath(projectKey, seq))}
          onIssueDeleted={onIssueDeleted}
        />

        <ShellOverlays project={project} projectKey={projectKey} overlays={overlays} />
      </SidebarProvider>
    </ShellCtx.Provider>
  );
}
