import { useDroppable } from '@dnd-kit/core';
import { type ProjectDetail, type Issue } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CalendarDayChip } from './CalendarDayChip';
import { CalendarDayOverflow } from './CalendarDayOverflow';

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
}: {
  project: ProjectDetail;
  dateKey: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  issues: Issue[];
  dot: (issue: Issue) => string;
  onOpen: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dateKey}` });

  let dayNumberClass = 'text-muted-foreground/50';
  if (isToday)
    dayNumberClass =
      'bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full font-semibold';
  else if (inMonth) dayNumberClass = 'text-foreground';

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-0 flex-col gap-0.5 overflow-hidden border-t border-l p-1 [&:nth-child(-n+7)]:border-t-0 [&:nth-child(7n+1)]:border-l-0',
        !inMonth && 'bg-muted/20',
        isOver && 'bg-accent/40',
      )}
    >
      <div className="flex justify-end px-1">
        <span className={cn('text-xs', dayNumberClass)}>{dayNumber}</span>
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
    </div>
  );
}
