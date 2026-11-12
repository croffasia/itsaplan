import { useRef, useState } from 'react';
import type { Issue } from '@/lib/api/endpoints/issues';
import { type Maps } from '@/utils/project';
import { noDragProps } from '@/lib/dnd';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StateIcon } from '@/features/issue/components/shared/IssueIcons';
import { SubtaskProgress } from '../shared/SubtaskProgress';

// One subtask under a card. The tooltip opens only when the row cuts the title short.
export function IssueCardSubtaskRow({
  subtask,
  maps,
  onOpen,
}: {
  subtask: Issue;
  maps: Maps;
  onOpen?: (id: number) => void;
}) {
  const titleRef = useRef<HTMLSpanElement>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const column = maps.columnById.get(subtask.columnId);

  return (
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
          // The card above starts a drag on press and opens itself on click; a
          // subtask row must do neither.
          {...noDragProps}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
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
            ref={titleRef}
            className={cn(
              'truncate text-[11px] text-foreground/85',
              column?.stateType === 'completed' && 'text-muted-foreground/70 line-through',
            )}
          >
            {subtask.title}
          </span>
          <SubtaskProgress issueId={subtask.id} maps={maps} />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {subtask.title}
        {column && ` · ${column.name}`}
      </TooltipContent>
    </Tooltip>
  );
}
