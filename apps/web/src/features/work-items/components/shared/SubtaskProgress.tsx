import { ChevronDown, ChevronRight, ListTree } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type Maps } from '@/utils/project';
import { subtaskProgress } from '@/utils/subtasks';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSubtasks } from '../../context/useSubtasks';

// How far an issue's subtasks have got, shown next to its title on the row the
// subtask rows sit under. With onToggle it also folds those rows away, which is
// what the chevron says. Renders nothing when the issue has no subtasks, when
// every one of them is canceled, or while the Subtasks display option is off.
export function SubtaskProgress({
  issueId,
  maps,
  open,
  onToggle,
}: {
  issueId: number;
  maps: Maps;
  open?: boolean;
  onToggle?: () => void;
}) {
  const t = useTranslations('workItems');
  const subtasks = useSubtasks(issueId);
  const { done, total } = subtaskProgress(subtasks, maps.columnById);
  if (total === 0) return null;

  const tally = (
    <>
      <ListTree className="size-3" />
      {done}/{total}
    </>
  );
  const className =
    'flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground tabular-nums';
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {onToggle ? (
          <button
            type="button"
            // The row opens the issue on click, so the toggle has to keep the
            // click to itself.
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onToggle();
            }}
            className={cn(className, '-mx-1 rounded px-1 hover:bg-accent/50 hover:text-foreground')}
          >
            <Chevron className="size-3" />
            {tally}
          </button>
        ) : (
          <span className={className}>{tally}</span>
        )}
      </TooltipTrigger>
      <TooltipContent>{t('subtasksDone', { done, total })}</TooltipContent>
    </Tooltip>
  );
}
