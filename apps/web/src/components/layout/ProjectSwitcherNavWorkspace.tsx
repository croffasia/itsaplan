import { useTranslations } from 'next-intl';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { workspaceInitial, workspaceRowClass, workspaceTileStyle } from './utils/workspaceTile';

export default function ProjectSwitcherNavWorkspace({
  workspace,
  active,
  onPick,
}: {
  workspace: WorkspaceSummary;
  active: boolean;
  onPick: () => void;
}) {
  const tw = useTranslations('teams.workspace');

  return (
    <Button
      variant="ghost"
      aria-current={active || undefined}
      onClick={onPick}
      className={cn(workspaceRowClass, !active && 'text-muted-foreground')}
    >
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground"
        style={workspaceTileStyle(workspace.color)}
      >
        {workspaceInitial(workspace.name)}
      </span>
      <span
        dir="auto"
        className={cn('min-w-0 flex-1 truncate text-start', active && 'font-semibold')}
      >
        {workspace.name}
      </span>
      {active && workspace.role && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {tw(`roles.${workspace.role}`)}
        </span>
      )}
    </Button>
  );
}
