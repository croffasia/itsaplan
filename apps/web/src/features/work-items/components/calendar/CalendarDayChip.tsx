import { useDraggable } from '@dnd-kit/core';
import { type ProjectDetail, type Issue } from '@/lib/api';
import { useIsPhone } from '@/hooks/useIsPhone';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import IssueContextMenu from '@/features/issue/components/actions/IssueContextMenu';

// A draggable chip inside a day cell. A click (no drag) opens the issue; a drag
// moves it to another day or the unscheduled panel.
export function CalendarDayChip({
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
  // (see the `sm:touch-none` below), and without work_items edit (rescheduling a
  // issue is an issue edit).
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
          e.stopPropagation();
          onOpen(issue.id);
        }}
        className={cn(
          'flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-accent sm:touch-none',
          isDragging && 'opacity-40',
        )}
        title={`${issue.identifier} ${issue.title}`}
      >
        <span
          className="inline-block size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="truncate text-foreground">{issue.title}</span>
      </div>
    </IssueContextMenu>
  );
}
