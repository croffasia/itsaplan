import { type ProjectDetail, type Issue } from '@/lib/api';
import { cn } from '@/lib/utils';
import IssueContextMenu from '@/features/issue/components/actions/IssueContextMenu';
import { type TimelineDragMode } from '../../hooks/useTimelineDrag';
import { ROW_H, type Span } from '../../utils/timeline';

// One issue row: the sticky label on the left and its draggable bar on the day
// track. The bar moves the issue (rewriting dates and, on a vertical move, the
// selected group) or resizes one end; the start/end handles appear on hover.
export function TimelineIssueRow({
  project,
  issue,
  span,
  rect,
  color,
  active,
  isDrop,
  groupKey,
  labelW,
  trackWidth,
  dayLines,
  todayInRange,
  todayLeft,
  onBeginDrag,
  onOpen,
}: {
  project: ProjectDetail;
  issue: Issue;
  span: Span;
  rect: { left: number; width: number };
  color: string;
  active: boolean;
  isDrop: boolean;
  groupKey: string;
  labelW: number;
  trackWidth: number;
  dayLines: { backgroundImage: string };
  todayInRange: boolean;
  todayLeft: number;
  onBeginDrag: (e: React.PointerEvent, issue: Issue, mode: TimelineDragMode) => void;
  onOpen: (id: number) => void;
}) {
  return (
    <div
      data-group-key={groupKey}
      className={cn('flex border-b', isDrop ? 'bg-accent/40' : 'hover:bg-accent/20')}
      style={{ height: ROW_H }}
    >
      <IssueContextMenu project={project} issue={issue}>
        <div
          className={cn(
            'sticky left-0 z-10 flex shrink-0 cursor-pointer items-center gap-2 overflow-hidden border-r px-3',
            isDrop ? 'bg-accent/40' : 'bg-background',
          )}
          style={{ width: labelW }}
          onClick={() => onOpen(issue.id)}
        >
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {issue.identifier}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{issue.title}</span>
        </div>
      </IssueContextMenu>
      <div className="relative" style={{ width: trackWidth, ...dayLines }}>
        {todayInRange && (
          <div
            className="absolute top-0 bottom-0 z-0 w-px bg-primary/40"
            style={{ left: todayLeft }}
          />
        )}
        <div
          onPointerDown={(e) => onBeginDrag(e, issue, 'move')}
          className={cn(
            'group absolute top-1/2 z-10 flex h-6 -translate-y-1/2 items-center rounded px-1.5 text-white select-none',
            active ? 'cursor-grabbing' : 'cursor-grab',
          )}
          style={{
            left: rect.left,
            width: rect.width,
            backgroundColor: color,
            opacity: span.inferredStart ? 0.8 : 1,
            borderLeft: span.inferredStart ? '2px dashed rgba(255,255,255,0.75)' : undefined,
          }}
          title={
            span.inferredStart ? 'Start inferred from the created date — drag to set it' : undefined
          }
        >
          <span
            onPointerDown={(e) => onBeginDrag(e, issue, 'start')}
            className="absolute top-0 left-0 h-full w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100"
            style={{ background: 'rgba(255,255,255,0.4)' }}
          />
          <span className="truncate text-[11px] leading-none">{issue.title}</span>
          <span
            onPointerDown={(e) => onBeginDrag(e, issue, 'end')}
            className="absolute top-0 right-0 h-full w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100"
            style={{ background: 'rgba(255,255,255,0.4)' }}
          />
        </div>
      </div>
    </div>
  );
}
