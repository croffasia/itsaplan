import { useIconHover } from '@animateicons/react';
import { ChevronDownIcon } from '@animateicons/react/lucide/chevron-down-icon';
import { ChevronRightIcon } from '@animateicons/react/lucide/chevron-right-icon';
import { ListTreeIcon } from '@animateicons/react/lucide/list-tree-icon';
import { useTranslations } from 'next-intl';
import { type Maps } from '@/utils/project';
import { subtaskProgress } from '@/utils/subtasks';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSubtasks } from '../../context/useSubtasks';

// How far an issue's subtasks have got, shown next to its title on its row or
// subtask row. With onToggle it also folds the subtask rows away, which is what the
// chevron says. Renders nothing when the issue has no subtasks, when
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
  const hover = useIconHover({
    trigger: [
      { icon: 'chevron', trigger: 'hover' },
      { icon: 'list', trigger: 'hover' },
    ],
  });
  if (total === 0) return null;

  const tally = (
    <>
      <ListTreeIcon {...hover.icon.list} size={12} />
      {done}/{total}
    </>
  );
  const className =
    'flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground tabular-nums';
  const Chevron = open ? ChevronDownIcon : ChevronRightIcon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {onToggle ? (
          <button
            type="button"
            {...hover.trigger}
            // The row opens the issue on click, so the toggle has to keep the
            // click to itself.
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onToggle();
            }}
            className={cn(className, '-mx-1 rounded px-1 hover:bg-accent/50 hover:text-foreground')}
          >
            <Chevron {...hover.icon.chevron} size={12} />
            {tally}
          </button>
        ) : (
          <span {...hover.trigger} className={className}>
            {tally}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>{t('subtasksDone', { done, total })}</TooltipContent>
    </Tooltip>
  );
}
