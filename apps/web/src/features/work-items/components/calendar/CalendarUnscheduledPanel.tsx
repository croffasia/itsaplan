import { useDroppable } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import { type ProjectDetail, type Issue } from '@/lib/api';
import { cn } from '@/lib/utils';
import { isCustomFieldKey, type DateField } from '@/utils/viewSettings';
import { CalendarUnscheduledCard } from './CalendarUnscheduledCard';

// Droppable id for the unscheduled panel; day cells use `day:<YYYY-MM-DD>`.
export const UNSCHEDULED_ID = 'unscheduled';

// The unscheduled panel — a drop target that clears an issue's date.
export function CalendarUnscheduledPanel({
  project,
  dateField,
  issues,
  dot,
  onOpen,
}: {
  project: ProjectDetail;
  dateField: DateField;
  issues: Issue[];
  dot: (issue: Issue) => string;
  onOpen: (id: number) => void;
}) {
  const t = useTranslations('workItems.calendar');
  const { setNodeRef, isOver } = useDroppable({ id: UNSCHEDULED_ID });
  // A custom field placement has no wording of its own; it reads as a plain date.
  const key = isCustomFieldKey(dateField) ? 'custom' : dateField;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex max-h-48 w-full shrink-0 flex-col border-t p-3 sm:max-h-none sm:w-64 sm:border-t-0 sm:border-l',
        isOver && 'bg-accent/40',
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {t(`noDate.${key}`)}
        <span className="text-muted-foreground">{issues.length}</span>
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto">
        {issues.map((issue) => (
          <CalendarUnscheduledCard
            key={issue.id}
            project={project}
            issue={issue}
            color={dot(issue)}
            onOpen={onOpen}
          />
        ))}
        {issues.length === 0 && (
          <span className="text-xs text-muted-foreground/50">{t(`allDated.${key}`)}</span>
        )}
      </div>
    </div>
  );
}
