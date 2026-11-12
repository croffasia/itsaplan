import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import { cn } from '@/lib/utils';
import { dropId } from '../../utils/calendar';
import { CalendarDropZone } from './CalendarDropZone';
import { CalendarIssueCard } from './CalendarIssueCard';
import { CalendarQuickAdd } from './CalendarQuickAdd';

export function CalendarDayColumn({
  project,
  dateKey,
  weekday,
  dayNumber,
  isToday,
  issues,
  dot,
  onOpen,
  onQuickAdd,
}: {
  project: ProjectDetail;
  dateKey: string;
  weekday: string;
  dayNumber: number;
  isToday: boolean;
  issues: Issue[];
  dot: (issue: Issue) => string;
  onOpen: (id: number) => void;
  onQuickAdd?: (day: string, title: string) => Promise<void>;
}) {
  return (
    <CalendarDropZone
      id={dropId('day', dateKey)}
      className="group/add flex min-h-0 min-w-0 flex-col border-s first:border-s-0"
    >
      <div className="flex flex-col items-start gap-1 border-b px-3 py-2">
        <span className="text-xs text-muted-foreground">{weekday}</span>
        <span
          className={cn(
            '-ms-1.5 rounded-md px-1.5 text-lg leading-7 font-medium text-foreground',
            isToday && 'bg-primary text-primary-foreground',
          )}
        >
          {dayNumber}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5">
        {issues.map((issue) => (
          <CalendarIssueCard
            key={issue.id}
            project={project}
            issue={issue}
            color={dot(issue)}
            onOpen={onOpen}
            multiline
          />
        ))}
      </div>
      {onQuickAdd && (
        <div className="px-1.5 pb-1.5">
          <CalendarQuickAdd onAdd={(title) => onQuickAdd(dateKey, title)} />
        </div>
      )}
    </CalendarDropZone>
  );
}
