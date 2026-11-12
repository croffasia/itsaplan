import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import { cn } from '@/lib/utils';
import { dropId } from '../../utils/calendar';
import { CalendarDropZone } from './CalendarDropZone';
import { CalendarDayChip } from './CalendarDayChip';
import { CalendarDayOverflow } from './CalendarDayOverflow';
import { CalendarQuickAdd } from './CalendarQuickAdd';

// How many chips a day cell shows before collapsing the rest into "+N".
const MAX_CHIPS = 3;

// A droppable day cell that reschedules a dropped issue to its date.
export function CalendarDayCell({
  project,
  dateKey,
  dayNumber,
  inMonth,
  isToday,
  issues,
  dot,
  onOpen,
  onQuickAdd,
}: {
  project: ProjectDetail;
  dateKey: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  issues: Issue[];
  dot: (issue: Issue) => string;
  onOpen: (id: number) => void;
  onQuickAdd?: (day: string, title: string) => Promise<void>;
}) {
  let dayNumberClass = 'text-muted-foreground/50';
  if (isToday)
    dayNumberClass =
      'bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full font-semibold';
  else if (inMonth) dayNumberClass = 'text-foreground';

  return (
    <CalendarDropZone
      id={dropId('day', dateKey)}
      className={cn(
        'group/add flex min-h-0 flex-col gap-0.5 overflow-hidden border-t border-l p-1 [&:nth-child(-n+7)]:border-t-0 [&:nth-child(7n+1)]:border-l-0',
        !inMonth && 'bg-muted/20',
      )}
    >
      <div className="flex h-5 shrink-0 items-center gap-1 px-1">
        {onQuickAdd && <CalendarQuickAdd compact onAdd={(title) => onQuickAdd(dateKey, title)} />}
        <span className={cn('ms-auto text-xs', dayNumberClass)}>{dayNumber}</span>
      </div>
      <div className="flex flex-col gap-0.5 overflow-y-auto">
        {issues.slice(0, MAX_CHIPS).map((issue) => (
          <CalendarDayChip
            key={issue.id}
            project={project}
            issue={issue}
            color={dot(issue)}
            onOpen={onOpen}
          />
        ))}
        {issues.length > MAX_CHIPS && (
          <CalendarDayOverflow
            issues={issues}
            hidden={issues.length - MAX_CHIPS}
            dot={dot}
            onOpen={onOpen}
          />
        )}
      </div>
    </CalendarDropZone>
  );
}
