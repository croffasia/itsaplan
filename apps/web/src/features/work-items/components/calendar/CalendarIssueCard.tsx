import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import { useIsPhone } from '@/hooks/useIsPhone';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import IssueContextMenu from '@/features/issue/components/actions/IssueContextMenu';

// Memoized because the unscheduled panel renders again on every scroll step.
export const CalendarIssueCard = memo(function CalendarIssueCard({
  project,
  issue,
  color,
  onOpen,
  multiline = false,
  dayLabel,
}: {
  project: ProjectDetail;
  issue: Issue;
  color: string;
  onOpen: (id: number) => void;
  // A narrow column gives the title its own lines instead of cutting it short.
  multiline?: boolean;
  // For a list that has no day headers.
  dayLabel?: string;
}) {
  // Drag is disabled on phones, and without work_items edit (scheduling an issue
  // by dropping it on a day is an issue edit).
  const { can } = usePermissions();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.id,
    disabled: useIsPhone() || !can('work_items', 'edit'),
  });
  return (
    <IssueContextMenu project={project} issue={issue}>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={(e) => {
          e.preventDefault();
          onOpen(issue.id);
        }}
        className={cn(
          'kanban-card flex cursor-pointer items-center gap-x-2 gap-y-1 rounded-md p-2 text-xs',
          multiline && 'flex-wrap',
          isDragging && 'opacity-40',
        )}
      >
        <span
          className="inline-block size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="shrink-0 text-muted-foreground tabular-nums">{issue.identifier}</span>
        <span
          className={cn(
            'text-foreground',
            multiline ? 'line-clamp-3 basis-full break-words' : 'truncate',
          )}
        >
          {issue.title}
        </span>
        {dayLabel && <span className="ms-auto shrink-0 text-muted-foreground">{dayLabel}</span>}
      </div>
    </IssueContextMenu>
  );
});
