'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { WorkspaceRailActions } from '@/cloud';
import type { Team } from '@/lib/api/endpoints/teams';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import { teamPath, workspacePath } from '@/utils/paths';
import {
  workspaceInitial,
  workspaceTileClass,
  workspaceTileStyle,
} from '@/components/layout/utils/workspaceTile';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// The workspaces the account sees, as the page's leftmost rail. One the caller manages
// opens on its settings; any other is seen only through a team of it, and opens on that
// team.
export default function WorkspacesRail({
  workspaces,
  teams,
  activeId,
}: {
  workspaces: WorkspaceSummary[];
  teams: Team[];
  activeId: number | null;
}) {
  const t = useTranslations('teams.workspace');

  return (
    <nav
      aria-label={t('rail')}
      className="flex shrink-0 items-center gap-2 overflow-x-auto border-b bg-sidebar/60 p-3 lg:w-14 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:border-e lg:border-b-0 lg:px-0"
    >
      {workspaces.map((workspace) => {
        const team = teams.find((entry) => entry.workspaceId === workspace.id);
        const href = workspace.role ? workspacePath(workspace.id) : team && teamPath(team.ref);
        if (!href) return null;
        const active = workspace.id === activeId;
        return (
          <Tooltip key={workspace.id}>
            <TooltipTrigger asChild>
              <Link
                href={href}
                aria-label={workspace.name}
                aria-current={active || undefined}
                className={workspaceTileClass(active)}
                style={workspaceTileStyle(workspace.color)}
              >
                {workspaceInitial(workspace.name)}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{workspace.name}</TooltipContent>
          </Tooltip>
        );
      })}
      <WorkspaceRailActions />
    </nav>
  );
}
