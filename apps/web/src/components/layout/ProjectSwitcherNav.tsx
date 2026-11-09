import { Fragment } from 'react';
import Link from 'next/link';
import { Settings2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WorkspaceRailActions } from '@/cloud';
import type { Team } from '@/lib/api/endpoints/teams';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import { manageTeamsPath, teamPath, workspacePath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import type { ProjectSwitcherScope } from './ProjectSwitcher';
import ProjectSwitcherNavScopes from './ProjectSwitcherNavScopes';
import ProjectSwitcherNavWorkspace from './ProjectSwitcherNavWorkspace';

export default function ProjectSwitcherNav({
  workspaces,
  workspace,
  teams,
  currentTeam,
  scope,
  onScopeChange,
  onPickWorkspace,
  onClose,
}: {
  workspaces: WorkspaceSummary[];
  workspace?: WorkspaceSummary;
  teams: Team[];
  currentTeam?: Team;
  scope: ProjectSwitcherScope;
  onScopeChange: (scope: ProjectSwitcherScope) => void;
  onPickWorkspace: (workspaceId: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations('nav');
  const scopes = (
    <ProjectSwitcherNavScopes teams={teams} scope={scope} onScopeChange={onScopeChange} />
  );

  return (
    <nav
      aria-label={t('projectPicker.workspaces')}
      className="flex max-h-52 shrink-0 flex-col gap-0.5 overflow-y-auto border-b bg-sidebar/60 p-2 md:max-h-none md:w-60 md:border-e md:border-b-0"
    >
      {workspace ? (
        <>
          <p className="px-2 pt-1 pb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            {t('projectPicker.workspaces')}
          </p>
          {workspaces.map((entry) => (
            <Fragment key={entry.id}>
              <ProjectSwitcherNavWorkspace
                workspace={entry}
                active={entry.id === workspace.id}
                onPick={() => onPickWorkspace(entry.id)}
              />
              {entry.id === workspace.id && scopes}
            </Fragment>
          ))}
          <WorkspaceRailActions variant="row" />
        </>
      ) : (
        scopes
      )}
      <div className="mt-auto flex flex-col gap-0.5 border-t pt-2">
        <Button asChild variant="ghost" size="sm" className="justify-start font-normal">
          <Link
            href={currentTeam ? teamPath(currentTeam.ref) : manageTeamsPath()}
            onClick={onClose}
          >
            <Users />
            {t('manageTeams')}
          </Link>
        </Button>
        {workspace?.role && (
          <Button asChild variant="ghost" size="sm" className="justify-start font-normal">
            <Link href={workspacePath(workspace.id, 'info')} onClick={onClose}>
              <Settings2 />
              {t('projectPicker.workspaceSettings')}
            </Link>
          </Button>
        )}
      </div>
    </nav>
  );
}
