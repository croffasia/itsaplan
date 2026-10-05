import { useTranslations } from 'next-intl';
import { WorkspaceRailActions } from '@/cloud';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { workspaceInitial, workspaceTileClass, workspaceTileStyle } from './utils/workspaceTile';

export default function ProjectSwitcherWorkspaceRail({
  workspaces,
  activeId,
  onPick,
}: {
  workspaces: WorkspaceSummary[];
  activeId: number;
  onPick: (workspaceId: number) => void;
}) {
  const t = useTranslations('nav');

  return (
    <div
      role="group"
      aria-label={t('projectPicker.workspaces')}
      className="flex w-14 shrink-0 flex-col items-center gap-2 overflow-y-auto border-e bg-sidebar/60 py-3"
    >
      {workspaces.map((workspace) => {
        const active = workspace.id === activeId;
        return (
          <Tooltip key={workspace.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={workspace.name}
                aria-pressed={active}
                onClick={() => onPick(workspace.id)}
                className={workspaceTileClass(active)}
                style={workspaceTileStyle(workspace.color)}
              >
                {workspaceInitial(workspace.name)}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{workspace.name}</TooltipContent>
          </Tooltip>
        );
      })}
      <WorkspaceRailActions />
    </div>
  );
}
