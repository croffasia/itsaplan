'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { teamPath } from '@/utils/paths';
import { useTeamsQuery } from '@/services/teams.service';
import { useWorkspacesQuery } from '@/services/workspaces.service';
import NewTeamModal from './components/NewTeamModal';
import TeamsPageView from './components/TeamsPageView';
import TeamsRail from './components/TeamsRail';
import WorkspaceSectionNav from './components/workspace/WorkspaceSectionNav';
import WorkspacesRail from './components/workspace/WorkspacesRail';
import { useRouteTeam } from './hooks/useRouteTeam';
import { useRouteWorkspaceId } from './hooks/useRouteWorkspaceId';

// The rails every team and workspace route is opened from: the workspaces the account
// sees, then the open one — its settings for an owner or admin, and the account's teams
// in it. The open workspace is the one the path names, directly or through its team.
// The team list carries each team's counters, so the section rail beside it shows them
// without a request of its own.
export default function ManageTeamsLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('teams.manage');
  const tw = useTranslations('teams.workspace');
  const { data, isPending } = useTeamsQuery();
  const workspaces = useWorkspacesQuery().data ?? [];
  const router = useRouter();
  const routeTeam = useRouteTeam();
  const routeWorkspaceId = useRouteWorkspaceId() ?? routeTeam?.workspaceId;
  const workspace = workspaces.find((entry) => entry.id === routeWorkspaceId) ?? workspaces[0];
  const teams = data ?? [];
  const [creating, setCreating] = useState(false);

  return (
    <TeamsPageView
      label={t('label')}
      rail={
        <WorkspacesRail workspaces={workspaces} teams={teams} activeId={workspace?.id ?? null} />
      }
      list={
        <div className="space-y-6">
          {workspace && (
            <div className="flex items-baseline gap-2 px-2 pt-1">
              <h2 dir="auto" className="min-w-0 truncate text-[15px] font-semibold">
                {workspace.name}
              </h2>
              {workspace.role && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {tw(`roles.${workspace.role}`)}
                </span>
              )}
            </div>
          )}
          {workspace?.role && <WorkspaceSectionNav workspace={workspace} />}
          <TeamsRail
            teams={workspace ? teams.filter((team) => team.workspaceId === workspace.id) : teams}
            isPending={isPending}
            activeId={routeTeam?.id ?? null}
            onCreate={workspace?.canCreateTeam ? () => setCreating(true) : undefined}
            workspaceRole={workspace?.role ?? null}
          />
        </div>
      }
    >
      {children}

      {creating && workspace && (
        <NewTeamModal
          workspaceId={workspace.id}
          onClose={() => setCreating(false)}
          onCreated={(team) => router.push(teamPath(team.ref))}
        />
      )}
    </TeamsPageView>
  );
}
