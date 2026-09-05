import { useTranslations } from 'next-intl';
import { type BoardIssue, type Issue } from '@/lib/api';
import { isBlocked } from '@/utils/issueLinks';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type TimelineDragMode } from '../../hooks/useTimelineDrag';
import { type Span } from '../../utils/timeline';

const BLOCKED_HATCH =
  'repeating-linear-gradient(45deg, color-mix(in oklab, var(--destructive) 70%, transparent) 0 4px, transparent 4px 9px)';

// The issue's bar on the day track. Dragging it moves the issue in time — the
// whole span, or one end from the handles that appear on hover. It never moves
// the row between sections: that is the label column's drag.
export function TimelineBar({
  issue,
  span,
  rect,
  color,
  active,
  readOnly,
  onBeginDrag,
  onOpen,
}: {
  issue: BoardIssue;
  span: Span;
  rect: { left: number; width: number };
  color: string;
  // A drag on this bar is in progress, so `rect` is the previewed span.
  active: boolean;
  // In a read-only share the bar cannot be dragged or resized; a click on it
  // still opens the issue.
  readOnly?: boolean;
  onBeginDrag: (e: React.PointerEvent, issue: Issue, mode: TimelineDragMode) => void;
  onOpen: (id: number) => void;
}) {
  const t = useTranslations('workItems.timeline');
  const blocked = isBlocked(issue);
  let cursor = 'cursor-ew-resize';
  if (readOnly) cursor = 'cursor-pointer';
  else if (active) cursor = 'cursor-grabbing';
  const bar = (
    <div
      onPointerDown={readOnly ? undefined : (e) => onBeginDrag(e, issue, 'move')}
      onClick={
        readOnly
          ? (e) => {
              e.preventDefault();
              onOpen(issue.id);
            }
          : undefined
      }
      className={cn(
        'group absolute top-1/2 z-10 flex h-6 -translate-y-1/2 items-center rounded px-1.5 text-white select-none',
        cursor,
      )}
      style={{
        left: rect.left,
        width: rect.width,
        backgroundColor: color,
        // Held up by another issue: red hatching over the fill and a ring around
        // it. Hatched rather than filled, so the bar keeps showing the issue's
        // status color underneath.
        backgroundImage: blocked ? BLOCKED_HATCH : undefined,
        boxShadow: blocked ? '0 0 0 1.5px var(--destructive)' : undefined,
        opacity: span.inferredStart ? 0.8 : 1,
        borderLeft: span.inferredStart ? '2px dashed rgba(255,255,255,0.75)' : undefined,
      }}
    >
      {!readOnly && (
        <span
          onPointerDown={(e) => onBeginDrag(e, issue, 'start')}
          className="absolute top-0 left-0 h-full w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100"
          style={{ background: 'rgba(255,255,255,0.4)' }}
        />
      )}
      <span className="truncate text-[11px] leading-none">{issue.title}</span>
      {!readOnly && (
        <span
          onPointerDown={(e) => onBeginDrag(e, issue, 'end')}
          className="absolute top-0 right-0 h-full w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100"
          style={{ background: 'rgba(255,255,255,0.4)' }}
        />
      )}
    </div>
  );
  if (!span.inferredStart) return bar;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{bar}</TooltipTrigger>
      <TooltipContent>{t('inferredStartDraggable')}</TooltipContent>
    </Tooltip>
  );
}
