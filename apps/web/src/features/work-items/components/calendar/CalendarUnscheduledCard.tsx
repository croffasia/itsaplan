import { useDraggable } from '@dnd-kit/core';
import { type ProjectDetail, type Issue } from '@/lib/api';
import { useIsPhone } from '@/hooks/useIsPhone';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import IssueContextMenu from '@/features/issue/components/actions/IssueContextMenu';

// A draggable card in the unscheduled panel.
export function CalendarUnscheduledCard({
  project,
  issue,
  color,
  onOpen,
}: {
  project: ProjectDetail;
  issue: Issue;
  color: string;
  onOpen: (id: number) => void;
}) {
  // Drag is disabled on phones so a touch scrolls instead of picking up the issue
  // (see the `sm:touch-none` below), and without work_items edit (scheduling a
  // issue by dropping it on a day is an issue edit).
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
        onClick={() => onOpen(issue.id)}
        className={cn(
          'kanban-card flex cursor-pointer items-center gap-2 rounded-md p-2 text-xs sm:touch-none',
          isDragging && 'opacity-40',
        )}
      >
        <span
          className="inline-block size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="shrink-0 text-muted-foreground tabular-nums">{issue.identifier}</span>
        <span className="truncate text-foreground">{issue.title}</span>
      </div>
    </IssueContextMenu>
  );
}
