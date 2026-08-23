import { ListTree } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type Maps } from '@/utils/project';
import { subtaskProgress } from '@/utils/subtasks';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSubtasks } from '../../context/useSubtasks';

// How far an issue's subtasks have got, shown next to its title on the row the
// subtask rows sit under. Renders nothing when the issue has no subtasks, when
// every one of them is canceled, or while the Subtasks display option is off.
export function SubtaskProgress({ issueId, maps }: { issueId: number; maps: Maps }) {
  const t = useTranslations('workItems');
  const subtasks = useSubtasks(issueId);
  const { done, total } = subtaskProgress(subtasks, maps.columnById);
  if (total === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
          <ListTree className="size-3" />
          {done}/{total}
        </span>
      </TooltipTrigger>
      <TooltipContent>{t('subtasksDone', { done, total })}</TooltipContent>
    </Tooltip>
  );
}
