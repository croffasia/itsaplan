import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import { dropId } from '../../utils/calendar';
import { CalendarDropZone } from './CalendarDropZone';
import { CalendarIssueCard } from './CalendarIssueCard';

// One drop target for the whole week: the dropped issue keeps its weekday.
export function CalendarWeekList({
  project,
  firstDay,
  entries,
  dot,
  onOpen,
}: {
  project: ProjectDetail;
  firstDay: string;
  entries: { issue: Issue; dayLabel: string }[];
  dot: (issue: Issue) => string;
  onOpen: (id: number) => void;
}) {
  return (
    <CalendarDropZone
      id={dropId('week', firstDay)}
      className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5"
    >
      {entries.map(({ issue, dayLabel }) => (
        <CalendarIssueCard
          key={issue.id}
          project={project}
          issue={issue}
          color={dot(issue)}
          onOpen={onOpen}
          dayLabel={dayLabel}
        />
      ))}
    </CalendarDropZone>
  );
}
