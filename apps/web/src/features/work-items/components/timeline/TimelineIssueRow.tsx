import { useDraggable } from '@dnd-kit/core';
import { type BoardIssue, type ProjectDetail, type Issue } from '@/lib/api';
import { type Maps } from '@/utils/project';
import { useIsPhone } from '@/hooks/useIsPhone';
import { cn } from '@/lib/utils';
import IssueContextMenu from '@/features/issue/components/actions/IssueContextMenu';
import { type TimelineDragMode } from '../../hooks/useTimelineDrag';
import { ROW_H, type Span } from '../../utils/timeline';
import { IssueIdentifier } from '../shared/IssueIdentifier';
import { SubtaskProgress } from '../shared/SubtaskProgress';
import { TimelineBar } from './TimelineBar';

// One issue row: the sticky label on the left and its bar on the day track.
// Dragging the label moves the issue between sections and reorders it inside one
// (the drop targets are the blocks around it); the bar moves the issue in time.
// A click on either opens the issue.
export function TimelineIssueRow({
  project,
  issue,
  maps,
  span,
  rect,
  color,
  active,
  indented,
  labelW,
  trackWidth,
  dayLines,
  todayInRange,
  todayLeft,
  readOnly,
  onBeginDrag,
  onOpen,
}: {
  project: ProjectDetail;
  issue: BoardIssue;
  maps: Maps;
  span: Span;
  rect: { left: number; width: number };
  color: string;
  active: boolean;
  // Rows under a sub-section are indented to sit below their sub-header.
  indented: boolean;
  labelW: number;
  trackWidth: number;
  dayLines: { backgroundImage: string };
  todayInRange: boolean;
  todayLeft: number;
  // In a read-only share nothing is draggable; a click still opens the issue.
  readOnly?: boolean;
  onBeginDrag: (e: React.PointerEvent, issue: Issue, mode: TimelineDragMode) => void;
  onOpen: (id: number) => void;
}) {
  // Drag is disabled on phones so a touch scrolls the timeline instead of picking
  // up a row (see the `sm:touch-none` below).
  const isPhone = useIsPhone();
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: issue.id,
    disabled: isPhone || readOnly,
  });

  return (
    <div
      className={cn('flex border-b hover:bg-accent/20', isDragging && 'opacity-40')}
      style={{ height: ROW_H }}
    >
      <IssueContextMenu project={project} issue={issue}>
        <div
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          className={cn(
            'sticky left-0 z-10 flex shrink-0 items-center gap-2 overflow-hidden border-r bg-background pr-3 sm:touch-none',
            indented ? 'pl-7' : 'pl-3',
            readOnly ? 'cursor-pointer' : 'cursor-grab',
          )}
          style={{ width: labelW }}
          onClick={(e) => {
            e.preventDefault();
            onOpen(issue.id);
          }}
        >
          <IssueIdentifier
            issue={issue}
            className="text-xs text-muted-foreground tabular-nums"
            onOpenParent={onOpen}
          />
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{issue.title}</span>
          <SubtaskProgress issueId={issue.id} maps={maps} />
        </div>
      </IssueContextMenu>
      <div className="relative" style={{ width: trackWidth, ...dayLines }}>
        {todayInRange && (
          <div
            className="absolute top-0 bottom-0 z-0 w-px bg-primary/40"
            style={{ left: todayLeft }}
          />
        )}
        <TimelineBar
          issue={issue}
          span={span}
          rect={rect}
          color={color}
          active={active}
          readOnly={readOnly}
          onBeginDrag={onBeginDrag}
          onOpen={onOpen}
        />
      </div>
    </div>
  );
}
