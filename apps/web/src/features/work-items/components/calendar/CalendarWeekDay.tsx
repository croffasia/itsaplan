import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import { cn } from '@/lib/utils';
import { dropId } from '../../utils/calendar';
import { CalendarDropZone } from './CalendarDropZone';
import { CalendarIssueCard } from './CalendarIssueCard';
import { CalendarQuickAdd } from './CalendarQuickAdd';

export function CalendarWeekDay({
  project,
  dateKey,
  label,
  isToday,
  issues,
  dot,
  onOpen,
  onQuickAdd,
}: {
  project: ProjectDetail;
  dateKey: string;
  label: string;
  isToday: boolean;
  issues: Issue[];
  dot: (issue: Issue) => string;
  onOpen: (id: number) => void;
  onQuickAdd?: (day: string, title: string) => Promise<void>;
}) {
  return (
    <CalendarDropZone
      id={dropId('day', dateKey)}
      className="group/add flex flex-1 flex-col gap-1 border-b p-1.5 last:border-b-0"
    >
      <span
        className={cn(
          'w-fit rounded px-1.5 text-xs text-muted-foreground',
          isToday && 'bg-primary font-medium text-primary-foreground',
        )}
      >
        {label}
      </span>
      {issues.map((issue) => (
        <CalendarIssueCard
          key={issue.id}
          project={project}
          issue={issue}
          color={dot(issue)}
          onOpen={onOpen}
        />
      ))}
      {onQuickAdd && (
        <div className="mt-auto">
          <CalendarQuickAdd onAdd={(title) => onQuickAdd(dateKey, title)} />
        </div>
      )}
    </CalendarDropZone>
  );
}
