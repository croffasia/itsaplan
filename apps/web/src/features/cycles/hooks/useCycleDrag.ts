import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { ApiError, type Cycle, type CyclePatch } from '@/lib/api';
import { addDays, daysBetween, toDateStr } from '@/utils/dates';
import { useUpdateCycle } from '@/services/cycles.service';
import { cycleSpan, dateWindow, movableEnds } from '../utils/cycleDates';

// Whether a bar drag moves the whole cycle or resizes one end.
export type CycleDragMode = 'move' | 'start' | 'end';

// A gesture that stays within this many pixels is a click, not a drag.
const CLICK_SLOP = 3;

// Pointer-drag state and handler for the cycles timeline. A drag rewrites the
// cycle's dates; a press that does not travel opens the cycle. Every pointer
// gesture on a bar goes through here rather than through a click handler, so the
// click the browser fires after a drag cannot also open the cycle. The dates are
// held inside the gap the neighbouring cycles leave, so a drag never produces an
// overlap the API would reject. `preview` is the in-progress range of the dragged
// cycle.
export function useCycleDrag({
  projectKey,
  cycles,
  dayW,
  onOpen,
}: {
  projectKey: string;
  cycles: Cycle[];
  dayW: number;
  onOpen: (id: number) => void;
}) {
  const t = useTranslations('cycles');
  const update = useUpdateCycle(projectKey);
  const [preview, setPreview] = useState<{ cycleId: number; start: Date; end: Date } | null>(null);

  function beginDrag(e: React.PointerEvent, cycle: Cycle, mode: CycleDragMode) {
    e.preventDefault();
    e.stopPropagation();
    const span = cycleSpan(cycle);
    if (!span) return;
    const limits = dateWindow(cycles, cycle);
    const ends = movableEnds(cycle.status);
    const startX = e.clientX;
    const current = { start: span.start, end: span.end };
    let travelled = false;

    const onMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) > CLICK_SLOP) travelled = true;
      const delta = Math.round((ev.clientX - startX) / dayW);
      if (!ends[mode]) return;
      if (mode === 'move') {
        const min = limits.from ? -daysBetween(limits.from, span.start) : -Infinity;
        const max = limits.to ? daysBetween(span.end, limits.to) : Infinity;
        const held = Math.min(Math.max(delta, min), max);
        current.start = addDays(span.start, held);
        current.end = addDays(span.end, held);
      } else if (mode === 'start') {
        let start = addDays(span.start, delta);
        if (limits.from && start < limits.from) start = limits.from;
        if (start > span.end) start = span.end;
        current.start = start;
      } else {
        let end = addDays(span.end, delta);
        if (limits.to && end > limits.to) end = limits.to;
        if (end < span.start) end = span.start;
        current.end = end;
      }
      setPreview({ cycleId: cycle.id, start: current.start, end: current.end });
    };

    // Also bound to pointercancel: a gesture the browser takes over (a touch
    // scroll, a system gesture) never reaches pointerup, and would otherwise leave
    // the listeners bound and the bar stuck at its preview position.
    const endDrag = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', endDrag);
      setPreview(null);
    };

    const onUp = () => {
      endDrag();

      const patch: CyclePatch = {};
      const startDate = toDateStr(current.start);
      const endDate = toDateStr(current.end);
      if (mode !== 'end' && startDate !== cycle.startDate) patch.startDate = startDate;
      if (mode !== 'start' && endDate !== cycle.endDate) patch.endDate = endDate;

      // A press that stayed put opens the cycle; a drag that changed no date (it
      // ran into a neighbour, or the status locks that end) leaves it alone.
      if (Object.keys(patch).length === 0) {
        if (!travelled) onOpen(cycle.id);
        return;
      }
      update.mutate(
        { id: cycle.id, patch },
        {
          onError: (err) => toast.error(err instanceof ApiError ? err.message : t('dragFailed')),
        },
      );
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', endDrag);
  }

  return { preview, beginDrag };
}
