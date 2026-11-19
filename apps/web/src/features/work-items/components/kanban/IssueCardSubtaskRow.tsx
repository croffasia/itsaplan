import { useRef, useState } from 'react';
import type { Issue } from '@/lib/api/endpoints/issues';
import { type Maps } from '@/utils/project';
import { noDragProps } from '@/lib/dnd';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StateIcon } from '@/features/issue/components/shared/IssueIcons';
import { useSubtaskFold, useSubtasks } from '../../context/useSubtasks';
import { SubtaskProgress } from '../shared/SubtaskProgress';

// One subtask under a card. The tooltip opens only when the row cuts the title short.
export function IssueCardSubtaskRow({
  subtask,
  maps,
  onOpen,
  nested = false,
}: {
  subtask: Issue;
  maps: Maps;
  onOpen?: (id: number) => void;
  nested?: boolean;
}) {
  const titleRef = useRef<HTMLSpanElement>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const column = maps.columnById.get(subtask.columnId);
  const children = useSubtasks(subtask.id);
  const { open, toggle } = useSubtaskFold(nested);

  return (
    <>
      <div
        {...noDragProps}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          onOpen?.(subtask.id);
        }}
        className={cn(
          '-mx-1.5 flex min-w-0 items-center gap-2 rounded px-1.5',
          onOpen && 'cursor-pointer hover:bg-muted/70',
        )}
      >
        <Tooltip
          open={tooltipOpen}
          onOpenChange={(open) => {
            const title = titleRef.current;
            setTooltipOpen(open && !!title && title.scrollWidth > title.clientWidth);
          }}
        >
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex min-w-0 items-center gap-2 py-1 text-start',
                onOpen && 'cursor-pointer',
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
                ref={titleRef}
                dir="auto"
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
        <SubtaskProgress issueId={subtask.id} maps={maps} open={open} onToggle={onOpen && toggle} />
      </div>
      {open && children.length > 0 && (
        <div className="ms-1.5 flex min-w-0 flex-col gap-1 border-s border-border/50 ps-1.5">
          {children.map((child) => (
            <IssueCardSubtaskRow
              key={child.id}
              subtask={child}
              maps={maps}
              onOpen={onOpen}
              nested
            />
          ))}
        </div>
      )}
    </>
  );
}
