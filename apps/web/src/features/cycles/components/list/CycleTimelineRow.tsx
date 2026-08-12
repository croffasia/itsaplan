import { CalendarRange, CircleDashed } from 'lucide-react';
import type { Cycle } from '@/lib/api';
import { CYCLE_STATUS_META } from '@/utils/cycleMeta';
import { formatShortDate } from '@/utils/dates';
import { progressPercent } from '@/utils/progress';
import { cn } from '@/lib/utils';
import type { CycleDragMode } from '../../hooks/useCycleDrag';
import { cycleLength, movableEnds } from '../../utils/cycleDates';
import { CYCLE_ROW_H } from '../../utils/cycleTimeline';
import CycleInfoPopover from './CycleInfoPopover';
import { useTranslations } from 'next-intl';

// One cycle row: the sticky label on the left and its bar on the day track. The bar
// moves the cycle or resizes one end, within what the cycle's status still allows.
// The length and issue counts read after the bar, so a short bar still has room for
// them. With edit rights every gesture on the bar goes through the drag handler,
// which opens the cycle when the pointer did not travel; without them the bar is a
// plain click that opens it.
export default function CycleTimelineRow({
  cycle,
  projectKey,
  rect,
  labelW,
  trackWidth,
  dayLines,
  todayInRange,
  todayLeft,
  canEdit,
  onBeginDrag,
  onOpen,
}: {
  cycle: Cycle;
  projectKey: string;
  rect: { left: number; width: number };
  labelW: number;
  trackWidth: number;
  dayLines: { backgroundImage: string };
  todayInRange: boolean;
  todayLeft: number;
  canEdit: boolean;
  onBeginDrag: (e: React.PointerEvent, cycle: Cycle, mode: CycleDragMode) => void;
  onOpen: (id: number) => void;
}) {
  const t = useTranslations('cycles');
  const color = CYCLE_STATUS_META[cycle.status].color;
  const ends = movableEnds(cycle.status);
  const canMove = canEdit && ends.move;

  return (
    <div className="flex border-b hover:bg-accent/20" style={{ height: CYCLE_ROW_H }}>
      <div
        className="sticky left-0 z-10 flex shrink-0 items-center overflow-hidden border-r bg-background px-3"
        style={{ width: labelW }}
      >
        <CycleInfoPopover cycle={cycle} projectKey={projectKey} />
      </div>

      <div className="relative" style={{ width: trackWidth, ...dayLines }}>
        {todayInRange && (
          <div
            className="absolute top-0 bottom-0 z-0 w-px bg-primary/40"
            style={{ left: todayLeft }}
          />
        )}
        <div
          onPointerDown={canEdit ? (e) => onBeginDrag(e, cycle, 'move') : undefined}
          onClick={canEdit ? undefined : () => onOpen(cycle.id)}
          title={`${formatShortDate(cycle.startDate)} – ${formatShortDate(cycle.endDate)}`}
          className={cn(
            'group absolute top-1/2 z-10 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded px-1.5 text-white select-none',
            canMove ? 'cursor-grab' : 'cursor-pointer',
          )}
          style={{ left: rect.left, width: rect.width, backgroundColor: color }}
        >
          <div
            className="absolute inset-y-0 left-0 bg-white/30"
            style={{ width: `${progressPercent(cycle.progress)}%` }}
          />
          {canEdit && ends.start && (
            <span
              onPointerDown={(e) => onBeginDrag(e, cycle, 'start')}
              className="absolute top-0 left-0 h-full w-1.5 cursor-ew-resize bg-white/40 opacity-0 group-hover:opacity-100"
            />
          )}
          <span className="relative truncate text-[11px] leading-none">{cycle.name}</span>
          {canEdit && ends.end && (
            <span
              onPointerDown={(e) => onBeginDrag(e, cycle, 'end')}
              className="absolute top-0 right-0 h-full w-1.5 cursor-ew-resize bg-white/40 opacity-0 group-hover:opacity-100"
            />
          )}
        </div>

        <div
          className="pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center gap-2.5 text-[11px] whitespace-nowrap text-muted-foreground tabular-nums"
          style={{ left: rect.left + rect.width + 8 }}
        >
          <span className="flex items-center gap-1" title={t('columns.length')}>
            <CalendarRange className="size-3" />
            {cycleLength(cycle)}d
          </span>
          {cycle.progress.total > 0 && (
            <span className="flex items-center gap-1" title={t('issuesDone')}>
              <CircleDashed className="size-3" />
              {cycle.progress.completed}/{cycle.progress.total - cycle.progress.canceled}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
