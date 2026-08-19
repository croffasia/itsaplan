import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Cycle } from '@/lib/api';
import { cyclePath } from '@/utils/paths';
import { usePermissions } from '@/hooks/usePermissions';
import { useElementWidth } from '@/hooks/useElementWidth';
import { usePersistedWidth } from '@/hooks/usePersistedWidth';
import { LABEL_MAX_W, LABEL_MIN_W, LABEL_NARROW_W, LABEL_W } from '@/utils/timelineTrack';
import { TimelineHeader } from '@/components/common/timeline/TimelineHeader';
import { TimelineLabelResizer } from '@/components/common/timeline/TimelineLabelResizer';
import { useCycleDrag } from '../../hooks/useCycleDrag';
import { buildCycleTimeline, CYCLE_DAY_W, cycleLabelWidthKey } from '../../utils/cycleTimeline';
import CycleTimelineGroupRow from './CycleTimelineGroupRow';
import CycleTimelineRow from './CycleTimelineRow';

// The project's cycles on a day track, in the same groups as the table. Dragging a
// bar rewrites the cycle's dates; the track opens scrolled to today.
export default function CyclesTimeline({
  cycles,
  finished,
  projectKey,
}: {
  cycles: Cycle[];
  // Not drawn, but a drag is clamped off them too.
  finished: Cycle[];
  projectKey: string;
}) {
  const router = useRouter();
  const { can } = usePermissions();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledToToday = useRef(false);
  // Width of the scroll area, so the track extends with trailing days until it
  // fills the viewport instead of leaving empty space on the right.
  const viewportW = useElementWidth(scrollRef);

  const openCycle = (id: number) => router.push(cyclePath(projectKey, id));
  const canEdit = can('cycles', 'edit');
  const { width: labelWidth, setWidth: setLabelWidth } = usePersistedWidth(
    cycleLabelWidthKey(projectKey),
    LABEL_W,
    LABEL_MIN_W,
    LABEL_MAX_W,
  );
  // Narrow the sticky label column on small screens so the day track is usable; on
  // wider ones it is the width the grip was dragged to.
  const narrow = viewportW < 640;
  const labelW = narrow ? LABEL_NARROW_W : labelWidth;
  const { rows, days, months, trackWidth, todayLeft, todayInRange, dayLines, spanToRect } =
    buildCycleTimeline({ cycles, viewportW, labelW, dayW: CYCLE_DAY_W });
  const { preview, beginDrag } = useCycleDrag({
    projectKey,
    cycles: [...cycles, ...finished],
    dayW: CYCLE_DAY_W,
    onOpen: openCycle,
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || scrolledToToday.current || rows.length === 0) return;
    scrolledToToday.current = true;
    el.scrollLeft = Math.max(0, todayLeft - labelW);
  }, [rows.length, todayLeft, labelW]);

  // Left to right in every language, like the work items timeline: the bars are
  // placed in pixels from the left edge, and `scrollLeft` above counts from it.
  return (
    <div ref={scrollRef} dir="ltr" className="flex-1 overflow-auto">
      <div className="relative" style={{ width: labelW + trackWidth }}>
        <TimelineHeader
          labelW={labelW}
          trackWidth={trackWidth}
          dayW={CYCLE_DAY_W}
          months={months}
          days={days}
        />
        {!narrow && <TimelineLabelResizer labelW={labelW} onResize={setLabelWidth} />}

        {rows.map((row) =>
          row.kind === 'group' ? (
            <CycleTimelineGroupRow
              key={`g-${row.group.status}`}
              group={row.group}
              labelW={labelW}
              trackWidth={trackWidth}
            />
          ) : (
            <CycleTimelineRow
              key={row.cycle.id}
              cycle={row.cycle}
              projectKey={projectKey}
              rect={
                preview?.cycleId === row.cycle.id
                  ? spanToRect(preview.start, preview.end)
                  : spanToRect(row.span.start, row.span.end)
              }
              labelW={labelW}
              trackWidth={trackWidth}
              dayLines={dayLines}
              todayInRange={todayInRange}
              todayLeft={todayLeft}
              canEdit={canEdit}
              onBeginDrag={beginDrag}
              onOpen={openCycle}
            />
          ),
        )}
      </div>
    </div>
  );
}
