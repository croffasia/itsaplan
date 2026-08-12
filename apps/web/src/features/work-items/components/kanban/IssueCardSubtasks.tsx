import { ListTree } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type Maps } from '@/utils/project';
import { subtaskProgress } from '@/utils/subtasks';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StateIcon } from '@/features/issue/components/shared/IssueIcons';
import { useSubtasks } from '../../context/useSubtasks';

// The issue's subtasks under its card, headed by how many of them are done. Each
// row names the subtask — state, identifier, title — since a subtask has no card
// of its own and these rows are where it shows on the board; clicking one opens
// it. Without onOpen (the drag preview) the rows are inert. Renders nothing for
// an issue with no subtasks.
export function IssueCardSubtasks({
  issueId,
  maps,
  onOpen,
}: {
  issueId: number;
  maps: Maps;
  onOpen?: (id: number) => void;
}) {
  const t = useTranslations('workItems');
  const subtasks = useSubtasks(issueId);
  if (subtasks.length === 0) return null;
  const progress = subtaskProgress(subtasks, maps.columnById);

  return (
    <div className="mt-2.5 flex flex-col gap-1 border-t border-border/50 pt-2">
      <span className="flex items-center gap-1.5 text-[10px] tracking-wide text-muted-foreground/70">
        <ListTree className="size-3 shrink-0 text-muted-foreground" />
        {t('subtasksProgress', { done: progress.done, total: progress.total })}
      </span>
      {subtasks.map((subtask) => {
        const column = maps.columnById.get(subtask.columnId);
        return (
          <Tooltip key={subtask.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                // The card above starts a drag on pointerdown and opens itself
                // on click; a subtask row must do neither.
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen?.(subtask.id);
                }}
                className={cn(
                  '-mx-1.5 flex items-center gap-2 rounded px-1.5 py-1 text-left',
                  onOpen && 'cursor-pointer hover:bg-muted/70',
                )}
              >
                {column && (
                  <StateIcon
                    stateType={column.stateType}
                    color={column.color}
                    className="size-3 shrink-0"
                  />
                )}
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {subtask.identifier}
                </span>
                <span
                  className={cn(
                    'truncate text-[11px] text-foreground/85',
                    column?.stateType === 'completed' && 'text-muted-foreground/70 line-through',
                  )}
                >
                  {subtask.title}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {subtask.title}
              {column && ` · ${column.name}`}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
